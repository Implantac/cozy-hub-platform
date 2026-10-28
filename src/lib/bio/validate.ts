/**
 * VELT — Bio page validation (pure, testable).
 *
 * A bio page is the first *anonymous* surface in the product: anyone with the
 * link can read it, and every link on it is a redirect target. That combination
 * makes this module security-relevant, not cosmetic. Three failure modes are
 * worth more than the rest:
 *
 *   1. **Open redirect.** A user could publish a link to `javascript:` or a
 *      look-alike domain and use VELT's domain to lend it credibility. We accept
 *      only http/https and block the obvious impersonation vectors.
 *   2. **Slug squatting / collisions.** Slugs are the public URL. They must be
 *      normalised deterministically, be reserved-word-safe, and never leak the
 *      workspace id.
 *   3. **Content that gets the domain flagged.** Phishing patterns in labels
 *      plus a public page is how a small SaaS ends up on a browser blocklist.
 *
 * Everything here is a pure function over strings so it can be tested without a
 * database and run both on the server and in the editor UI.
 */

/* ------------------------------------------------------------------ */
/* Slugs                                                               */
/* ------------------------------------------------------------------ */

/** Never assignable: would collide with real routes or imply the product. */
export const RESERVED_SLUGS = new Set([
  "app",
  "api",
  "admin",
  "login",
  "signup",
  "signin",
  "signout",
  "logout",
  "dashboard",
  "settings",
  "help",
  "support",
  "blog",
  "www",
  "mail",
  "email",
  "status",
  "docs",
  "billing",
  "checkout",
  "assets",
  "static",
  "public",
  "bio",
  "velt",
  "lovable",
  "suporte",
  "conta",
  "painel",
]);

const SLUG_MIN = 3;
const SLUG_MAX = 32;

export interface SlugResult {
  ok: boolean;
  slug: string;
  error?: string;
}

/**
 * Normalises arbitrary text into a valid slug.
 *
 * Diacritics are decomposed and stripped so "Café da Bia" becomes "cafe-da-bia"
 * rather than "caf--da-bia" or a percent-encoded URL.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export function validateSlug(input: string): SlugResult {
  const slug = slugify(input);

  if (slug.length < SLUG_MIN) {
    return { ok: false, slug, error: `O link precisa ter pelo menos ${SLUG_MIN} caracteres.` };
  }
  if (slug.length > SLUG_MAX) {
    return { ok: false, slug, error: `O link pode ter no máximo ${SLUG_MAX} caracteres.` };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, slug, error: `"${slug}" é reservado pelo sistema. Escolha outro.` };
  }
  if (/^\d+$/.test(slug)) {
    // All-numeric slugs look like ids and invite enumeration attempts.
    return { ok: false, slug, error: "O link não pode conter apenas números." };
  }
  return { ok: true, slug };
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export type LinkKind = "link" | "whatsapp" | "email" | "phone" | "product";

/**
 * Single source of truth for the kind selector. Ordered by real-world frequency
 * on small-business bio pages: WhatsApp dominates in Brazil, so it leads.
 */
export const LINK_KINDS: ReadonlyArray<{ value: LinkKind; label: string }> = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "link", label: "Link" },
  { value: "product", label: "Produto" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
];

export interface LinkValidation {
  ok: boolean;
  /** Normalised href to store. */
  href: string;
  error?: string;
}

/**
 * Validates and normalises a destination.
 *
 * Only http(s) is allowed. `javascript:`, `data:`, `file:` and protocol-relative
 * URLs are rejected outright — a public redirect endpoint that accepts those is
 * a phishing primitive.
 */
export function validateLinkUrl(raw: string): LinkValidation {
  const value = raw.trim();
  if (!value) return { ok: false, href: "", error: "Informe um destino para o link." };
  if (value.length > 2000) return { ok: false, href: "", error: "URL muito longa." };

  // Protocol-relative ("//evil.com") resolves to http(s) of the current origin
  // in a browser — but only if we let it through, so we don't.
  if (value.startsWith("//")) {
    return { ok: false, href: "", error: "Use a URL completa, começando com https://" };
  }

  let withProtocol = value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    // Bare domain: assume https rather than failing. Users type "cafe.com.br".
    withProtocol = `https://${value}`;
  }

  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, href: "", error: "URL inválida." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, href: "", error: "Somente links http ou https são permitidos." };
  }
  if (!url.hostname.includes(".")) {
    return { ok: false, href: "", error: "Domínio inválido." };
  }
  // Credentials in the URL are a classic obfuscation trick ("https://bradesco.com@evil.io").
  if (url.username || url.password) {
    return { ok: false, href: "", error: "Links com usuário/senha embutidos não são permitidos." };
  }

  // Upgrade plain http to https: a public page served over TLS linking to http
  // triggers mixed-content warnings and looks untrustworthy.
  if (url.protocol === "http:") url.protocol = "https:";

  return { ok: true, href: url.toString() };
}

/** WhatsApp deep link from a raw phone number. */
export function whatsappHref(rawPhone: string, message?: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  const base = `https://wa.me/${withCountry}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Builds the destination for a link given its kind. */
export function buildHref(
  kind: LinkKind,
  raw: string,
  extras?: { message?: string },
): LinkValidation {
  switch (kind) {
    case "whatsapp": {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10) {
        return { ok: false, href: "", error: "Telefone incompleto: inclua DDD." };
      }
      return { ok: true, href: whatsappHref(digits, extras?.message) };
    }
    case "email": {
      const email = raw.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return { ok: false, href: "", error: "E-mail inválido." };
      }
      return { ok: true, href: mailtoHref(email) };
    }
    case "phone": {
      const digits = raw.replace(/\D/g, "");
      if (digits.length < 10) {
        return { ok: false, href: "", error: "Telefone incompleto: inclua DDD." };
      }
      return { ok: true, href: telHref(digits) };
    }
    default:
      return validateLinkUrl(raw);
  }
}

/* ------------------------------------------------------------------ */
/* Content safety                                                      */
/* ------------------------------------------------------------------ */

/**
 * Labels and copy that get a shared domain blocklisted. This is a heuristic
 * guardrail for the *editor*, not a content moderation system — the goal is to
 * stop the obvious cases (fake prize, fake bank notice, credential requests)
 * before they reach a public URL under our domain.
 */
const RISKY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(urgente|imediat[oa])\b.*\b(bloque|suspend|cancel)/i,
    reason: "Alerta falso de bloqueio/suspensão de conta",
  },
  {
    re: /\b(parab[ée]ns|voc[êe] (foi|ganhou)).{0,30}\b(pr[êe]mio|sorteio|premiado)/i,
    reason: "Falso anúncio de prêmio",
  },
  {
    re: /\b(envie|informe|confirme).{0,20}\b(senha|token|c[óo]digo de verifica)/i,
    reason: "Pedido de credenciais",
  },
  {
    re: /\b(pix|ted|transfer[êe]ncia).{0,20}\b(para liberar|para receber|antecipad)/i,
    reason: "Pedido de pagamento antecipado suspeito",
  },
  {
    re: /\b(cpf|cart[ãa]o de cr[ée]dito)\b.{0,20}\b(complete|informe|envie)/i,
    reason: "Coleta de dados sensíveis",
  },
];

export interface ContentSafety {
  ok: boolean;
  flags: Array<{ reason: string; field: string }>;
}

export function checkContentSafety(
  fields: Record<string, string | null | undefined>,
): ContentSafety {
  const flags: Array<{ reason: string; field: string }> = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    for (const { re, reason } of RISKY_PATTERNS) {
      if (re.test(value)) flags.push({ reason, field });
    }
  }
  return { ok: flags.length === 0, flags };
}

/* ------------------------------------------------------------------ */
/* Device / referrer normalisation (privacy-preserving analytics)      */
/* ------------------------------------------------------------------ */

export function deviceFromUserAgent(
  ua: string | null | undefined,
): "mobile" | "desktop" | "tablet" | "other" {
  if (!ua) return "other";
  if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  if (/windows nt|macintosh|linux/i.test(ua)) return "desktop";
  return "other";
}

/**
 * Reduces a referrer to its host. Storing the full URL would capture search
 * queries and private paths — data we have no reason to hold.
 */
export function referrerHostOnly(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    // Do not record our own pages as a referrer.
    if (/(^|\.)velt\.app$|localhost/.test(url.hostname)) return null;
    return url.hostname.slice(0, 120);
  } catch {
    return null;
  }
}
