/**
 * VELT — Best-time-to-post engine (pure, testable).
 *
 * Benchmark context: Buffer, Metricool, Later and Hootsuite all ship a
 * "best time to post" feature. Almost all of them rely on generic cross-account
 * averages. VELT has a structural advantage it was not using: it already owns
 * the workspace's own `analytics_snapshots`, so it can rank slots by the
 * account's *measured* engagement and only fall back to baseline windows when
 * there is not enough history.
 *
 * The output always states which source it used, so the UI never dresses a
 * generic recommendation up as personalised data:
 *   1. `observed`  — enough published slots to rank by measured engagement
 *   2. `baseline`  — platform craft defaults, flagged as such
 */

import { rulesFor, type PlatformId } from "./platform-rules";

/** Timezone the product reasons in. Accounts are BR-first. */
export const PRODUCT_TZ = "America/Sao_Paulo";
export const PRODUCT_TZ_OFFSET_MIN = -180; // UTC-3, fixed (Brazil abolished DST in 2019)

export type SlotConfidence = "observed" | "baseline";

export interface SlotObservation {
  /** ISO timestamp of the original publication. */
  publishedAt: string;
  /** Measured engagement for that publication (any consistent unit). */
  engagement: number;
  /** Optional reach/impressions, used to normalise when available. */
  impressions?: number;
}

export interface RankedSlot {
  weekday: number; // 0 = Sunday
  hourUtc: number; // 0-23, UTC hour
  /** Mean engagement rate for this slot, normalised 0-1. */
  score: number;
  /** How many publications support this slot. */
  samples: number;
  confidence: SlotConfidence;
  reason: string;
}

export interface NextSlot {
  /** ISO instant, ready for `scheduledAt`. */
  at: string;
  label: string;
  confidence: SlotConfidence;
  reason: string;
}

const MIN_OBSERVATIONS_PER_SLOT = 2;
const MIN_OBSERVATIONS_TOTAL = 6;

/** Local (UTC-3) weekday + hour from an ISO string. */
export function localSlot(iso: string): { weekday: number; hour: number } {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + PRODUCT_TZ_OFFSET_MIN * 60_000);
  return { weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

/** Converts a local (UTC-3) weekday+hour into a UTC hour. */
export function toUtcHour(localHour: number): number {
  return (localHour - PRODUCT_TZ_OFFSET_MIN / 60 + 24) % 24;
}

/** Engagement rate: prefers engagement/impressions when impressions exist. */
function rate(o: SlotObservation): number {
  if (o.impressions && o.impressions > 0) return o.engagement / o.impressions;
  return o.engagement;
}

/**
 * Ranks posting slots for a platform.
 *
 * When the workspace has enough history, observed slots win and baseline
 * windows are only used to break ties. Otherwise it returns the platform
 * baseline, explicitly labelled as such — never silently presented as data.
 */
export function rankSlots(
  platform: PlatformId | string,
  observations: SlotObservation[],
): RankedSlot[] {
  const rules = rulesFor(String(platform));
  const buckets = new Map<string, number[]>();

  for (const o of observations) {
    if (!o.publishedAt) continue;
    const { weekday, hour } = localSlot(o.publishedAt);
    const key = `${weekday}:${hour}`;
    const arr = buckets.get(key) ?? [];
    arr.push(rate(o));
    buckets.set(key, arr);
  }

  const observed: RankedSlot[] = [];
  for (const [key, values] of buckets) {
    if (values.length < MIN_OBSERVATIONS_PER_SLOT) continue;
    const [wd, hr] = key.split(":").map(Number);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    observed.push({
      weekday: wd,
      hourUtc: toUtcHour(hr),
      score: mean,
      samples: values.length,
      confidence: "observed",
      reason: `Média de ${values.length} publicações suas neste horário`,
    });
  }

  // Normalise observed scores so the best slot is 1.0 without pretending to
  // know an absolute ceiling.
  if (observed.length > 0) {
    const max = Math.max(...observed.map((s) => s.score));
    if (max > 0) observed.forEach((s) => (s.score = s.score / max));
    observed.sort((a, b) => b.score - a.score || b.samples - a.samples);
  }

  const enoughHistory = observations.length >= MIN_OBSERVATIONS_TOTAL && observed.length > 0;
  if (enoughHistory) return observed;

  const baseline: RankedSlot[] = [];
  const windows = rules?.baselineWindows ?? [
    { weekday: [1, 2, 3, 4, 5], startHour: 11, endHour: 13 },
  ];
  // Spread baseline candidates across the window, one score per hour, with a
  // mild preference for the middle of the window.
  for (const w of windows) {
    for (const weekday of w.weekday) {
      for (let h = w.startHour; h < w.endHour; h++) {
        const mid = (w.startHour + w.endHour - 1) / 2;
        const closeness = 1 - Math.abs(h - mid) / Math.max(1, w.endHour - w.startHour);
        baseline.push({
          weekday,
          hourUtc: toUtcHour(h),
          score: 0.5 + closeness * 0.4,
          samples: 0,
          confidence: "baseline",
          reason: `Janela padrão de ${rules?.label ?? "rede"} — sem histórico seu ainda`,
        });
      }
    }
  }
  baseline.sort((a, b) => b.score - a.score);
  return baseline;
}

const WEEKDAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Formats a local (UTC-3) weekday+hour as a human label. */
export function formatSlotLabel(weekday: number, hourUtc: number): string {
  const local = (hourUtc + PRODUCT_TZ_OFFSET_MIN / 60 + 24) % 24;
  return `${WEEKDAY_LABELS[weekday] ?? "?"} ${String(local).padStart(2, "0")}:00`;
}

/**
 * Next recommended instant strictly after `from`.
 *
 * Candidates in the next 7 days are scored by measured slot quality multiplied
 * by a wait decay. A marginally better slot tomorrow must beat a dramatically
 * better slot in six days, otherwise the "recommendation" is really just
 * "post next Thursday" — which users ignore, and rightly so.
 *
 * DECAY = 0.92 per day ahead. At 7 days a slot retains ~56% of its value, so a
 * slot must be roughly twice as good to justify a full week of waiting.
 */
const WAIT_DECAY_PER_DAY = 0.92;

export function nextBestSlot(
  platform: PlatformId | string,
  observations: SlotObservation[],
  from: Date = new Date(),
  leadMinutes = 30,
): NextSlot {
  const ranked = rankSlots(platform, observations);
  const earliest = from.getTime() + leadMinutes * 60_000;

  if (ranked.length === 0) {
    // Absolute fallback: one hour from now, flagged honestly.
    return {
      at: new Date(earliest).toISOString(),
      label: "daqui a pouco",
      confidence: "baseline",
      reason: "Sem regras para esta plataforma — use o horário padrão do agendador.",
    };
  }

  // Current local weekday at `from`.
  const nowLocal = new Date(from.getTime() + PRODUCT_TZ_OFFSET_MIN * 60_000);
  const nowWeekday = nowLocal.getUTCDay();

  let best: { at: Date; slot: RankedSlot; daysAhead: number; weighted: number } | null = null;

  for (let offset = 0; offset < 8; offset++) {
    const weekday = (nowWeekday + offset) % 7;
    // Every ranked slot for this weekday, preserving rank order.
    const daySlots = ranked.filter((s) => s.weekday === weekday);
    if (daySlots.length === 0) continue;

    for (const slot of daySlots) {
      const localHour = (slot.hourUtc + PRODUCT_TZ_OFFSET_MIN / 60 + 24) % 24;
      const candidate = new Date(nowLocal);
      candidate.setUTCDate(candidate.getUTCDate() + offset);
      candidate.setUTCHours(localHour, 0, 0, 0);
      // Convert the constructed local instant back to a real UTC instant.
      const realUtc = new Date(candidate.getTime() - PRODUCT_TZ_OFFSET_MIN * 60_000);
      if (realUtc.getTime() < earliest) continue;

      const weighted = slot.score * Math.pow(WAIT_DECAY_PER_DAY, offset);
      if (!best || weighted > best.weighted) {
        best = { at: realUtc, slot, daysAhead: offset, weighted };
      }
    }
  }

  if (!best) {
    return {
      at: new Date(earliest).toISOString(),
      label: "próximo horário livre",
      confidence: "baseline",
      reason: "Nenhuma janela encontrada nos próximos 8 dias.",
    };
  }

  const waitNote =
    best.daysAhead >= 3
      ? ` Vale esperar ${best.daysAhead} dias: este horário rende ${Math.round(
          (1 - Math.pow(WAIT_DECAY_PER_DAY, best.daysAhead)) * 100,
        )}% menos se antecipado para amanhã.`
      : "";

  return {
    at: best.at.toISOString(),
    label: formatSlotLabel(best.slot.weekday, best.slot.hourUtc),
    confidence: best.slot.confidence,
    reason: best.slot.reason + waitNote,
  };
}

/**
 * Consistency forecast: how many publications per week are needed to sustain
 * momentum, and whether the current cadence meets it.
 */
export interface CadenceTarget {
  perWeek: number;
  rationale: string;
  source: "profile" | "platform-default";
}

export function cadenceTarget(
  platform: PlatformId | string,
  profile?: { time_budget_hours_week?: number | null; experience_level?: string | null } | null,
): CadenceTarget {
  const hours = profile?.time_budget_hours_week ?? 0;
  const level = profile?.experience_level ?? "beginner";

  // Budget-aware: a beginner with 2h/week cannot sustain 5 posts/week, and
  // telling them to would guarantee failure (and abandonment).
  if (hours > 0 && hours < 3) {
    return {
      perWeek: 2,
      rationale: `Com ${hours}h/semana, 2 publicações mantidas valem mais que 5 abandonadas.`,
      source: "profile",
    };
  }
  if (hours >= 10) {
    return {
      perWeek: 7,
      rationale: `Com ${hours}h/semana você sustenta uma cadência diária sem queimar.`,
      source: "profile",
    };
  }
  const byPlatform: Record<string, number> = {
    instagram: 4,
    tiktok: 5,
    youtube: 2,
    linkedin: 3,
    facebook: 3,
    x: 7,
    threads: 5,
    pinterest: 3,
  };
  const base = byPlatform[String(platform)] ?? 3;
  return {
    perWeek: level === "beginner" ? Math.max(2, base - 1) : base,
    rationale:
      level === "beginner"
        ? "Cadência inicial conservadora: o objetivo é não parar."
        : "Cadência de manutenção de alcance para esta plataforma.",
    source: "platform-default",
  };
}
