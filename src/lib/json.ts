/**
 * Readers for JSON columns.
 *
 * Several tables store small objects in `json` columns — a call to action, a list
 * of milestones, a free-form evidence blob. PostgREST and the generated types
 * report those as `Json`, which is a union of every JSON value; accessing a field
 * directly is not allowed, and casting to `any` to get around that is how a
 * malformed row crashes a render instead of rendering nothing.
 *
 * These helpers do the narrowing once, in one place, so call sites stay free of
 * optional-chaining guesswork and a schema change has a single place to land.
 *
 * They are deliberately total: an unexpected shape yields `null` or an empty
 * array rather than throwing. A card that renders nothing is a nuisance; a card
 * that throws takes the page with it.
 */

export type Cta = { href: string; label?: string };

/** Reads a `{ href, label? }` call to action, or `null` if it is not one. */
export function readCta(value: unknown): Cta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cta = value as { href?: unknown; label?: unknown };
  if (typeof cta.href !== "string" || cta.href.length === 0) return null;
  return {
    href: cta.href,
    label: typeof cta.label === "string" ? cta.label : undefined,
  };
}

export type Milestone = { id: string; title: string };

/** Reads a list of `{ id, title }` milestones, dropping entries without an id. */
export function readMilestones(value: unknown): Milestone[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const m = item as { id?: unknown; title?: unknown };
    if (typeof m.id !== "string") return [];
    return [{ id: m.id, title: typeof m.title === "string" ? m.title : m.id }];
  });
}

/**
 * Reads a list of `{ label }` items, the shape opportunities store in their
 * `actions` column. Items without a usable label are dropped: they would render
 * as an empty bullet otherwise.
 */
export function readLabels(value: unknown): { label: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const label = (item as { label?: unknown }).label;
    return typeof label === "string" && label.length > 0 ? [{ label }] : [];
  });
}

/**
 * Reads a JSON column that should hold a list of `{ title }` items.
 *
 * `hover` is kept because links are the only field consumers read so far, but
 * it stays optional: rows written before a field existed must not be dropped.
 */
export function readTitledActions(value: unknown): { title: string; href?: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const title = (item as { title?: unknown }).title;
    if (typeof title !== "string" || title.trim().length === 0) return [];
    const href = (item as { href?: unknown }).href;
    return [{ title, href: typeof href === "string" ? href : undefined }];
  });
}

/**
 * Reads the `{ summary: string }` shape stored by the AI analysis columns.
 */
export function readSummary(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = (value as { summary?: unknown }).summary;
  return typeof summary === "string" && summary.trim().length > 0 ? summary : null;
}

/**
 * Reads a JSON column that should hold a plain list of strings.
 *
 * Non-string entries are dropped rather than coerced: a number or an object in
 * a "reasons" list is a writing bug upstream, and `String(item)` would render
 * `[object Object]` to the user instead of leaving the item out.
 */
export function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Reads the `{ gaps: string[] }` breakdown that `digital_scores` stores as JSON
 * (the negative signal messages that most affect the score).
 */
export function readGaps(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const gaps = (value as { gaps?: unknown }).gaps;
  return Array.isArray(gaps) ? gaps.filter((g): g is string => typeof g === "string") : [];
}

/**
 * Message from an unknown thrown value.
 *
 * `catch (e: any) { toast.error(e.message) }` is convenient and wrong: `throw`
 * does not require an `Error`, so a rejected promise carrying a string, a plain
 * object with `error`, or nothing at all makes `e.message` `undefined` — and the
 * user sees an empty toast at the exact moment something broke.
 */
export function errorMessage(
  value: unknown,
  fallback = "Algo deu errado. Tente novamente.",
): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "string" && value.trim().length > 0) return value;
  if (value && typeof value === "object") {
    const message = (value as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) return message;
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string" && error.trim().length > 0) return error;
  }
  return fallback;
}
