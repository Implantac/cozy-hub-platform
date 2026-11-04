import { describe, expect, it } from "vitest";
import {
  studioBriefSchema,
  studioScriptSchema,
  saveStudioDraftSchema,
  studioMetadataSchema,
} from "../schema";

const workspaceId = "c32b66e4-1fc1-4b25-92e7-1b690218f453";
const brief = {
  workspaceId,
  topic: "Planilhas",
  audience: "MEIs",
  goal: "Ensinar",
  sourceMaterial: "",
  platform: "youtube",
  duration: "30",
  tone: "educational",
  language: "pt-BR",
};
const script = {
  title: "Título",
  hook: "Gancho",
  narration: "Narração",
  scenes: "Cena",
  callToAction: "Ação",
  caption: "Legenda",
};

describe("Studio validation", () => {
  it("accepts a complete briefing and editable script", () => {
    expect(studioBriefSchema.safeParse(brief).success).toBe(true);
    expect(studioScriptSchema.safeParse(script).success).toBe(true);
    expect(studioMetadataSchema.safeParse({ studio: { version: 1, brief, script } }).success).toBe(
      true,
    );
  });
  it("rejects blank fields, unsupported networks and oversized source material", () => {
    expect(studioBriefSchema.safeParse({ ...brief, topic: " " }).success).toBe(false);
    expect(studioBriefSchema.safeParse({ ...brief, platform: "other" }).success).toBe(false);
    expect(
      studioBriefSchema.safeParse({ ...brief, sourceMaterial: "x".repeat(5001) }).success,
    ).toBe(false);
  });
  it("rejects missing or oversized output and mismatched workspaces", () => {
    expect(studioScriptSchema.safeParse({ ...script, narration: "" }).success).toBe(false);
    expect(studioScriptSchema.safeParse({ ...script, title: "x".repeat(201) }).success).toBe(false);
    expect(
      saveStudioDraftSchema.safeParse({
        workspaceId: "7e6bcb6d-fb76-4604-a8b4-8bf3bfc9b53c",
        brief,
        script,
      }).success,
    ).toBe(false);
  });
});
