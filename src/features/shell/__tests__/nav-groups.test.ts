import { describe, expect, it } from "vitest";
import { NAV_GROUPS, isItemActive } from "../nav-groups";

describe("navigation for the first-time workflow", () => {
  it("puts the essential publishing path first and keeps specialist tools secondary", () => {
    const core = NAV_GROUPS.find((group) => group.core);
    expect(core?.items.map((item) => item.to)).toEqual([
      "/app",
      "/app/channels",
      "/app/content",
      "/app/scheduler",
      "/app/analytics",
    ]);
    expect(NAV_GROUPS[0]).toBe(core);
    expect(NAV_GROUPS.filter((group) => !group.core).flatMap((group) => group.items)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: "/app/brain-lab" }),
        expect.objectContaining({ to: "/app/competitors" }),
      ]),
    );
  });

  it("keeps every route discoverable exactly once across all menu groups", () => {
    const routes = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.to));
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("matches nested routes without confusing similarly named pages", () => {
    const brain = NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.to === "/app/brain",
    );
    const brainLab = NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.to === "/app/brain-lab",
    );
    expect(brain && isItemActive("/app/brain", brain)).toBe(true);
    expect(brain && isItemActive("/app/brain-lab", brain)).toBe(false);
    expect(brainLab && isItemActive("/app/brain-lab", brainLab)).toBe(true);
  });
});
