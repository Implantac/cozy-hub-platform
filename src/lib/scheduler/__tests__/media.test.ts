import { describe, expect, it } from "vitest";
import {
  composeCaption,
  detectMediaKind,
  isFetchableUrl,
  pickPrimaryMedia,
  precheckMedia,
} from "@/lib/scheduler/media";

describe("detectMediaKind", () => {
  it("detects images by extension, with query strings", () => {
    expect(detectMediaKind("https://cdn.x.com/a.jpg")).toBe("image");
    expect(detectMediaKind("https://cdn.x.com/a.PNG?token=1")).toBe("image");
    expect(detectMediaKind("https://cdn.x.com/a.webp#x")).toBe("image");
  });

  it("detects videos", () => {
    expect(detectMediaKind("https://cdn.x.com/a.mp4")).toBe("video");
    expect(detectMediaKind("https://cdn.x.com/a.MOV")).toBe("video");
  });

  it("returns unknown for extensionless or signed URLs", () => {
    expect(detectMediaKind("https://cdn.x.com/asset")).toBe("unknown");
    expect(detectMediaKind("https://storage.x.com/obj/public/abc123")).toBe("unknown");
  });
});

describe("isFetchableUrl", () => {
  it("accepts only public HTTPS", () => {
    expect(isFetchableUrl("https://cdn.x.com/a.jpg")).toBe(true);
  });
  it("rejects http, localhost and garbage", () => {
    expect(isFetchableUrl("http://cdn.x.com/a.jpg")).toBe(false);
    expect(isFetchableUrl("not-a-url")).toBe(false);
  });
});

describe("precheckMedia", () => {
  it("fails when the platform requires media and none is present", () => {
    const r = precheckMedia([], { requiresMedia: true });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/exige mídia/i);
  });

  it("enforces the item ceiling", () => {
    const urls = Array.from({ length: 25 }, (_, i) => `https://cdn.x.com/${i}.jpg`);
    const r = precheckMedia(urls, { requiresMedia: false, maxItems: 20 });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/máximo/);
  });

  it("flags non-HTTPS media", () => {
    const r = precheckMedia(["http://cdn.x.com/a.jpg"], { requiresMedia: false });
    expect(r.ok).toBe(false);
  });

  it("flags video when the format only accepts images", () => {
    const r = precheckMedia(["https://cdn.x.com/a.mp4"], {
      requiresMedia: false,
      acceptVideo: false,
    });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/apenas imagem/);
  });

  it("passes a clean HTTPS image payload", () => {
    expect(precheckMedia(["https://cdn.x.com/a.jpg"], { requiresMedia: true }).ok).toBe(true);
  });
});

describe("pickPrimaryMedia", () => {
  it("prefers video when both are present", () => {
    const p = pickPrimaryMedia(["https://cdn.x.com/a.jpg", "https://cdn.x.com/b.mp4"]);
    expect(p?.kind).toBe("video");
  });

  it("falls back to a single image", () => {
    expect(pickPrimaryMedia(["https://cdn.x.com/a.jpg"])?.kind).toBe("image");
  });

  it("returns null for an empty list", () => {
    expect(pickPrimaryMedia([])).toBeNull();
  });
});

describe("composeCaption", () => {
  it("joins title and body with a blank line", () => {
    expect(composeCaption("Título", "Corpo")).toBe("Título\n\nCorpo");
  });

  it("does not duplicate when the body already starts with the title", () => {
    expect(composeCaption("Gancho", "Gancho e o resto")).toBe("Gancho e o resto");
  });

  it("handles missing parts", () => {
    expect(composeCaption(null, "só corpo")).toBe("só corpo");
    expect(composeCaption("só título", "")).toBe("só título");
    expect(composeCaption(null, null)).toBe("");
  });
});
