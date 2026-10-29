/**
 * Pure analysis of collected CSP violation metadata.
 *
 * Kept out of `csp-report.server.ts` so it can be unit-tested without a database
 * client, and so a future UI can summarise reports without importing the
 * service-role client — which would be a privilege escalation waiting to happen.
 */

export type DirectiveSummary = {
  directive: string;
  count: number;
  /** Hosts that would have been blocked, most frequent first. */
  hosts: string[];
  /** A ready-to-paste directive fragment if this turns out to be legitimate. */
  suggestion: string;
  lastSeen: string;
};

export type CspReportSummary = {
  windowDays: number;
  total: number;
  directives: DirectiveSummary[];
  /** True when nothing would break: the policy is safe to enforce. */
  safeToEnforce: boolean;
};

/** Maps a CSP directive to the fetch directive whose sources would cover it. */
export const SOURCE_DIRECTIVE: Record<string, string> = {
  "script-src-elem": "script-src",
  "script-src-attr": "script-src",
  "style-src-elem": "style-src",
  "style-src-attr": "style-src",
  "img-src": "img-src",
  "font-src": "font-src",
  "connect-src": "connect-src",
  "frame-src": "frame-src",
  "media-src": "media-src",
  "worker-src": "worker-src",
  "manifest-src": "manifest-src",
};

/**
 * `blocked-uri` is either a full URL or one of `inline`, `eval`, `data`,
 * `blob`, `self`. Only the host is useful, and it must never be echoed raw into
 * a suggestion: a `;` in an attacker-supplied value would inject a directive.
 */
export function hostOf(blockedUri: string | null): string | null {
  if (!blockedUri) return null;
  if (!blockedUri.includes("://")) return blockedUri; // inline / eval / data / blob
  try {
    const url = new URL(blockedUri);
    // Scheme + host only: no path, no query.
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export /**
 * CSP keywords that are never valid as a source expression in a directive list.
 *
 * `inline` is the important one: `blocked-uri: inline` means an inline script or
 * style was refused, and suggesting `script-src inline` produces a policy that is
 * syntactically valid but ignores the token — the violation would continue and
 * the advice would look like it had been followed.
 */
const NOT_A_SOURCE = new Set(["inline", "eval", "wasm-eval"]);

export function suggestionFor(directive: string, hosts: string[]): string {
  const target = SOURCE_DIRECTIVE[directive] ?? directive;
  const clean = hosts.filter((h) => h.length > 0 && !NOT_A_SOURCE.has(h) && !/[\s;'"]/.test(h));
  if (clean.length === 0) {
    return `${target} ... (sem host útil: ${directive} bloqueou algo sem origem — provavelmente 'unsafe-inline' ou um nonce faltando)`;
  }
  return `${target} ${clean.join(" ")}`;
}

/**
 * Human-readable version, for a server log or a CLI check.
 *
 * Deliberately plain text: the audience is whoever is deciding whether to flip
 * `CSP_MODE=enforce`, and that decision gets made from a terminal.
 */
export function formatCspSummary(summary: CspReportSummary): string {
  if (summary.safeToEnforce) {
    return `Nenhuma violação de CSP nos últimos ${summary.windowDays} dias. Seguro para CSP_MODE=enforce.`;
  }

  const lines = [
    `${summary.total} violações em ${summary.windowDays} dias (${summary.directives.length} diretivas):`,
    "",
  ];

  for (const d of summary.directives) {
    lines.push(`  ${d.directive}  ×${d.count}`);
    if (d.hosts.length > 0) lines.push(`    hosts: ${d.hosts.join(", ")}`);
    lines.push(`    se for legítimo: ${d.suggestion}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
