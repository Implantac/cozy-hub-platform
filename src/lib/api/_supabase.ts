/**
 * Tiny helpers for the repetitive Supabase error-handling pattern.
 *
 *   const { data, error } = await supabase.from("x").select().single();
 *   throwIfError(error);
 *
 * `unwrap()` collapses the destructure + throw into a single expression for
 * call sites that don't need to inspect the error object directly.
 *
 *   const row = unwrap(await supabase.from("x").select().single());
 */

export interface SupabaseLikeError {
  message: string;
  details?: string | null;
  code?: string | null;
}

export interface SupabaseLikeResult<T> {
  data: T;
  error: SupabaseLikeError | null;
}

/**
 * Throws `new Error(error.message)` when `error` is non-null. No-op otherwise.
 *
 * Declared as an assertion so TypeScript narrows the discriminated union
 * returned by Supabase (`{ data: T, error: null } | { data: null, error }`)
 * to the success branch on the lines that follow — matching the narrowing
 * the inline `if (error) throw …` pattern provided.
 */
export function throwIfError(
  error: SupabaseLikeError | null,
): asserts error is null {
  if (error) throw new Error(error.message);
}

/** Same as `throwIfError`, but returns the `data` payload of a result tuple. */
export function unwrap<T>(result: SupabaseLikeResult<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
