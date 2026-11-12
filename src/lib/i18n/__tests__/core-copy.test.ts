import { describe, expect, it } from "vitest";
import ptBR from "../locales/pt-BR.json";
import enUS from "../locales/en-US.json";

const sections = [
  "portfolio",
  "gettingStarted",
  "content",
  "channels",
  "brands",
  "scheduler",
  "opportunitySource",
] as const;

describe("core workflow translations", () => {
  it.each(sections)("ships equivalent non-empty %s copy in both languages", (section) => {
    const pt = ptBR[section];
    const en = enUS[section];
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(pt)) {
      const translated = (en as Record<string, string>)[key];
      expect(value.trim()).not.toBe("");
      expect(translated.trim()).not.toBe("");
      const tokens = (text: string) =>
        [...text.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]).sort();
      expect(tokens(value), `${section}.${key}`).toEqual(tokens(translated));
    }
  });
});
