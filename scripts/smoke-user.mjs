#!/usr/bin/env node
/** Read-only browser regression against a real environment. Never seeds browser storage. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.VELT_QA_BASE_URL;
const email = process.env.VELT_QA_EMAIL;
const password = process.env.VELT_QA_PASSWORD;
if (!base || !email || !password) {
  console.error(
    "Configure VELT_QA_BASE_URL, VELT_QA_EMAIL e VELT_QA_PASSWORD no ambiente. Use uma conta de teste com onboarding concluído.",
  );
  process.exit(1);
}
const output = path.resolve(process.env.VELT_QA_OUTPUT_DIR || ".qa-artifacts/browser");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = {
  base,
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  accessibility: [],
};
let currentPage;

function observe(page) {
  page.on("pageerror", (error) => evidence.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") evidence.errors.push(message.text());
  });
}
async function login(page) {
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.locator('form button[type="submit"]').click();
}
async function scan(page, label) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  evidence.accessibility.push({
    label,
    violations: results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })),
  });
}

try {
  for (const mobile of process.env.VELT_QA_DEVICE === "desktop"
    ? [false]
    : process.env.VELT_QA_DEVICE === "mobile"
      ? [true]
      : [false, true]) {
    const context = await browser.newContext({
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    currentPage = page;
    observe(page);
    const device = mobile ? "mobile" : "desktop";
    const destination = mobile ? "/app/content?from=qa#draft-composer" : "/app";
    await page.goto(`${base}${destination}`, { waitUntil: "networkidle", timeout: 90_000 });
    await page.locator("#login-email").waitFor({ timeout: 45_000 });
    assert.equal(new URL(page.url()).searchParams.get("redirect"), destination);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("digitalos.current_workspace_id")),
      null,
    );
    await login(page);
    await page.waitForURL((url) => url.pathname === (mobile ? "/app/content" : "/app"), {
      timeout: 60_000,
    });
    await page
      .locator(mobile ? "#draft-composer-heading" : "#getting-started-heading, h1")
      .first()
      .waitFor({ timeout: 60_000 });
    assert.equal(new URL(page.url()).pathname, mobile ? "/app/content" : "/app");
    if (mobile) {
      assert.equal(new URL(page.url()).search, "?from=qa");
      assert.equal(new URL(page.url()).hash, "#draft-composer");
    }
    evidence.checks.push({
      name: `${device}: fresh browser login without workaround`,
      passed: true,
    });

    for (const [route, heading, title] of [
      ["content", "Conteúdo", "Conteúdo · VELT"],
      ["channels", "Canais", "Canais · VELT"],
      ["scheduler", "Agendamento", "Agendamento · VELT"],
      ["analytics", "Métricas, tendências e canais", "Análises · VELT"],
      ["brands", "Marcas", "Marcas · VELT"],
    ]) {
      await page.goto(`${base}/app/${route}`, { waitUntil: "networkidle", timeout: 90_000 });
      await page.getByRole("heading", { name: heading, exact: true }).waitFor({ timeout: 45_000 });
      assert.equal(new URL(page.url()).pathname, `/app/${route}`);
      assert.equal(await page.title(), title);
      await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
      await page.getByRole("heading", { name: heading, exact: true }).waitFor({ timeout: 45_000 });
      assert.equal(new URL(page.url()).pathname, `/app/${route}`);
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1),
        false,
      );
      await scan(page, `${route}-${device}`);
      await page.screenshot({ path: path.join(output, `${route}-${device}.png`), fullPage: true });
      evidence.checks.push({
        name: `${device}: direct link, refresh, title and width for ${route}`,
        passed: true,
      });
      console.log(`PASS ${device} /app/${route}`);
      await fs.writeFile(
        path.join(output, "result-in-progress.json"),
        JSON.stringify(evidence, null, 2),
      );
      if (route === "content") {
        assert.equal(
          await page
            .locator("details")
            .filter({ has: page.locator("#studio-heading") })
            .getAttribute("open"),
          null,
        );
        assert.equal(await page.locator("#draft-title").isVisible(), true);
        assert.equal(await page.locator("#studio-heading").isVisible(), false);
      }
    }
    await context.close();
  }
  assert.equal(evidence.errors.length, 0, "Browser emitted errors; inspect result.json");
  const findings = evidence.accessibility.flatMap((scan) => scan.violations);
  assert.equal(findings.length, 0, "Accessibility findings remain; inspect result.json");
} catch (error) {
  evidence.failure = error.message;
  if (currentPage && !currentPage.isClosed()) {
    await currentPage
      .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
      .catch(() => {});
  }
  process.exitCode = 1;
} finally {
  evidence.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, "result.json"), JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify(
      {
        checks: evidence.checks.length,
        errors: evidence.errors.length,
        scans: evidence.accessibility.length,
        violations: evidence.accessibility.reduce((sum, scan) => sum + scan.violations.length, 0),
        failure: evidence.failure ?? null,
        output,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
