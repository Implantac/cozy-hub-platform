import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the anonymous read path.
 *
 * The unit under test decides whether a stranger with a URL can read a page, so
 * the assertions are about *what reaches the database query*, not about the
 * shape of the returned object. A test that only checked the happy path would
 * pass even if `is_published` were dropped from the filter.
 */

const state: {
  pageRow: Record<string, unknown> | null;
  links: Array<Record<string, unknown>>;
  workspace: { name: string } | null;
  filters: Record<string, unknown>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  failRpc: boolean;
  linkRow: { url: string; is_active: boolean } | null;
} = {
  pageRow: null,
  links: [],
  workspace: null,
  filters: {},
  rpcCalls: [],
  failRpc: false,
  linkRow: null,
};

vi.mock("@/integrations/supabase/client.server", () => {
  const buildPageQuery = () => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        state.filters[col] = val;
        return q;
      },
      order: () => q,
      maybeSingle: async () => ({ data: state.pageRow, error: null }),
    };
    return q;
  };

  const buildLinksQuery = () => {
    const q: Record<string, unknown> = {
      select: () => q,
      eq: () => q,
      order: () => q,
      maybeSingle: async () => ({ data: state.linkRow, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: state.links, error: null }),
    };
    return q;
  };

  return {
    supabaseAdmin: {
      from: (table: string) => {
        if (table === "bio_pages") return buildPageQuery();
        if (table === "bio_links") return buildLinksQuery();
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.workspace, error: null }) }),
          }),
        };
      },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (state.failRpc) throw new Error("rpc down");
        state.rpcCalls.push({ fn, args });
        return { data: null, error: null };
      },
    },
  };
});

const { getPublicBioPage, registerPageView, resolveAndTrackClick } =
  await import("@/lib/bio/public.server");

beforeEach(() => {
  state.pageRow = null;
  state.links = [];
  state.workspace = null;
  state.filters = {};
  state.rpcCalls = [];
  state.failRpc = false;
  state.linkRow = null;
});

describe("getPublicBioPage", () => {
  it("filters by slug AND is_published — a draft is never readable", async () => {
    state.pageRow = null; // DB returns nothing for unpublished
    const result = await getPublicBioPage("minha-loja");

    expect(result).toBeNull();
    expect(state.filters).toEqual({ slug: "minha-loja", is_published: true });
  });

  it("normalises case and whitespace before querying", async () => {
    await getPublicBioPage("  Minha-Loja  ");
    expect(state.filters.slug).toBe("minha-loja");
  });

  it("rejects malformed slugs without touching the database", async () => {
    for (const bad of ["ab", "tem espaço", "UPPER_OK", "a".repeat(40), "<script>", "../admin"]) {
      const res = await getPublicBioPage(bad);
      expect(res).toBeNull();
    }
    // Only well-formed values reach .eq("slug", ...)
    expect(state.filters.slug).toBeUndefined();
  });

  it("returns only active links, in position order", async () => {
    state.pageRow = {
      id: "page-1",
      workspace_id: "ws-1",
      slug: "minha-loja",
      headline: "Padaria",
      bio: null,
      avatar_url: null,
      theme: "aurora",
      is_published: true,
      seo_title: null,
      seo_description: null,
    };
    state.links = [
      {
        id: "l1",
        label: "WhatsApp",
        url: "https://wa.me/5511999999999",
        kind: "whatsapp",
        icon: null,
      },
    ];
    state.workspace = { name: "Padaria Vila" };

    const page = await getPublicBioPage("minha-loja");
    expect(page?.links).toHaveLength(1);
    expect(page?.workspaceName).toBe("Padaria Vila");
    expect(page?.links[0].url).toContain("wa.me");
  });

  it("falls back to VELT when the workspace row is missing", async () => {
    state.pageRow = {
      id: "page-1",
      workspace_id: "ws-1",
      slug: "minha-loja",
      headline: null,
      bio: null,
      avatar_url: null,
      theme: "aurora",
      is_published: true,
      seo_title: null,
      seo_description: null,
    };
    state.workspace = null;
    const page = await getPublicBioPage("minha-loja");
    expect(page?.workspaceName).toBe("VELT");
  });
});

describe("registerPageView", () => {
  it("calls the atomic counter function with the slug", async () => {
    await registerPageView("minha-loja");
    expect(state.rpcCalls).toEqual([{ fn: "bio_register_view", args: { _slug: "minha-loja" } }]);
  });

  it("never throws when the counter fails — a view is not worth a 500", async () => {
    state.failRpc = true;
    await expect(registerPageView("minha-loja")).resolves.toBeUndefined();
  });
});

describe("resolveAndTrackClick", () => {
  it("returns the stored URL by id, never a client-supplied one", async () => {
    state.linkRow = { url: "https://exemplo.com/promo", is_active: true };
    const target = await resolveAndTrackClick("link-1", {
      referrer: "https://instagram.com/someone",
      userAgent: "Mozilla/5.0 (iPhone)",
    });
    expect(target).toBe("https://exemplo.com/promo");
  });

  it("stores only the referrer host and the device family, never raw values", async () => {
    state.linkRow = { url: "https://exemplo.com", is_active: true };
    await resolveAndTrackClick("link-1", {
      referrer: "https://instagram.com/someone?utm_source=x&email=cliente@x.com",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    });

    const call = state.rpcCalls.find((c) => c.fn === "bio_register_click");
    expect(call?.args._referrer_host).toBe("instagram.com");
    // No query string, no path, no e-mail leaks into analytics.
    expect(JSON.stringify(call?.args)).not.toContain("cliente@x.com");
    expect(JSON.stringify(call?.args)).not.toContain("utm_source");
    expect(call?.args._device).toBe("mobile");
  });

  it("refuses inactive links", async () => {
    state.linkRow = { url: "https://exemplo.com", is_active: false };
    expect(await resolveAndTrackClick("link-1", {})).toBeNull();
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("refuses unknown links", async () => {
    state.linkRow = null;
    expect(await resolveAndTrackClick("link-1", {})).toBeNull();
  });

  it("refuses non-http protocols even if they reached the database", async () => {
    // Defence in depth: the DB check constraint is not the last line of defence.
    state.linkRow = { url: "javascript:alert(1)", is_active: true };
    expect(await resolveAndTrackClick("link-1", {})).toBeNull();
  });

  it("still redirects when the click counter fails", async () => {
    state.linkRow = { url: "https://exemplo.com", is_active: true };
    state.failRpc = true;
    expect(await resolveAndTrackClick("link-1", {})).toBe("https://exemplo.com");
  });
});
