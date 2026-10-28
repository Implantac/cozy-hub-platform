import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * End-to-end test of the AI coach with a *fake model*.
 *
 * The point is not that the model works. It is that the product is safe when the
 * model is bad. These tests wire a stubbed gateway that returns exactly the kind
 * of output an LLM produces when it is confidently wrong — and assert that the
 * user sees nothing.
 */

const WEAK_DRAFT = `Oi gente, hoje eu vim falar um pouquinho do nosso novo pão de fermentação natural.

Passa lá na padaria!`;
const GOOD_REWRITE = `Fermentação de 24h: o pão chega quentinho às 7h na Vila Nova.

Passa lá na padaria!`;

const gateway = {
  respond: null as null | (() => Promise<unknown>),
  calls: 0,
  lastArgs: null as null | { system: string; user: string },
};

vi.mock("@/lib/api/_ai-gateway.server", () => ({
  callAITool: async (args: { system: string; user: string }) => {
    gateway.calls++;
    gateway.lastArgs = args;
    if (!gateway.respond) throw new Error("no responder configured");
    return gateway.respond();
  },
}));

const { coachDraft } = await import("@/lib/growth/coach.server");
const originalKey = process.env.LOVABLE_API_KEY;

beforeEach(() => {
  gateway.calls = 0;
  gateway.respond = null;
  gateway.lastArgs = null;
  process.env.LOVABLE_API_KEY = "test-key";
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.LOVABLE_API_KEY;
  else process.env.LOVABLE_API_KEY = originalKey;
});

describe("coachDraft — when the model is good", () => {
  it("returns a verified rewrite with the engine's score, not the model's", async () => {
    gateway.respond = async () => ({
      data: {
        rewrites: [
          {
            body: GOOD_REWRITE,
            rationale: "Abertura com dado concreto.",
            addresses: "hook.weak-opener",
          },
        ],
      },
      model: "test-model",
    });

    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });

    expect(result.source).toBe("ai");
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].score).toBeGreaterThan(0);
    expect(result.suggestions[0].fixed).toContain("hook.weak-opener");
    expect(result.model).toBe("test-model");
  });
});

describe("coachDraft — when the model is bad", () => {
  it("discards a rewrite that keeps the weak opener", async () => {
    gateway.respond = async () => ({
      data: {
        rewrites: [
          {
            body: "Oi gente, o pão novo saiu do forno!",
            rationale: "Deixamos mais direto.",
            addresses: "hook.weak-opener",
          },
        ],
      },
      model: "test-model",
    });

    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(result.suggestions).toHaveLength(0);
    expect(result.skippedReason).toBe("all_rejected");
  });

  it("discards a rewrite that cites an issue the draft does not have", async () => {
    gateway.respond = async () => ({
      data: {
        rewrites: [{ body: GOOD_REWRITE, rationale: "x", addresses: "link.multiple" }],
      },
      model: "test-model",
    });

    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(result.suggestions).toHaveLength(0);
  });

  it("discards a rewrite that exceeds the platform limit and creates a blocker", async () => {
    const tooLong = "Pão ".repeat(900); // blows past Instagram's 2.200 chars
    gateway.respond = async () => ({
      data: {
        rewrites: [{ body: tooLong, rationale: "Detalhamos mais.", addresses: "hook.weak-opener" }],
      },
      model: "test-model",
    });

    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(result.suggestions).toHaveLength(0);
  });

  it("survives a malformed payload without throwing", async () => {
    gateway.respond = async () => ({ data: { rewrites: "não é um array" }, model: "m" });
    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(result.suggestions).toEqual([]);
    expect(result.skippedReason).toBe("all_rejected");
  });

  it("returns unavailable (not an error) when the gateway throws", async () => {
    gateway.respond = async () => {
      throw new Error("429 rate limited");
    };
    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(result.source).toBe("unavailable");
    expect(result.skippedReason).toBe("model_failed");
    expect(result.suggestions).toEqual([]);
  });
});

describe("coachDraft — when there is nothing to do", () => {
  it("does not spend a model call on a draft with no fixable issues", async () => {
    // A clean draft: strong opener, no blockers.
    const result = await coachDraft({ body: GOOD_REWRITE, platform: "instagram" });
    expect(gateway.calls).toBe(0);
    expect(result.suggestions).toHaveLength(0);
  });

  it("does not call the model without an API key, and says so", async () => {
    delete process.env.LOVABLE_API_KEY;
    const result = await coachDraft({ body: WEAK_DRAFT, platform: "instagram" });
    expect(gateway.calls).toBe(0);
    expect(result.source).toBe("unavailable");
    expect(result.skippedReason).toBe("no_key");
    // The issues are still reported: the deterministic layer is the product.
    expect(result.issueIds.length).toBeGreaterThan(0);
  });
});

describe("coachDraft — brand voice", () => {
  it("passes the brand voice to the model so copy sounds like the business", async () => {
    gateway.respond = async () => ({ data: { rewrites: [] }, model: "m" });

    await coachDraft({
      body: WEAK_DRAFT,
      platform: "instagram",
      brandVoice: { tone: "próximo e caloroso" },
    });

    expect(gateway.lastArgs?.user).toContain("próximo e caloroso");
    // The diagnosed issues and the platform limits travel with the prompt:
    // the model is never asked for an open-ended critique. The platform goes as
    // its human label ("Instagram") plus the numeric limits, which is what the
    // model needs to respect the 125-char collapse.
    expect(gateway.lastArgs?.user).toContain("hook.weak-opener");
    expect(gateway.lastArgs?.user).toContain("Instagram");
    expect(gateway.lastArgs?.user).toContain("trecho_visivel_antes_do_corte");
  });
});
