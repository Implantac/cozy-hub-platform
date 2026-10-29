/**
 * Anti-scam `checks` is a JSON column holding the verifier's findings:
 * `{ red_flags: string[], green_flags: string[] }`. Only two arrays of strings are
 * read, so only those are validated — a wider type would imply the rest is
 * trustworthy.
 */
export type ScamChecks = { red_flags: string[]; green_flags: string[] };

export function readChecks(value: unknown): ScamChecks {
  const source = (value && typeof value === "object" ? value : {}) as {
    red_flags?: unknown;
    green_flags?: unknown;
  };
  const strings = (raw: unknown): string[] =>
    Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  return {
    red_flags: strings(source.red_flags),
    green_flags: strings(source.green_flags),
  };
}
