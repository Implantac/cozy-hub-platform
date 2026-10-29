/**
 * Persistence for the product tour's "already seen" flag.
 *
 * Separate from `ProductTour.tsx` so that file exports a component only — a
 * module with mixed exports cannot hot-reload, and the tour keeps real state
 * (current step, measured highlight rect) that was being thrown away on every
 * edit during development.
 *
 * Every access is guarded: `localStorage` throws in private mode on some
 * browsers, and a tour that crashes the shell on first paint is worse than a
 * tour that does not remember.
 */
const TOUR_KEY = "use-os:product-tour-completed";

export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(TOUR_KEY) === "1";
  } catch {
    return false;
  }
}

export function resetTour(): void {
  try {
    window.localStorage.removeItem(TOUR_KEY);
  } catch {
    /* localStorage indisponível (modo privado) — tour reinicia só nesta sessão */
  }
}

/** Marks the tour as seen. Written through the same guard as the readers. */
export function markTourSeen(): void {
  try {
    window.localStorage.setItem(TOUR_KEY, "1");
  } catch {
    /* idem */
  }
}

export { TOUR_KEY };
