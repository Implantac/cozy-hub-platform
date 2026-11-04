import { describe, expect, it } from "vitest";
import { estimateNarrationSeconds, isRenderOutdated } from "../editor";

describe("Studio editor planning", () => {
  it("estimates speech time from word count without pretending to measure audio", () => {
    expect(estimateNarrationSeconds("  \n ")).toBe(0);
    expect(estimateNarrationSeconds(Array(140).fill("palavra").join(" "))).toBe(60);
    expect(estimateNarrationSeconds("um\n   dois")).toBe(1);
  });

  it("flags title and narration changes but ignores insignificant surrounding whitespace", () => {
    const saved = { title: "Dica", narration: "Primeiro passo." };
    expect(isRenderOutdated(null, saved)).toBe(false);
    expect(isRenderOutdated(saved, { title: " Dica ", narration: "Primeiro passo.\n" })).toBe(
      false,
    );
    expect(isRenderOutdated(saved, { ...saved, title: "Outra dica" })).toBe(true);
    expect(isRenderOutdated(saved, { ...saved, narration: "Segundo passo." })).toBe(true);
  });
});
