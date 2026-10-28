/// <reference types="vite/client" />

/**
 * Env vars consumed by `import.meta.env`.
 *
 * Declaring them makes `import.meta.env.VITE_FLAG_COMMERCE` a typed expression
 * instead of an `any` — and `any` in a flag read is how `if (flag)` silently
 * becomes always-true.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Off by default. See `src/lib/features/flags.ts`. */
  readonly VITE_FLAG_COMMERCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
