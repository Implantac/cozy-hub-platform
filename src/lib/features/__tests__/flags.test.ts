import { describe, expect, it, vi } from "vitest";

/**
 * The flag module reads `import.meta.env` at module load, so each scenario needs
 * a fresh module instance. `vi.resetModules()` plus a dynamic import gives that,
 * and lets us assert the part that matters: what happens when the variable is
 * absent, empty, garbage or explicitly true.
 */

async function loadFlags(value: string | undefined) {
  const original = import.meta.env.VITE_FLAG_COMMERCE;
  // @ts-expect-error -- the env record is readonly by design; test-only mutation.
  import.meta.env.VITE_FLAG_COMMERCE = value;
  // Without this the module stays cached and every scenario after the first
  // reads the value from the previous one.
  vi.resetModules();
  const mod = await import("@/lib/features/flags");
  return {
    ...mod,
    restore: () => {
      // @ts-expect-error -- same reason.
      import.meta.env.VITE_FLAG_COMMERCE = original;
    },
  };
}

describe("feature flags", () => {
  it("is off when the variable is absent", async () => {
    const { FEATURES, restore } = await loadFlags(undefined);
    try {
      expect(FEATURES.commerce).toBe(false);
    } finally {
      restore();
    }
  });

  it("is off for an empty string", async () => {
    const { FEATURES, restore } = await loadFlags("");
    try {
      expect(FEATURES.commerce).toBe(false);
    } finally {
      restore();
    }
  });

  it("is off for a value that merely looks true", async () => {
    // "1", "yes" and "on" are the strings people reach for by habit. Accepting
    // them would mean a flag opens by accident; failing closed is the point.
    for (const value of ["1", "yes", "on", "TRUE!", " false"]) {
      const { FEATURES, restore } = await loadFlags(value);
      try {
        expect(FEATURES.commerce, `value ${JSON.stringify(value)}`).toBe(false);
      } finally {
        restore();
      }
    }
  });

  it("is on only for an explicit true, in any case or with padding", async () => {
    for (const value of ["true", "TRUE", "True", " true "]) {
      const { FEATURES, restore } = await loadFlags(value);
      try {
        expect(FEATURES.commerce, `value ${JSON.stringify(value)}`).toBe(true);
      } finally {
        restore();
      }
    }
  });

  it("exposes isFeatureEnabled in agreement with FEATURES", async () => {
    const { FEATURES, isFeatureEnabled, restore } = await loadFlags("true");
    try {
      expect(isFeatureEnabled("commerce")).toBe(FEATURES.commerce);
    } finally {
      restore();
    }
  });
});
