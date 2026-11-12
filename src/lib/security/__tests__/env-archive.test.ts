import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("../../../../scripts/check-env.mjs", import.meta.url));
function inspectArchive(content: string) {
  const directory = mkdtempSync(join(tmpdir(), "velt-env-archive-"));
  try {
    writeFileSync(join(directory, ".env"), content);
    return spawnSync(process.execPath, [script], { cwd: directory, encoding: "utf8" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("environment guard in source archives without git metadata", () => {
  it("permits public configuration", () => {
    expect(
      inspectArchive('VITE_SUPABASE_URL="https://example.supabase.co"\nVITE_PORTFOLIO_MODE=true\n')
        .status,
    ).toBe(0);
  });
  it("fails closed on a server-only credential without printing its value", () => {
    const value = "test-credential-do-not-print";
    const result = inspectArchive(`CRON_SECRET="${value}"\n`);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CRON_SECRET");
    expect(result.stderr).not.toContain(value);
  });
});
