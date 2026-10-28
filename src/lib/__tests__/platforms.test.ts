import { describe, expect, it } from "vitest";

import {
  PLATFORMS,
  PLATFORM_LABELS,
  isPlatform,
  priorityPlatformsFor,
  type Platform,
} from "@/lib/platforms";

/**
 * The invariant this file protects: everything the product offers as a channel
 * must be publishable. Before, the Brain recommended `whatsapp` and `twitter` —
 * neither exists in the database enum, neither has a publisher, and both were
 * typed as plain strings so nothing complained.
 */

describe("platform registry", () => {
  it("matches the database enum exactly", () => {
    // Hardcoded on purpose. If the enum gains a value, this fails and forces a
    // decision here — instead of the new platform silently missing from the UI.
    expect([...PLATFORMS].sort()).toEqual(
      ["facebook", "google_business", "instagram", "linkedin", "tiktok", "youtube"].sort(),
    );
  });

  it("has a display label for every platform", () => {
    for (const platform of PLATFORMS) {
      expect(PLATFORM_LABELS[platform], platform).toBeTruthy();
    }
  });

  it("recognises real platforms and rejects invented ones", () => {
    expect(isPlatform("instagram")).toBe(true);
    expect(isPlatform("google_business")).toBe(true);
    for (const fake of ["whatsapp", "twitter", "threads", "pinterest", "Instagram", ""]) {
      expect(isPlatform(fake), fake).toBe(false);
    }
  });

  it("never recommends a channel the product cannot publish to", () => {
    const paths = [
      "local_business",
      "content_creator",
      "affiliate",
      "digital_services",
      "saas_builder",
      "agency",
      "freelancer",
      "ecommerce",
    ];
    for (const path of paths) {
      const suggested = priorityPlatformsFor(path);
      expect(suggested.length, `${path} should suggest something`).toBeGreaterThan(0);
      for (const platform of suggested) {
        expect(isPlatform(platform), `${path} suggests ${platform}`).toBe(true);
      }
    }
  });

  it("no longer recommends whatsapp or twitter", () => {
    // The two that were wrong. Asserted by name so a future edit has to face them.
    for (const path of ["local_business", "saas_builder"]) {
      const suggested: readonly Platform[] = priorityPlatformsFor(path);
      expect(suggested).not.toContain("whatsapp" as Platform);
      expect(suggested).not.toContain("twitter" as Platform);
    }
  });

  it("returns nothing for an unknown or absent business path", () => {
    expect(priorityPlatformsFor(undefined)).toEqual([]);
    expect(priorityPlatformsFor("nao_existe")).toEqual([]);
  });

  it("puts google_business first for a business with a physical location", () => {
    // A local business lives and dies by its map listing; the order is part of
    // the recommendation, not a detail.
    expect(priorityPlatformsFor("local_business")[0]).toBe("google_business");
  });
});
