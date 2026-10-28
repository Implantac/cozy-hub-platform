/**
 * VELT — Post quality engine (pure, testable).
 *
 * This is the piece that turns VELT from "a scheduler" into "a growth coach".
 * The market benchmark is unambiguous: every competitor in 2026 has an AI
 * caption writer, and nearly all of them produce generic copy. The defensible
 * ground is *judgement* — telling the user, before they publish, exactly which
 * line is costing them reach and what to do about it.
 *
 * Everything here is a pure function over strings and numbers: no network, no
 * database, no LLM. That makes it deterministic, instant, free to run on every
 * keystroke, and unit-testable.
 *
 * LIMITATION, stated openly: "what makes a hook work" is craft, not physics.
 * These heuristics encode widely-agreed practice, not measured causality. They
 * are framed as diagnostics with reasons, never as guarantees.
 */

import { rulesFor, type PlatformId, type PlatformRules } from "./platform-rules";

export type Severity = "blocker" | "warning" | "tip";

export interface QualityIssue {
  id: string;
  severity: Severity;
  /** Short, human title. */
  title: string;
  /** Why it matters — never a bare rule number. */
  why: string;
  /** Concrete fix, when there is one. */
  fix?: string;
  /** Character range the issue refers to, when applicable. */
  range?: [number, number];
}

export interface QualityCheck {
  platform: PlatformId;
  passed: boolean;
  score: number; // 0-100
  blockers: QualityIssue[];
  warnings: QualityIssue[];
  tips: QualityIssue[];
  stats: PostStats;
}

export interface PostStats {
  chars: number;
  words: number;
  hashtags: number;
  mentions: number;
  links: number;
  lines: number;
  emojis: number;
  /** Characters before the platform collapses the caption. */
  visibleChars: number;
  /** Share of the hook that is "readable" (letters/digits vs emoji/punct). */
  hookRatio: number;
}

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

const HASHTAG_RE = /(^|\s)#[\p{L}\p{N}_]+/gu;
const MENTION_RE = /(^|\s)@[\p{L}\p{N}_.]+/gu;
const URL_RE = /\bhttps?:\/\/[^\s]+/gi;
// Emoji ranges kept deliberately broad; false positives only skew a ratio.
// Variation selectors (FE0F) are combining marks; matched outside the class so
// the pattern does not read as a misleading character class.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]\u{FE0F}?/gu;

export function countMatches(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

/** First "line" of the post — what the feed actually shows first. */
export function extractHook(body: string): string {
  const trimmed = body.trimStart();
  if (!trimmed) return "";
  const firstBreak = trimmed.search(/\n/);
  const firstLine = firstBreak === -1 ? trimmed : trimmed.slice(0, firstBreak);
  // If the first line is a single word (a title stub), extend to the next line
  // because platforms collapse on characters, not on our line breaks.
  if (firstLine.trim().length > 0 && firstLine.trim().split(/\s+/).length > 1)
    return firstLine.trim();
  const joined = trimmed.split(/\n/).slice(0, 2).join(" ").trim();
  return joined || firstLine.trim();
}

export function analyzePost(body: string, platform: PlatformId | string): PostStats {
  const rules = rulesFor(platform);
  const visibleLimit = rules?.captionTruncateAt ?? 125;
  const hook = extractHook(body);
  const hookChars = [...hook].length;
  const hookEmoji = countMatches(hook, EMOJI_RE);
  const hookLetters = [...hook].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;

  return {
    chars: [...body].length,
    words: body.trim() ? body.trim().split(/\s+/).length : 0,
    hashtags: countMatches(body, HASHTAG_RE),
    mentions: countMatches(body, MENTION_RE),
    links: countMatches(body, URL_RE),
    lines: body.trim() ? body.trim().split(/\n+/).length : 0,
    emojis: countMatches(body, EMOJI_RE),
    visibleChars: Math.min([...body].length, visibleLimit),
    hookRatio: hookChars > 0 ? hookLetters / hookChars : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Hook craft                                                          */
/* ------------------------------------------------------------------ */

/** Opening words that signal a weak, self-centred hook in pt-BR and en-US. */
const WEAK_OPENERS = [
  "eu ",
  "estou ",
  "hoje eu",
  "venho por meio",
  "passando para",
  "oi gente",
  "olá pessoal",
  "bom dia",
  "boa tarde",
  "confira",
  "não perca",
  "imperdível",
  "i just",
  "we are pleased",
  "hello everyone",
  "check out",
];

/** Patterns that reliably create a curiosity gap or a concrete promise. */
const STRONG_HOOK_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /^\s*(como|how)\b/i, label: 'promessa de método ("como...")' },
  { re: /^\s*\d+\s/, label: "número concreto na abertura" },
  { re: /\?/, label: "pergunta que abre uma lacuna" },
  {
    re: /(erro|errei|falhei|perdi|prejuízo|fracasso|mistake|failed|lost)/i,
    label: "confissão de erro (prova de honestidade)",
  },
  { re: /(ninguém|nobody|a maioria|most people)/i, label: "contrarianismo com público definido" },
  { re: /(antes|depois|before|after)\b/i, label: "contraste antes/depois" },
  { re: /(em \d+ (dias|semanas|meses)|\d+ days?)/i, label: "prazo concreto" },
];

export interface HookAnalysis {
  hook: string;
  score: number; // 0-100
  strengths: string[];
  problems: QualityIssue[];
}

export function analyzeHook(body: string, platform: PlatformId | string): HookAnalysis {
  const rules = rulesFor(platform);
  const hook = extractHook(body);
  const strengths: string[] = [];
  const problems: QualityIssue[] = [];
  let score = 55; // neutral start: a neutral hook is not a failing hook

  if (!hook) {
    return {
      hook: "",
      score: 0,
      strengths: [],
      problems: [
        {
          id: "hook.empty",
          severity: "warning",
          title: "Post sem texto",
          why: "Sem gancho, o feed mostra apenas a mídia e o alcance depende só do visual.",
          fix: "Escreva uma primeira linha que funcione sozinha, em até 125 caracteres.",
        },
      ],
    };
  }

  const lower = hook.toLowerCase();
  const weak = WEAK_OPENERS.find((w) => lower.startsWith(w));
  if (weak) {
    score -= 22;
    problems.push({
      id: "hook.weak-opener",
      severity: "warning",
      title: `Abertura fraca: "${weak.trim()}"`,
      why: 'Feed não é diário pessoal. Aberturas centradas em você ("eu", "hoje eu", "passando para") gastam a única linha que a pessoa lê antes de rolar.',
      fix: "Comece pelo problema do leitor, por um número concreto ou por uma afirmação que ele discorde.",
      range: [0, hook.length],
    });
  }

  const matched = STRONG_HOOK_PATTERNS.filter((p) => p.re.test(hook));
  if (matched.length > 0) {
    score += Math.min(30, matched.length * 15);
    strengths.push(...matched.map((m) => m.label));
  }

  const stats = analyzePost(body, platform);
  if (stats.hookRatio < 0.55) {
    score -= 12;
    problems.push({
      id: "hook.noise",
      severity: "tip",
      title: "Excesso de emoji ou pontuação na primeira linha",
      why: "Emoji não é lido por leitores de tela nem por busca, e ocupa o espaço de palavras que carregam significado.",
      fix: "No máximo 1 emoji, e nunca antes da primeira palavra.",
    });
  }

  const hookLen = [...hook].length;
  const truncateAt = rules?.captionTruncateAt ?? 125;
  if (hookLen > truncateAt) {
    score -= 10;
    problems.push({
      id: "hook.too-long",
      severity: "warning",
      title: `Gancho com ${hookLen} caracteres (limite visível: ${truncateAt})`,
      why: `No ${rules?.label ?? "feed"} a legenda colapsa em ${truncateAt} caracteres. Tudo depois disso só aparece para quem já decidiu parar.`,
      fix: `Reescreva a primeira linha em até ${truncateAt} caracteres e deixe o resto para o corpo.`,
      range: [0, hookLen],
    });
  }

  // A single sentence that asks a question but answers nothing is a classic
  // engagement-bait pattern; flag it without being moralistic.
  if (/^(você sabia|did you know|sabia que)/i.test(hook.trim())) {
    score -= 8;
    problems.push({
      id: "hook.bait",
      severity: "tip",
      title: '"Você sabia que..." é padrão gasto',
      why: "Toda marca usa. Não diferencia e não cria curiosidade real — a resposta costuma estar no lugar-comum seguinte.",
      fix: "Troque pela consequência concreta: o que muda na vida de quem lê?",
    });
  }

  return {
    hook,
    score: Math.max(0, Math.min(100, Math.round(score))),
    strengths,
    problems,
  };
}

/* ------------------------------------------------------------------ */
/* Full preflight                                                      */
/* ------------------------------------------------------------------ */

export interface PreflightInput {
  body: string;
  title?: string | null;
  platform: PlatformId | string;
  /** Number of media items attached. */
  mediaCount?: number;
  /** Optional platform-specific CTA target. */
  hasLink?: boolean;
}

/**
 * Runs every check that would cause a real publish to fail or underperform.
 * `passed` means "safe to publish" (no blockers), not "good post".
 */
export function preflight(input: PreflightInput): QualityCheck {
  const rules = rulesFor(String(input.platform)) as PlatformRules | null;
  const blockers: QualityIssue[] = [];
  const warnings: QualityIssue[] = [];
  const tips: QualityIssue[] = [];

  if (!rules) {
    return {
      platform: input.platform as PlatformId,
      passed: false,
      score: 0,
      blockers: [
        {
          id: "platform.unsupported",
          severity: "blocker",
          title: `Plataforma não suportada: ${input.platform}`,
          why: "Não existe publisher registrado para este canal, então a publicação falharia na fila.",
        },
      ],
      warnings: [],
      tips: [],
      stats: analyzePost(input.body, "instagram"),
    };
  }

  const body = input.body ?? "";
  const stats = analyzePost(body, rules.id);
  const mediaCount = input.mediaCount ?? 0;

  /* --- Hard limits (blockers) ------------------------------------- */
  if (stats.chars === 0) {
    blockers.push({
      id: "body.empty",
      severity: "blocker",
      title: "Legenda vazia",
      why: `${rules.label} exige texto no corpo da publicação.`,
      fix: "Escreva pelo menos o gancho principal.",
    });
  }

  if (stats.chars > rules.captionLimit) {
    blockers.push({
      id: "body.too-long",
      severity: "blocker",
      title: `${stats.chars - rules.captionLimit} caracteres acima do limite`,
      why: `${rules.label} rejeita legendas com mais de ${rules.captionLimit} caracteres. A publicação inteira falha — não é truncada.`,
      fix: `Corte ${stats.chars - rules.captionLimit} caracteres ou mova o excedente para o primeiro comentário.`,
    });
  }

  if (rules.titleLimit && (input.title ?? "").length > rules.titleLimit) {
    blockers.push({
      id: "title.too-long",
      severity: "blocker",
      title: `Título com ${(input.title ?? "").length} caracteres (limite: ${rules.titleLimit})`,
      why: `${rules.label} rejeita títulos acima de ${rules.titleLimit} caracteres.`,
      fix: "Encurte o título — no mobile aparecem só os primeiros 30.",
    });
  }

  if (rules.requiresMedia && mediaCount === 0) {
    blockers.push({
      id: "media.required",
      severity: "blocker",
      title: `${rules.label} não publica sem mídia`,
      why: "Este formato exige imagem ou vídeo anexado.",
      fix: "Anexe a mídia ou publique como texto em outra plataforma.",
    });
  }

  /* --- Reach risks (warnings) ------------------------------------- */
  if (stats.hashtags > rules.hashtagLimit) {
    warnings.push({
      id: "hashtags.over-limit",
      severity: "warning",
      title: `${stats.hashtags} hashtags (limite: ${rules.hashtagLimit})`,
      why: `${rules.label} rejeita publicações acima do limite de hashtags.`,
      fix: `Remova ${stats.hashtags - rules.hashtagLimit}.`,
    });
  } else if (
    stats.hashtags > rules.hashtagSweetSpot[1] ||
    (stats.hashtags > 0 && stats.hashtags < rules.hashtagSweetSpot[0])
  ) {
    warnings.push({
      id: "hashtags.off-target",
      severity: "warning",
      title: `${stats.hashtags} hashtags fora da faixa ideal (${rules.hashtagSweetSpot[0]}–${rules.hashtagSweetSpot[1]})`,
      why: "Hashtag em excesso sinaliza spam e dilui o alcance; hashtag de menos perde descoberta. A faixa ideal é específica por plataforma.",
      fix:
        stats.hashtags > rules.hashtagSweetSpot[1]
          ? "Mantenha só as 3-5 mais específicas ao nicho."
          : "Adicione 2-3 hashtags de nicho (não genéricas como #fyp).",
    });
  }

  if (!rules.linksClickable && stats.links > 0) {
    warnings.push({
      id: "link.not-clickable",
      severity: "warning",
      title: `${rules.label} não torna link clicável`,
      why: "Um URL no texto vira texto morto: a pessoa não consegue tocar e o alcance cai porque a plataforma desprioriza saídas.",
      fix: "Mova o link para a bio, para o primeiro comentário ou para o sticker de link dos stories.",
    });
  }

  if (rules.linksClickable && stats.links > 1) {
    tips.push({
      id: "link.multiple",
      severity: "tip",
      title: "Mais de um link no mesmo post",
      why: "Divide a atenção e embaralha a atribuição nas métricas.",
      fix: "Use um único destino por publicação.",
    });
  }

  const hookEval = analyzeHook(body, rules.id);
  warnings.push(...hookEval.problems.filter((p) => p.severity === "warning"));
  tips.push(...hookEval.problems.filter((p) => p.severity !== "warning"));

  if (stats.lines === 1 && stats.chars > 180) {
    tips.push({
      id: "format.wall-of-text",
      severity: "tip",
      title: "Bloco único de texto",
      why: "Ninguém lê parede de texto no celular. Quebras de linha a cada 1-2 frases dobram a taxa de leitura.",
      fix: "Quebre em parágrafos curtos — uma ideia por parágrafo.",
    });
  }

  if (
    stats.chars > rules.captionTruncateAt &&
    !/\n/.test(body.slice(0, rules.captionTruncateAt + 40))
  ) {
    tips.push({
      id: "format.no-early-break",
      severity: "tip",
      title: "Sem quebra de linha no trecho visível",
      why: `O texto colapsa em ${rules.captionTruncateAt} caracteres; uma quebra antes disso cria respiro e aumenta o "ver mais".`,
    });
  }

  /* --- Score ------------------------------------------------------- */
  const penalty =
    blockers.length * 35 +
    warnings.reduce((a, w) => a + (w.id.startsWith("hook.") ? 8 : 10), 0) +
    tips.length * 3;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    platform: rules.id,
    passed: blockers.length === 0,
    score,
    blockers,
    warnings,
    tips,
    stats,
  };
}

/* ------------------------------------------------------------------ */
/* Ad readiness (paid traffic)                                          */
/* ------------------------------------------------------------------ */

export interface AdReadiness {
  score: number; // 0-100
  verdict: "ready" | "needs-work" | "organic-only";
  reasons: string[];
  /** True when the same asset can serve both organic and paid. */
  reusableAsCreative: boolean;
}

/**
 * Assesses whether a piece of organic content can be promoted as paid creative.
 *
 * Paid traffic fails for reasons that are different from organic failure:
 * an ad has no audience built in, so the hook must carry 100% of the stopping
 * power, the promise must be specific enough to survive comparison shopping,
 * and there must be exactly one destination. A piece that performs organically
 * through community and familiarity often flops as an ad — and vice versa.
 */
export function adReadiness(body: string, platform: PlatformId | string): AdReadiness {
  const hook = analyzeHook(body, platform);
  const stats = analyzePost(body, platform);
  const lower = body.toLowerCase();
  const reasons: string[] = [];
  let score = 40;

  if (hook.score >= 70) {
    score += 25;
    reasons.push(`Gancho forte (${hook.score}/100): sustenta o scroll-stop sem audiência prévia.`);
  } else if (hook.score < 50) {
    score -= 10;
    reasons.push(
      `Gancho fraco (${hook.score}/100): em anúncio não existe familiaridade para segurar o leitor.`,
    );
  }

  if (/\d/.test(hook.hook)) {
    score += 12;
    reasons.push("Contém número concreto: sobrevive à comparação lado a lado com concorrentes.");
  } else {
    reasons.push(
      "Sem número concreto: em tráfego pago a promessa vaga perde para qualquer oferta específica.",
    );
  }

  const hasCta =
    /(clique|clica|garanta|baixe|acesse|comece|agende|fale com|saiba mais|link na bio|arraste|salve|comente|dm|direct|sign up|download|book)/i.test(
      lower,
    );
  if (hasCta) {
    score += 12;
    reasons.push("Tem chamada para ação explícita — obrigatória em anúncio.");
  } else {
    score -= 10;
    reasons.push("Sem CTA: anúncio sem instrução clara desperdiça orçamento.");
  }

  if (stats.links === 0) {
    score += 6;
    reasons.push(
      "Sem link no corpo: o destino fica no botão do anúncio, preservando a atribuição.",
    );
  } else if (stats.links === 1) {
    score += 3;
    reasons.push("Um único link: atribuição limpa.");
  } else {
    score -= 8;
    reasons.push("Vários links: divide a atribuição e o teste A/B perde validade.");
  }

  if (stats.chars > 400) {
    score -= 6;
    reasons.push("Texto longo: em anúncio só ~125 caracteres aparecem antes do 'ver mais'.");
  }

  const final = Math.max(0, Math.min(100, score));
  return {
    score: final,
    verdict: final >= 70 ? "ready" : final >= 45 ? "needs-work" : "organic-only",
    reasons,
    reusableAsCreative: final >= 70 && hasCta,
  };
}

/* ------------------------------------------------------------------ */
/* Suggestions (deterministic, no LLM)                                 */
/* ------------------------------------------------------------------ */

export interface RewriteSuggestion {
  id: string;
  label: string;
  /** The rewritten first line, ready to be dropped in. */
  text: string;
  rationale: string;
}

/**
 * Produces concrete opening-line alternatives derived from the post's own
 * content. No generative model: it restructures what the user already wrote
 * using patterns that consistently outperform self-centred openers.
 */
export function suggestHooks(body: string, platform: PlatformId | string): RewriteSuggestion[] {
  const rules = rulesFor(String(platform));
  const limit = rules?.captionTruncateAt ?? 125;
  const plain = body.replace(HASHTAG_RE, "").replace(URL_RE, "").replace(EMOJI_RE, "").trim();
  if (!plain) return [];

  const sentences = plain
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const out: RewriteSuggestion[] = [];
  const clip = (s: string) => (s.length <= limit ? s : s.slice(0, limit - 1).trimEnd() + "…");

  // 1) Lead with the most concrete sentence (one containing a number/claim).
  const concrete = sentences.find((s) => /\d/.test(s)) ?? sentences[0];
  if (concrete) {
    out.push({
      id: "hook.concrete",
      label: "Abrir pela frase mais concreta",
      text: clip(concrete),
      rationale: "Número ou afirmação específica na primeira linha supera contexto genérico.",
    });
  }

  // 2) Turn the core claim into a question the reader answers internally.
  if (concrete) {
    const core = concrete
      .replace(/[.!?]+$/, "")
      .split(/[,;:]/)[0]
      .trim();
    out.push({
      id: "hook.question",
      label: "Transformar em pergunta",
      text: clip(`Você está fazendo isso? ${core.charAt(0).toLowerCase()}${core.slice(1)}`),
      rationale: "Pergunta abre uma lacuna de curiosidade que o cérebro quer fechar.",
    });
  }

  // 3) Reframe as a mistake / lesson, the strongest opening pattern in the data.
  if (sentences.length >= 2) {
    out.push({
      id: "hook.lesson",
      label: "Enquadrar como erro aprendido",
      text: clip(`Levei tempo para entender: ${concrete}`),
      rationale: "Confissão de erro sinaliza honestidade e reduz a defensividade do leitor.",
    });
  }

  // 4) Promise a concrete outcome with a time bound.
  out.push({
    id: "hook.promise",
    label: "Prometer resultado com prazo",
    text: clip(`${concrete.replace(/[.!?]+$/, "")} — em 7 dias.`),
    rationale: "Prazo concreto transforma uma afirmação vaga em compromisso verificável.",
  });

  return out;
}
