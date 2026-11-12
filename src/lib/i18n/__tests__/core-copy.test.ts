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
  "analytics",
  "settings",
] as const;

function strings(value: unknown, path = ""): Record<string, string> {
  if (typeof value === "string") return { [path]: value };
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Unexpected translation at ${path}`);
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      Object.entries(strings(child, path ? `${path}.${key}` : key)),
    ),
  );
}

describe("core workflow translations", () => {
  it.each(sections)("ships equivalent non-empty %s copy in both languages", (section) => {
    const pt = strings(ptBR[section]);
    const en = strings(enUS[section]);
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
    for (const [key, value] of Object.entries(pt)) {
      const translated = en[key];
      expect(value.trim()).not.toBe("");
      expect(translated.trim()).not.toBe("");
      const tokens = (text: string) =>
        [...text.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1]).sort();
      expect(tokens(value), `${section}.${key}`).toEqual(tokens(translated));
    }
  });
});
