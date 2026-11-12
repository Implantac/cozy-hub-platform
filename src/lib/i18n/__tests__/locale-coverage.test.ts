import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import pt from "../locales/pt-BR.json";
import en from "../locales/en-US.json";

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (!value || typeof value !== "object") return {};
  return Object.assign(
    {},
    ...Object.entries(value).map(([key, child]) =>
      flatten(child, prefix ? `${prefix}.${key}` : key),
    ),
  );
}
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "__tests__") return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
const locales = { "pt-BR": flatten(pt), "en-US": flatten(en) };

describe("shipped locale coverage", () => {
  it("ships the same nonempty string keys in Portuguese and English", () => {
    expect(Object.keys(locales["pt-BR"]).sort()).toEqual(Object.keys(locales["en-US"]).sort());
    for (const [lang, strings] of Object.entries(locales)) {
      expect(
        Object.entries(strings).filter(([, value]) => !value.trim()),
        lang,
      ).toEqual([]);
    }
  });
  it("keeps interpolation names compatible between languages", () => {
    const placeholders = (value: string) =>
      [...value.matchAll(/{{\s*([^}]+)\s*}}/g)].map((m) => m[1].trim()).sort();
    for (const key of Object.keys(locales["pt-BR"])) {
      expect(placeholders(locales["pt-BR"][key]), key).toEqual(placeholders(locales["en-US"][key]));
    }
  });
  it("resolves every literal t key used by authored runtime source", () => {
    const missing: string[] = [];
    for (const path of sourceFiles(fileURLToPath(new URL("../../../", import.meta.url)))) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/(?<![\w])t\(\s*["']([^"']+)["']/g)) {
        for (const [lang, strings] of Object.entries(locales)) {
          if (!(match[1] in strings)) missing.push(`${lang}: ${match[1]} (${path})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
