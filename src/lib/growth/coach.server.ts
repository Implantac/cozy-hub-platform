/**
 * VELT — Growth coach (server-only AI layer).
 *
 * The deterministic engines in `post-quality.ts` already answer *what* is wrong
 * and *why*. What they cannot do is propose a better sentence in the voice of a
 * specific business. That is the only job given to the model here.
 *
 * Design rules, in order of importance:
 *
 *   1. The model never sees an unbounded task. It receives the diagnosed issues
 *      and is asked for rewrites of those exact issues — not for a general
 *      critique. An LLM asked "what do you think?" produces generic advice, and
 *      generic advice is the commodity this product competes against.
 *   2. The model never produces the score. Scores come from `rewrite-gate.ts`,
 *      which re-runs the pure engine on the proposed text.
 *   3. No key, no problem. Without `LOVABLE_API_KEY` the feature degrades to the
 *      deterministic suggestions already computed in the browser — the panel
 *      keeps working, visibly without the AI badge.
 */

import { callAITool } from "@/lib/api/_ai-gateway.server";
import { rulesFor } from "./platform-rules";
import {
  coachableIssues,
  selectBestRewrites,
  snapshotDraft,
  type CandidateRewrite,
  type OriginalSnapshot,
} from "./rewrite-gate";

export interface CoachSuggestion {
  body: string;
  rationale: string;
  addresses: string;
  /** Deterministic score of the rewritten text. */
  score: number;
  /** Issue ids the rewrite provably removed. */
  fixed: string[];
}

export interface CoachResult {
  source: "ai" | "unavailable";
  suggestions: CoachSuggestion[];
  /** Issues that were worth rewriting, in severity order. */
  issueIds: string[];
  model?: string;
  /** Why the AI layer is absent, when it is. Never shown as an error. */
  skippedReason?: "no_key" | "model_failed" | "all_rejected";
}

const SYSTEM = `Você é um copywriter sênior de social media brasileiro, especializado em negócios locais.
Sua tarefa é reescrever APENAS o que foi pedido, mantendo a voz do negócio e o idioma original.

Regras invioláveis:
- Português do Brasil, tom direto. Nada de clichê de marketing ("imperdível", "não perca", "confira").
- Não invente fatos, preços, prazos, números ou depoimentos que não estejam no texto original.
- A primeira linha precisa funcionar sozinha: é o único trecho que aparece antes do "ver mais".
- Preserve a intenção comercial do post e qualquer link existente.
- Devolva no máximo 3 reescritas, cada uma mirando um problema diferente.`;

interface RawCandidate {
  body: string;
  rationale: string;
  addresses: string;
}

function buildParams(issues: Array<{ id: string; title: string; why: string; fix?: string }>) {
  return {
    type: "object",
    properties: {
      rewrites: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            addresses: {
              type: "string",
              enum: issues.map((i) => i.id),
              description: "Id exato do problema que esta reescrita resolve.",
            },
            body: {
              type: "string",
              description: "Legenda completa reescrita, pronta para publicar.",
            },
            rationale: {
              type: "string",
              description: "Uma frase, em português, dizendo o que mudou e por quê.",
            },
          },
          required: ["addresses", "body", "rationale"],
        },
      },
    },
    required: ["rewrites"],
    additionalProperties: false,
  } as const;
}

function buildPrompt(
  snapshot: OriginalSnapshot,
  issues: Array<{ id: string; title: string; why: string; fix?: string }>,
  brandVoice: Record<string, unknown> | null,
): string {
  const rules = rulesFor(snapshot.platform);
  return JSON.stringify({
    plataforma: rules?.label ?? snapshot.platform,
    limite_de_caracteres: rules?.captionLimit ?? 2200,
    trecho_visivel_antes_do_corte: rules?.captionTruncateAt ?? 125,
    texto_original: snapshot.body,
    problemas_diagnosticados: issues.map((i) => ({
      id: i.id,
      titulo: i.title,
      por_que_importa: i.why,
      como_corrigir: i.fix ?? null,
    })),
    voz_da_marca: brandVoice,
    // The model sees the current score so it understands the bar, but it does
    // not get to set a new one.
    score_atual: snapshot.score,
  });
}

/**
 * Produces verified rewrites for a draft.
 *
 * Returns an empty suggestion list rather than throwing when the AI layer is
 * unavailable: the preflight panel must keep rendering the deterministic advice
 * it already has.
 */
export async function coachDraft(input: {
  body: string;
  platform: string;
  title?: string | null;
  mediaCount?: number;
  brandVoice?: Record<string, unknown> | null;
}): Promise<CoachResult> {
  const snapshot = snapshotDraft({
    body: input.body,
    platform: input.platform,
    title: input.title ?? null,
    mediaCount: input.mediaCount,
  });

  const issues = coachableIssues(snapshot);
  const issueIds = issues.map((i) => i.id);

  // Nothing worth rewriting: a clean draft should say so, not invent work.
  if (issues.length === 0) {
    return { source: "ai", suggestions: [], issueIds, skippedReason: "all_rejected" };
  }

  if (!process.env.LOVABLE_API_KEY) {
    return { source: "unavailable", suggestions: [], issueIds, skippedReason: "no_key" };
  }

  let raw: { rewrites?: RawCandidate[] };
  let model: string;
  try {
    const result = await callAITool<{ rewrites?: RawCandidate[] }>({
      system: SYSTEM,
      user: buildPrompt(snapshot, issues, input.brandVoice ?? null),
      toolName: "propose_rewrites",
      toolDescription: "Devolve reescritas verificáveis para problemas diagnosticados.",
      parameters: buildParams(issues),
    });
    raw = result.data;
    model = result.model;
  } catch (e) {
    console.error("[coach] modelo falhou:", e instanceof Error ? e.message : e);
    return { source: "unavailable", suggestions: [], issueIds, skippedReason: "model_failed" };
  }

  // A structured-output model can still return the wrong type (a string, a
  // single object). Trusting the declared schema here would throw inside the
  // server function and surface as a 500 on a screen that has nothing to do with
  // the failure. Validate the shape instead.
  const rawList = Array.isArray(raw?.rewrites) ? raw.rewrites : [];
  const candidates: CandidateRewrite[] = rawList
    .filter(
      (r): r is RawCandidate =>
        Boolean(r) && typeof r.body === "string" && typeof r.addresses === "string",
    )
    .map((r) => ({
      body: r.body,
      rationale: r.rationale ?? "",
      addresses: r.addresses,
    }));

  const accepted = selectBestRewrites(snapshot, candidates);

  return {
    source: "ai",
    model,
    issueIds,
    skippedReason: accepted.length === 0 ? "all_rejected" : undefined,
    suggestions: accepted.map(({ candidate, verdict }) => ({
      body: candidate.body,
      rationale: candidate.rationale,
      addresses: candidate.addresses,
      score: verdict.newScore ?? snapshot.score,
      fixed: verdict.fixed,
    })),
  };
}
