/**
 * VELT — shared motion presets (Linear/Vercel-like easing).
 *
 * These live outside `Motion.tsx` because of fast refresh: a module that exports
 * both components and constants cannot hot-reload reliably. React Refresh decides
 * a file is component-only by its exports, so one exported object turns every
 * edit into a full page reload — and silently resets the state of every mounted
 * component in the file while developing.
 *
 * `allowConstantExport` does not help here: it only allows exported *literals*
 * (`type`, `string`, `number`, `boolean`, `null`, `undefined`, arrays of those).
 * `fadeUp` and `stagger` are computed objects, so they are rejected.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE },
};

export const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};
