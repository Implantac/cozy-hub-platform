import { describe, expect, it } from "vitest";
import {
  buildHref,
  checkContentSafety,
  deviceFromUserAgent,
  referrerHostOnly,
  RESERVED_SLUGS,
  slugify,
  validateLinkUrl,
  validateSlug,
  whatsappHref,
} from "@/lib/bio/validate";

describe("slugify", () => {
  it("strips diacritics instead of dropping the letter", () => {
    expect(slugify("Café da Bia")).toBe("cafe-da-bia");
    expect(slugify("Ação & Reação")).toBe("acao-reacao");
  });

  it("collapses separators and trims edges", () => {
    expect(slugify("  --Loja   da  Esquina-- ")).toBe("loja-da-esquina");
  });

  it("caps length", () => {
    expect(slugify("a".repeat(80)).length).toBe(32);
  });

  it("handles emoji and symbols without producing empty slugs", () => {
    expect(slugify("☕ Café ☕")).toBe("cafe");
  });
});

describe("validateSlug", () => {
  it("accepts a normal business slug", () => {
    expect(validateSlug("cafe-da-bia").ok).toBe(true);
  });

  it("rejects reserved words that would shadow real routes", () => {
    for (const reserved of ["app", "admin", "login", "velt", "api"]) {
      const r = validateSlug(reserved);
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/reservado/);
    }
    expect(RESERVED_SLUGS.has("velt")).toBe(true);
  });

  it("rejects numeric-only slugs that look like ids", () => {
    expect(validateSlug("123456").ok).toBe(false);
  });

  it("rejects slugs below the minimum length", () => {
    expect(validateSlug("ab").ok).toBe(false);
  });

  it("normalises before validating, so casing is not a bypass", () => {
    expect(validateSlug("ADMIN").ok).toBe(false);
    expect(validateSlug("Admin").slug).toBe("admin");
  });
});

describe("validateLinkUrl", () => {
  it("accepts https and bare domains", () => {
    expect(validateLinkUrl("https://cafe.com.br/menu").ok).toBe(true);
    const bare = validateLinkUrl("cafe.com.br");
    expect(bare.ok).toBe(true);
    expect(bare.href).toBe("https://cafe.com.br/");
  });

  it("upgrades http to https", () => {
    const r = validateLinkUrl("http://cafe.com.br");
    expect(r.ok).toBe(true);
    expect(r.href.startsWith("https://")).toBe(true);
  });

  it("blocks javascript: and data: payloads", () => {
    // A public redirect endpoint that accepts these is a phishing primitive.
    expect(validateLinkUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateLinkUrl("data:text/html;base64,PHNjcmlwdD4=").ok).toBe(false);
    expect(validateLinkUrl("file:///etc/passwd").ok).toBe(false);
  });

  it("blocks protocol-relative URLs", () => {
    expect(validateLinkUrl("//evil.com/login").ok).toBe(false);
  });

  it("blocks credentials embedded in the URL", () => {
    const r = validateLinkUrl("https://bradesco.com@evil.io/login");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/usuário\/senha/);
  });

  it("rejects hosts without a dot", () => {
    expect(validateLinkUrl("https://localhost/admin").ok).toBe(false);
  });

  it("rejects empty input and absurd lengths", () => {
    expect(validateLinkUrl("   ").ok).toBe(false);
    expect(validateLinkUrl(`https://a.com/${"x".repeat(2100)}`).ok).toBe(false);
  });
});

describe("buildHref", () => {
  it("builds a WhatsApp deep link with the country code added once", () => {
    const r = buildHref("whatsapp", "(11) 99999-0000");
    expect(r.ok).toBe(true);
    expect(r.href).toBe("https://wa.me/5511999990000");
  });

  it("does not duplicate the 55 country code", () => {
    expect(buildHref("whatsapp", "5511999990000").href).toBe("https://wa.me/5511999990000");
  });

  it("percent-encodes a prefilled WhatsApp message", () => {
    const r = buildHref("whatsapp", "11999990000", { message: "Olá, quero o menu" });
    expect(r.href).toContain("?text=Ol%C3%A1%2C%20quero%20o%20menu");
  });

  it("rejects an incomplete phone number", () => {
    expect(buildHref("whatsapp", "9999-0000").ok).toBe(false);
  });

  it("validates e-mail format", () => {
    expect(buildHref("email", "contato@cafe.com.br").href).toBe("mailto:contato@cafe.com.br");
    expect(buildHref("email", "nao-e-email").ok).toBe(false);
  });

  it("builds tel: links without spaces", () => {
    expect(buildHref("phone", "(11) 3333-4444").href).toBe("tel:1133334444");
  });

  it("falls back to URL validation for regular links", () => {
    expect(buildHref("link", "example.com").ok).toBe(true);
  });
});

describe("whatsappHref", () => {
  it("strips formatting characters", () => {
    expect(whatsappHref("+55 (11) 98888-7777")).toBe("https://wa.me/5511988887777");
  });
});

describe("checkContentSafety", () => {
  it("flags a fake prize announcement", () => {
    const r = checkContentSafety({ label: "Parabéns, você foi premiado!" });
    expect(r.ok).toBe(false);
    expect(r.flags[0].reason).toMatch(/prêmio/i);
  });

  it("flags a request for credentials", () => {
    const r = checkContentSafety({ bio: "Informe sua senha para liberar o acesso" });
    expect(r.ok).toBe(false);
  });

  it("flags an urgent suspension notice", () => {
    const r = checkContentSafety({ headline: "URGENTE: sua conta será bloqueada" });
    expect(r.ok).toBe(false);
  });

  it("allows ordinary business copy, including the word 'urgente' alone", () => {
    expect(checkContentSafety({ bio: "Café artesanal no centro de SP. Aberto até 18h." }).ok).toBe(
      true,
    );
    expect(checkContentSafety({ bio: "Entrega urgente de café no escritório." }).ok).toBe(true);
  });

  it("ignores empty fields", () => {
    expect(checkContentSafety({ a: null, b: undefined, c: "" }).ok).toBe(true);
  });
});

describe("privacy helpers", () => {
  it("classifies devices from user agent", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone) Mobile")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad) Safari")).toBe("tablet");
    expect(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome")).toBe("desktop");
    expect(deviceFromUserAgent(null)).toBe("other");
  });

  it("keeps only the referrer host, never the full URL", () => {
    expect(referrerHostOnly("https://www.instagram.com/stories/abc?utm=1")).toBe(
      "www.instagram.com",
    );
  });

  it("drops our own origin from the referrer", () => {
    expect(referrerHostOnly("https://velt.app/bio/cafe")).toBeNull();
  });

  it("returns null for malformed referrers", () => {
    expect(referrerHostOnly("not a url")).toBeNull();
  });
});
