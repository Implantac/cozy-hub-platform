import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { Plugin } from "vite";

/**
 * Rewrites `import { Foo } from "lucide-react"` into per-icon imports at build time.
 *
 * Why: the lucide barrel re-exports ~1,900 icon modules. Rollup parses every one of
 * them in each build environment (client, ssr, nitro) before tree-shaking, which
 * roughly doubled the module graph and pushed the production build past the
 * deploy machine's memory limit. Importing icon files directly keeps the graph to
 * the icons the app actually uses. Output is identical; source files are untouched.
 *
 * Names not found in the barrel (and type-only imports) are left on "lucide-react".
 */
export function lucideDirectImports(): Plugin {
  let iconFiles: Map<string, string> | null = null;

  const load = () => {
    if (iconFiles) return iconFiles;
    iconFiles = new Map();
    const require = createRequire(import.meta.url);
    const pkgDir = path.dirname(require.resolve("lucide-react/package.json"));
    const barrel = fs.readFileSync(path.join(pkgDir, "dist/esm/lucide-react.js"), "utf8");
    for (const m of barrel.matchAll(/export\s*\{([^}]*)\}\s*from\s*'\.\/icons\/([^']+)'/g)) {
      for (const part of m[1].split(",")) {
        const name = part.trim().match(/^default as (\w+)$/)?.[1];
        if (name) iconFiles.set(name, m[2]);
      }
    }
    return iconFiles;
  };

  return {
    name: "velt:lucide-direct-imports",
    apply: "build",
    enforce: "pre",
    transform(code, id) {
      if (id.includes("node_modules") || !/\.[cm]?[jt]sx?$/.test(id.split("?")[0])) return null;
      if (!code.includes("lucide-react")) return null;
      const map = load();
      let changed = false;

      const out = code.replace(
        /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["'];?/g,
        (full, specs: string) => {
          const direct: string[] = [];
          const keepTypes: string[] = [];
          const keepValues: string[] = [];
          for (const raw of specs.split(",")) {
            const s = raw.trim();
            if (!s) continue;
            if (s.startsWith("type ")) {
              keepTypes.push(s.slice(5).trim());
              continue;
            }
            const [imported, local = imported] = s.split(/\s+as\s+/).map((x) => x.trim());
            const file = map.get(imported);
            if (file) direct.push(`import ${local} from "lucide-react/dist/esm/icons/${file}";`);
            else keepValues.push(s);
          }
          if (direct.length === 0) return full;
          changed = true;
          const lines = [...direct];
          if (keepTypes.length)
            lines.push(`import type { ${keepTypes.join(", ")} } from "lucide-react";`);
          if (keepValues.length)
            lines.push(`import { ${keepValues.join(", ")} } from "lucide-react";`);
          return lines.join(" ");
        },
      );

      return changed ? { code: out, map: null } : null;
    },
  };
}
