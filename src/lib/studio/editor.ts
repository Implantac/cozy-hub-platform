/** Rough planning estimate, not actual speech or subtitle timing. */
export function estimateNarrationSeconds(narration: string): number {
  const text = narration.trim();
  if (!text) return 0;
  const words = text.split(/\s+/u).length;
  return Math.max(1, Math.round((words / 140) * 60));
}

export type RenderSnapshot = { title: string; narration: string };

/** The worker trims these two fields before rendering; other script fields aren't used. */
export function isRenderOutdated(
  snapshot: RenderSnapshot | null,
  current: RenderSnapshot,
): boolean {
  return Boolean(
    snapshot &&
    (snapshot.title.trim() !== current.title.trim() ||
      snapshot.narration.trim() !== current.narration.trim()),
  );
}
