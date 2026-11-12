import { describe, expect, it } from "vitest";
import {
  displayNameSchema,
  DISPLAY_NAME_MAX_LENGTH,
  profileQueryKey,
  profileUpdateSchema,
} from "../profile";

describe("user-scoped profile editing", () => {
  it("uses the same cache namespace as shell bootstrap, scoped to the user", () => {
    expect(profileQueryKey("owner-a")).toEqual(["my-profile", "owner-a"]);
    expect(profileQueryKey("owner-a")).not.toEqual(profileQueryKey("owner-b"));
    expect(profileQueryKey(undefined)).toEqual(["my-profile", undefined]);
  });
  it("trims a name consistently at the UI and API boundary", () => {
    expect(displayNameSchema.parse("  Ana Silva  ")).toBe("Ana Silva");
    expect(profileUpdateSchema.parse({ display_name: "  Ana Silva  " }).display_name).toBe(
      "Ana Silva",
    );
  });
  it.each(["", " ", "\t\n"])("rejects blank names %j", (value) => {
    expect(displayNameSchema.safeParse(value).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ display_name: value }).success).toBe(false);
  });
  it("enforces the existing 80-character server limit", () => {
    expect(DISPLAY_NAME_MAX_LENGTH).toBe(80);
    expect(displayNameSchema.safeParse("a".repeat(80)).success).toBe(true);
    expect(displayNameSchema.safeParse("a".repeat(81)).success).toBe(false);
  });
  it("retains existing optional profile fields and strips caller-supplied identity", () => {
    expect(
      profileUpdateSchema.parse({ locale: "pt-BR", avatar_url: null, id: "someone-else" }),
    ).toEqual({ locale: "pt-BR", avatar_url: null });
  });
});
