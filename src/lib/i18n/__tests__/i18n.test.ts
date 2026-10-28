import { describe, expect, it, vi } from "vitest";

/**
 * The case that matters is the stored code: a user who picked `de` back when the
 * selector offered sixteen languages still has `"de"` in `localStorage` on every
 * subsequent visit. Trusting that dead code leaves the app on the fallback with
 * no way to tell why.
 *
 * These call `detectInitialLang` directly rather than reading `i18n.language`:
 * the i18next instance is a module-level singleton in `node_modules`, and
 * `vi.resetModules()` does not recreate it, so the second import would observe
 * the first test's choice. Testing the decision is both simpler and the part
 * that can actually be wrong.
 */

function stubBrowser(stored: string | null, navigatorLanguage: string) {
  const store = new Map<string, string>();
  if (stored !== null) store.set("use-os:lang", stored);

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    navigator: { language: navigatorLanguage },
  });
  vi.stubGlobal("document", { documentElement: { lang: "", dir: "" } });
}

async function resolveLanguage(stored: string | null, navigatorLanguage: string) {
  stubBrowser(stored, navigatorLanguage);
  vi.resetModules();
  const mod = await import("@/lib/i18n");
  return { language: mod.detectInitialLang(), supported: mod.SUPPORTED_LANGUAGES };
}

describe("i18n language resolution", () => {
  it("offers exactly the languages that have translations", async () => {
    const { supported } = await resolveLanguage(null, "pt-BR");
    expect(supported.map((l) => l.code)).toEqual(["pt-BR", "en-US"]);
  });

  it("honours a stored choice that is still offered", async () => {
    const { language } = await resolveLanguage("en-US", "pt-BR");
    expect(language).toBe("en-US");
  });

  it("ignores a stored choice from a language that is no longer offered", async () => {
    // The bug this prevents: `"de"` is not in the list anymore. Trusting it
    // leaves the UI on the fallback with the selector showing nothing valid.
    for (const dead of ["de", "ja", "ar", "zh-CN", "sv"]) {
      const { language } = await resolveLanguage(dead, "pt-BR");
      expect(language, `stored ${dead}`).toBe("pt-BR");
    }
  });

  it("maps a regional browser preference to its base language", async () => {
    expect((await resolveLanguage(null, "pt-PT")).language).toBe("pt-BR");
    expect((await resolveLanguage(null, "en-GB")).language).toBe("en-US");
  });

  it("falls back to pt-BR for an unsupported browser language", async () => {
    expect((await resolveLanguage(null, "ja-JP")).language).toBe("pt-BR");
  });

  it("prefers the stored choice over the browser preference", async () => {
    expect((await resolveLanguage("pt-BR", "en-US")).language).toBe("pt-BR");
  });

  it("resolves actual strings for a sample of keys in both languages", async () => {
    stubBrowser(null, "pt-BR");
    vi.resetModules();
    const { default: i18n } = await import("@/lib/i18n");
    const pt = i18n.getFixedT("pt-BR");
    const en = i18n.getFixedT("en-US");

    // A missing key renders as the key itself, which is how "translated" UI ends
    // up showing `nav.dashboard` to a customer.
    for (const key of ["nav.dashboard", "nav.analytics", "common.language"]) {
      expect(pt(key), `pt-BR ${key}`).not.toBe(key);
      expect(en(key), `en-US ${key}`).not.toBe(key);
    }
    expect(pt("nav.dashboard")).not.toBe(en("nav.dashboard"));
  });

  it("flags right-to-left locales by base code", async () => {
    vi.resetModules();
    stubBrowser(null, "pt-BR");
    const { isRtl } = await import("@/lib/i18n");
    expect(isRtl("ar")).toBe(true);
    expect(isRtl("ar-SA")).toBe(true);
    expect(isRtl("pt-BR")).toBe(false);
    expect(isRtl("en-US")).toBe(false);
  });
});
