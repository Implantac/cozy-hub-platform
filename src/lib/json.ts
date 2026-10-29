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
