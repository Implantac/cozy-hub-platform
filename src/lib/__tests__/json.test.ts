import { describe, expect, it } from "vitest";

import {
  errorMessage,
  readCta,
  readGaps,
  readLabels,
  readMilestones,
  readStrings,
  readSummary,
  readTitledActions,
} from "@/lib/json";

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

describe("readLabels", () => {
  it("keeps only entries that carry a label", () => {
    expect(readLabels([{ label: "Ver" }, { href: "/x" }, { label: "" }, { label: 7 }])).toEqual([
      { label: "Ver" },
    ]);
  });

  it("returns an empty list for anything that is not an array", () => {
    for (const value of [null, undefined, {}, "x", 42]) {
      expect(readLabels(value)).toEqual([]);
    }
  });
});

describe("readGaps", () => {
  it("reads the gaps of a score breakdown", () => {
    expect(readGaps({ score: 71, gaps: ["Sem SEO", "Pouca prova social"] })).toEqual([
      "Sem SEO",
      "Pouca prova social",
    ]);
  });

  it("ignores a breakdown without gaps or of the wrong shape", () => {
    for (const value of [null, undefined, {}, "x", 42, [1, 2], { gaps: "nenhum" }]) {
      expect(readGaps(value)).toEqual([]);
    }
  });
});

describe("readStrings", () => {
  it("drops non-string entries instead of stringifying them", () => {
    expect(readStrings(["a", 3, null, { b: 1 }, "c"])).toEqual(["a", "c"]);
  });

  it("returns an empty list when the column holds something else", () => {
    for (const value of [null, undefined, { a: 1 }, "texto", 0]) {
      expect(readStrings(value)).toEqual([]);
    }
  });
});

describe("readSummary", () => {
  it("reads a summary and trims empty ones away", () => {
    expect(readSummary({ summary: "Cenário viável." })).toBe("Cenário viável.");
    expect(readSummary({ summary: "   " })).toBeNull();
  });

  it("returns null for a column without a usable summary", () => {
    for (const value of [null, undefined, {}, { summary: 12 }, ["x"], "texto"]) {
      expect(readSummary(value)).toBeNull();
    }
  });
});

describe("readTitledActions", () => {
  it("keeps titled actions and only string hrefs", () => {
    expect(
      readTitledActions([
        { title: "Conectar canal", href: "/app/channels" },
        { title: "Refazer diagnóstico" },
        { title: "", href: "/x" },
        { href: "/sem-titulo" },
        null,
        "texto",
      ]),
    ).toEqual([
      { title: "Conectar canal", href: "/app/channels" },
      { title: "Refazer diagnóstico", href: undefined },
    ]);
  });

  it("returns an empty list when the column is not an array", () => {
    for (const value of [null, undefined, {}, "x", 3]) {
      expect(readTitledActions(value)).toEqual([]);
    }
  });
});

describe("errorMessage", () => {
  it("uses the message of a real error", () => {
    expect(errorMessage(new Error("Rede indisponível"))).toBe("Rede indisponível");
  });

  it("recovers a message from thrown non-errors", () => {
    expect(errorMessage("Falha direta")).toBe("Falha direta");
    expect(errorMessage({ message: "Do servidor" })).toBe("Do servidor");
    expect(errorMessage({ error: "Do corpo" })).toBe("Do corpo");
  });

  it("falls back instead of showing undefined", () => {
    for (const value of [null, undefined, {}, new Error(""), 42, []]) {
      expect(errorMessage(value)).toBe("Algo deu errado. Tente novamente.");
    }
  });
});
