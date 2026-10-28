import type { BrainContext, EngineReport } from "../types";
import { rulesFor, type PlatformId } from "@/lib/growth/platform-rules";
import { preflight } from "@/lib/growth/post-quality";
import { cadenceTarget, rankSlots, type SlotObservation } from "@/lib/growth/scheduling";

/**
 * Growth Intelligence Engine — consistency, stagnation and publish risk.
 *
 * Upgraded to consume the same pure engines the UI runs, so the Brain's
 * diagnosis and the composer's preflight can never disagree. Two new classes of
 * signal are surfaced that the previous version could not see at all:
 *
 *   - cadence vs. sustainable target, derived from the user's own time budget
 *   - drafts that would fail their platform's hard limits if scheduled today
 */
export function analyzeGrowth(ctx: BrainContext): EngineReport {
  const signals: EngineReport["signals"] = [];
  const actions: EngineReport["actions"] = [];
  const content = ctx.content ?? [];
  const jobs = ctx.jobs ?? [];

  const now = Date.now();
  const d7 = now - 7 * 86400_000;
  const d30 = now - 30 * 86400_000;

  const recent7 = content.filter((c) => new Date(c.created_at).getTime() > d7).length;
  const recent30 = content.filter((c) => new Date(c.created_at).getTime() > d30).length;

  const succ = jobs.filter((j) => j.status === "succeeded").length;
  const failed = jobs.filter((j) => j.status === "dead_letter" || j.status === "failed").length;
  const successRate = jobs.length ? succ / jobs.length : 0;

  /* --- Consistency ------------------------------------------------- */
  if (recent7 === 0 && content.length > 0) {
    signals.push({
      engine: "growth",
      kind: "negative",
      severity: "high",
      weight: 0.85,
      message: "Sem publicações nos últimos 7 dias — consistência caiu.",
    });
    actions.push({
      engine: "growth",
      score: 90,
      title: "Voltar a publicar esta semana",
      rationale: "Consistência é o maior fator de crescimento orgânico.",
      href: "/app/content",
    });
  } else if (recent30 < 8) {
    signals.push({
      engine: "growth",
      kind: "negative",
      severity: "medium",
      weight: 0.55,
      message: `Apenas ${recent30} publicações em 30 dias (meta: 8+).`,
    });
  } else {
    signals.push({
      engine: "growth",
      kind: "positive",
      severity: "info",
      weight: 0.4,
      message: `Boa cadência: ${recent30} publicações nos últimos 30 dias.`,
    });
  }

  /* --- Cadence vs. sustainable target ------------------------------ */
  const primaryPlatform = (ctx.channels?.[0]?.platform ?? "instagram") as PlatformId;
  const target = cadenceTarget(primaryPlatform, ctx.profile ?? null);
  const weeklyNeeded = target.perWeek;
  if (content.length > 0 && recent7 > 0 && recent7 < weeklyNeeded) {
    signals.push({
      engine: "growth",
      kind: "negative",
      severity: "low",
      weight: 0.45,
      message: `Cadência de ${recent7}/semana contra meta sustentável de ${weeklyNeeded}/semana em ${rulesFor(primaryPlatform)?.label ?? primaryPlatform}.`,
    });
  }

  /* --- Publish risk ------------------------------------------------- */
  if (failed > 0 && jobs.length > 0 && successRate < 0.7) {
    signals.push({
      engine: "growth",
      kind: "negative",
      severity: "medium",
      weight: 0.6,
      message: `Taxa de publicação ${Math.round(successRate * 100)}% — investigar falhas.`,
    });
    actions.push({
      engine: "growth",
      score: 75,
      title: "Revisar publicações que falharam",
      rationale: `${failed} job(s) morreram na fila. Falha recorrente costuma ser credencial expirada ou mídia fora do formato.`,
      href: "/app/scheduler",
    });
  }

  // Drafts that would be rejected by the platform on schedule.
  const drafts = content.filter((c) => c.status === "draft" && (c.title || true));
  const blockedDrafts = drafts.filter((c) => {
    const check = preflight({
      body: (c as { body?: string | null }).body ?? "",
      title: (c as { title?: string | null }).title ?? null,
      platform: primaryPlatform,
      mediaCount: 0,
    });
    return !check.passed;
  }).length;

  if (blockedDrafts > 0) {
    signals.push({
      engine: "growth",
      kind: "negative",
      severity: "medium",
      weight: 0.6,
      message: `${blockedDrafts} rascunho(s) violam limites da plataforma e falhariam ao ser agendados.`,
    });
    actions.push({
      engine: "growth",
      score: 70,
      title: "Corrigir rascunhos com impedimento",
      rationale: "O pré-voo detectou limites excedidos. Agendar assim gera job morto na fila.",
      href: "/app/content",
    });
  }

  /* --- Timing quality ---------------------------------------------- */
  // Join published jobs to their measured metrics (analytics_snapshots, written
  // by the analytics sync). Before the sync existed this list was always empty,
  // which is why best-time-to-post could only ever return baselines.
  const latestByContent = new Map<string, { engagement: number; impressions: number }>();
  const snaps = (ctx.analytics ?? []) as Array<{
    content_id?: string | null;
    metrics?: Record<string, unknown> | null;
  }>;
  for (const snap of snaps) {
    if (!snap.content_id || latestByContent.has(snap.content_id)) continue; // newest first
    const m = snap.metrics ?? {};
    latestByContent.set(snap.content_id, {
      engagement: Number(m.engagement ?? 0),
      impressions: Number(m.impressions ?? m.reach ?? 0),
    });
  }

  const observations: SlotObservation[] = [];
  for (const j of jobs) {
    if (j.status !== "succeeded" || !j.scheduled_at) continue;
    const metrics = j.content_id ? latestByContent.get(j.content_id) : undefined;
    if (!metrics?.engagement) continue;
    observations.push({
      publishedAt: j.scheduled_at,
      engagement: metrics.engagement,
      impressions: metrics.impressions || undefined,
    });
  }

  /* --- Trend from measured data ------------------------------------ */
  const measured = Array.from(latestByContent.values()).filter((m) => m.impressions > 0);
  if (measured.length > 0) {
    const avgRate =
      measured.reduce((a, m) => a + m.engagement / Math.max(1, m.impressions), 0) / measured.length;

    if (avgRate < 0.01) {
      signals.push({
        engine: "growth",
        kind: "negative",
        severity: "medium",
        weight: 0.6,
        message: `Engajamento médio de ${(avgRate * 100).toFixed(2)}% — abaixo de 1% indica conteúdo visto mas não absorvido.`,
      });
      actions.push({
        engine: "growth",
        score: 72,
        title: "Reescrever o gancho dos próximos posts",
        rationale:
          "Taxa baixa com alcance normal significa que a primeira linha não segura. Rode o pré-voo antes de publicar.",
        href: "/app/content",
      });
    } else if (avgRate > 0.05) {
      signals.push({
        engine: "growth",
        kind: "positive",
        severity: "info",
        weight: 0.5,
        message: `Engajamento médio de ${(avgRate * 100).toFixed(1)}% — acima do padrão do mercado.`,
      });
    }
  }
  const ranked = rankSlots(primaryPlatform, observations);
  const usedBaseline = ranked.every((r) => r.confidence === "baseline");

  return {
    signals,
    actions,
    facts: {
      recent7,
      recent30,
      successRate,
      total: content.length,
      blockedDrafts,
      cadenceTarget: weeklyNeeded,
      primaryPlatform,
      timingSource: usedBaseline ? "baseline" : "observed",
      measuredPosts: measured.length,
      avgEngagementRate:
        measured.length > 0
          ? Math.round(
              (measured.reduce((a, m) => a + m.engagement / Math.max(1, m.impressions), 0) /
                measured.length) *
                10000,
            ) / 10000
          : null,
    },
  };
}
