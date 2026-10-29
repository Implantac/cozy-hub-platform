import { describe, expect, it } from "vitest";

import { readCta, readMilestones } from "@/lib/json";

/**
 * These read `json` columns, which is data the type system deliberately refuses
 * to shape. The contract that matters is total: never throw, always return the
 * advertised type. A card that renders nothing is a nuisance; a card that throws
 * takes the page down with it.
 */

describe("readCta", () => {
  it("reads a well-formed call to action", () => {
    expect(readCta({ href: "/app/content", label: "Criar" })).toEqual({
      href: "/app/content",
      label: "Criar",
    });
  });

  it("accepts a cta without a label", () => {
    expect(readCta({ href: "/app/brands" })).toEqual({ href: "/app/brands", label: undefined });
  });

  it("rejects everything that is not a usable link", () => {
    for (const value of [
      null,
      undefined,
      "",
      "href",
      42,
      [],
      [{ href: "/x" }],
      {},
      { href: "" },
      { href: 123 },
      { href: null, label: "x" },
    ]) {
      expect(readCta(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("ignores a non-string label instead of rendering an object", () => {
    expect(readCta({ href: "/x", label: { nested: true } })).toEqual({
      href: "/x",
      label: undefined,
    });
  });
});

describe("readMilestones", () => {
  it("reads a list of milestones", () => {
    expect(
      readMilestones([
        { id: "a", title: "Primeiro" },
        { id: "b", title: "Segundo" },
      ]),
    ).toEqual([
      { id: "a", title: "Primeiro" },
      { id: "b", title: "Segundo" },
    ]);
  });

  it("drops entries without a usable id and keeps the rest", () => {
    const value = [{ id: "a", title: "ok" }, { title: "sem id" }, null, "texto", 7, { id: 3 }];
    expect(readMilestones(value)).toEqual([{ id: "a", title: "ok" }]);
  });

  it("falls back to the id when the title is missing or not a string", () => {
    expect(readMilestones([{ id: "a" }, { id: "b", title: 3 }])).toEqual([
      { id: "a", title: "a" },
      { id: "b", title: "b" },
    ]);
  });

  it("returns an empty array for anything that is not a list", () => {
    for (const value of [null, undefined, {}, "x", 42, { id: "a" }]) {
      expect(readMilestones(value)).toEqual([]);
    }
  });
});
