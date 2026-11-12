import { beforeEach, describe, expect, it, vi } from "vitest";

// Auth is pre-established here. Real RLS/constraints are tested separately in SQL.
type Result = { data: unknown; error: { message: string } | null };
type Call = { table: string; action: string; args: unknown[] };
type Handler = (args: {
  data: unknown;
  context: { userId: string; supabase: unknown };
}) => Promise<unknown>;
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse = (value: unknown) => value;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof parse) => {
        parse = fn;
        return builder;
      },
      handler: (fn: Handler) => async (args: Parameters<Handler>[0]) =>
        fn({ ...args, data: parse(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  provider: vi.fn(),
  sign: vi.fn(),
  caps: vi.fn(),
  preflight: vi.fn(),
}));
vi.mock("@/lib/scheduler/dispatcher.server", () => ({ runSchedulerTick: mocks.dispatch }));
vi.mock("@/lib/scheduler/publishers.server", () => ({
  publisherCapabilities: mocks.caps,
  preflightOrThrow: mocks.preflight,
}));
vi.mock("@/lib/oauth/providers.server", () => ({
  getProvider: mocks.provider,
  listProviders: vi.fn(),
}));
vi.mock("@/lib/oauth/state.server", () => ({
  signState: mocks.sign,
  stateCookieName: () => "velt_oauth_meta",
  stateCookieValue: () => "hashed-state",
  STATE_COOKIE_PATH: "/api/public/oauth/callback",
  STATE_TTL_SECONDS: 600,
}));
vi.mock("@/lib/oauth/store.server", () => ({ deleteToken: vi.fn() }));
vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("http://example.invalid"),
  setCookie: vi.fn(),
}));

import {
  bulkDeleteContent,
  bulkUpdateContentStatus,
  createContent,
  updateContentStatus,
  updateContent,
} from "@/lib/api/content.functions";
import { createBrand, deleteBrand } from "@/lib/api/brands.functions";
import { createChannel, deleteChannel } from "@/lib/api/channels.functions";
import {
  addBioLink,
  checkSlugAvailability,
  deleteBioLink,
  getBioPage,
  getBioPageStats,
  reorderBioLinks,
  setBioPagePublished,
  updateBioLink,
  upsertBioPage,
} from "@/lib/api/bio.functions";
import {
  enqueuePublication,
  cancelSchedulerJob,
  listSchedulerJobs,
  runSchedulerTickManual,
} from "@/lib/api/scheduler.functions";
import { startOAuthConnect } from "@/lib/api/oauth.functions";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const id = "10000000-0000-4000-8000-000000000003";
const otherId = "10000000-0000-4000-8000-000000000004";
const pageId = "10000000-0000-4000-8000-000000000005";
const ok = (data: unknown): Result => ({ data, error: null });
const failure = (message: string): Result => ({ data: null, error: { message } });

function fixture(
  opts: {
    role?: string | null;
    results?: Record<string, Result | Result[]>;
    rpc?: Record<string, Result>;
  } = {},
) {
  const results: Record<string, Result | Result[]> = {
    workspace_members: ok(opts.role === null ? null : { role: opts.role ?? "owner" }),
    content: ok({ id, type: "post" }),
    brands: ok({ id, name: "Marca" }),
    channels: ok({ id, platform: "instagram" }),
    bio_pages: ok({ id: pageId, headline: "Página", bio: null, slug: "minha-pagina" }),
    bio_links: ok({ id, page_id: pageId, kind: "link" }),
    bio_link_clicks: ok([]),
    domain_events: ok([]),
    ...opts.results,
  };
  const rpcResults = {
    add_bio_link: ok({ id, page_id: pageId }),
    reorder_bio_links: ok(2),
    bio_slug_available: ok(true),
    cancel_publication: ok({ id, status: "cancelled" }),
    ...opts.rpc,
  } as Record<string, Result>;
  const calls: Call[] = [];
  const result = (table: string) => {
    const value = results[table];
    return Array.isArray(value) ? (value.shift() ?? ok(null)) : (value ?? ok(null));
  };
  return {
    calls,
    context: {
      userId,
      supabase: {
        from: (table: string) => {
          calls.push({ table, action: "from", args: [] });
          const q: Record<string, unknown> = {};
          for (const action of [
            "select",
            "eq",
            "in",
            "insert",
            "update",
            "delete",
            "upsert",
            "order",
            "gte",
            "limit",
          ]) {
            q[action] = (...args: unknown[]) => {
              calls.push({ table, action, args });
              return q;
            };
          }
          q.single = q.maybeSingle = async () => result(table);
          q.then = (resolve: (value: Result) => void) => resolve(result(table));
          return q;
        },
        rpc: async (fn: string, args: unknown) => {
          calls.push({ table: fn, action: "rpc", args: [args] });
          return rpcResults[fn] ?? ok(null);
        },
      },
    },
  };
}
function invoke(fn: unknown, data: unknown, f = fixture()) {
  return (fn as Handler)({ data, context: f.context });
}
function mutations(f: ReturnType<typeof fixture>) {
  return f.calls.filter((call) =>
    ["insert", "upsert", "update", "delete", "rpc"].includes(call.action),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.caps.mockReturnValue([{ platform: "facebook", implemented: true, credentialsReady: true }]);
  mocks.preflight.mockReset();
  mocks.dispatch.mockResolvedValue({ claimed: 0, succeeded: 0, failed: 0, jobs: [] });
});

const editOperations: Array<[string, unknown, object]> = [
  ["createContent", createContent, { workspaceId, title: "Rascunho" }],
  [
    "updateContent",
    updateContent,
    { workspaceId, id, title: "Editado", body: "Texto", mediaUrls: [] },
  ],
  ["updateContentStatus", updateContentStatus, { workspaceId, id, status: "archived" }],
  [
    "bulkUpdateContentStatus",
    bulkUpdateContentStatus,
    { workspaceId, ids: [id], status: "archived" },
  ],
  ["bulkDeleteContent", bulkDeleteContent, { workspaceId, ids: [id] }],
  ["createBrand", createBrand, { workspaceId, name: "Marca" }],
  ["upsertBioPage", upsertBioPage, { workspaceId, slug: "minha-pagina" }],
  ["setBioPagePublished", setBioPagePublished, { workspaceId, published: false }],
  ["addBioLink", addBioLink, { workspaceId, label: "Site", raw: "https://example.invalid" }],
  ["updateBioLink", updateBioLink, { workspaceId, id, isActive: false }],
  ["deleteBioLink", deleteBioLink, { workspaceId, id }],
  ["reorderBioLinks", reorderBioLinks, { workspaceId, orderedIds: [id, otherId] }],
  ["cancelSchedulerJob", cancelSchedulerJob, { workspaceId, jobId: id }],
];
const manageOperations: Array<[string, unknown, object]> = [
  ["deleteBrand", deleteBrand, { workspaceId, id }],
  ["createChannel", createChannel, { workspaceId, platform: "instagram", handle: "qa" }],
  ["deleteChannel", deleteChannel, { workspaceId, id }],
  ["runSchedulerTickManual", runSchedulerTickManual, { workspaceId }],
  ["startOAuthConnect", startOAuthConnect, { workspaceId, provider: "instagram" }],
];

describe("mutation authorization is explicit before any write", () => {
  it.each(editOperations)("%s rejects a viewer", async (_name, fn, data) => {
    const f = fixture({ role: "viewer" });
    await expect(invoke(fn, data, f)).rejects.toThrow("forbidden");
    expect(mutations(f)).toEqual([]);
  });
  it.each([...editOperations, ...manageOperations])(
    "%s rejects a missing membership",
    async (_name, fn, data) => {
      const f = fixture({ role: null });
      await expect(invoke(fn, data, f)).rejects.toThrow("forbidden");
      expect(mutations(f)).toEqual([]);
    },
  );
  it.each(manageOperations)("%s rejects an editor", async (_name, fn, data) => {
    const f = fixture({ role: "editor" });
    await expect(invoke(fn, data, f)).rejects.toThrow("forbidden");
    expect(mutations(f)).toEqual([]);
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("propagates a membership read error instead of treating it as permission/empty success", async () => {
    const f = fixture({ results: { workspace_members: failure("membership unavailable") } });
    await expect(invoke(deleteBrand, { workspaceId, id }, f)).rejects.toThrow(
      "membership unavailable",
    );
    expect(mutations(f)).toEqual([]);
  });
});

describe("confirmed CRUD, not submitted IDs", () => {
  it.each([
    ["update", updateContentStatus, { workspaceId, id, status: "archived" }, "content"],
    ["brand delete", deleteBrand, { workspaceId, id }, "brands"],
    ["channel delete", deleteChannel, { workspaceId, id }, "channels"],
  ])("%s rejects a zero-row write", async (_name, fn, data, table) => {
    const f = fixture({ results: { [table as string]: ok(null) } });
    await expect(invoke(fn, data, f)).rejects.toThrow(/não encontrad/);
  });
  it.each([updateContentStatus, deleteBrand, deleteChannel])(
    "confirms a single affected row in the requested workspace",
    async (fn) => {
      const f = fixture();
      await expect(invoke(fn, { workspaceId, id, status: "draft" }, f)).resolves.toEqual({
        ok: true,
        id,
      });
      const target = fn === deleteBrand ? "brands" : fn === deleteChannel ? "channels" : "content";
      expect(f.calls).toContainEqual({
        table: target,
        action: "eq",
        args: ["workspace_id", workspaceId],
      });
      expect(f.calls).toContainEqual({ table: target, action: "select", args: ["id"] });
    },
  );
  it.each([bulkDeleteContent, bulkUpdateContentStatus])(
    "deduplicates input and reports only real rows, with explicit partial result",
    async (fn) => {
      const f = fixture({ results: { content: ok([{ id }]) } });
      await expect(
        invoke(fn, { workspaceId, ids: [id, id, otherId], status: "archived" }, f),
      ).resolves.toEqual({ ok: true, ids: [id], count: 1, missingCount: 1 });
      expect(f.calls).toContainEqual({
        table: "content",
        action: "in",
        args: ["id", [id, otherId]],
      });
    },
  );
  it.each([bulkDeleteContent, bulkUpdateContentStatus])(
    "does not report an empty bulk operation as successful",
    async (fn) => {
      const f = fixture({ results: { content: ok([]) } });
      await expect(invoke(fn, { workspaceId, ids: [id], status: "draft" }, f)).rejects.toThrow(
        "Nenhum conteúdo foi alterado",
      );
    },
  );
  it.each([null, undefined])(
    "requires actual returned rows, not an absent payload (%s)",
    async (payload) => {
      const f = fixture({ results: { content: ok(payload) } });
      await expect(invoke(bulkDeleteContent, { workspaceId, ids: [id] }, f)).rejects.toThrow(
        "confirmar",
      );
    },
  );
  it("preserves database errors", async () => {
    const f = fixture({ results: { content: failure("write unavailable") } });
    await expect(invoke(bulkDeleteContent, { workspaceId, ids: [id] }, f)).rejects.toThrow(
      "write unavailable",
    );
  });
  it.each(["scheduled", "publishing", "published", "failed"])(
    "rejects a manufactured delivery status: %s",
    async (status) => {
      const f = fixture();
      await expect(invoke(updateContentStatus, { workspaceId, id, status }, f)).rejects.toThrow();
      expect(f.calls).toEqual([]);
    },
  );
  it.each([{}, { title: "   " }, { body: "  " }])(
    "does not save an empty draft: %j",
    async (input) => {
      const f = fixture();
      await expect(invoke(createContent, { workspaceId, ...input }, f)).rejects.toThrow();
      expect(f.calls).toEqual([]);
    },
  );
  it.each([
    [createContent, { workspaceId, brandId: otherId, title: "Post" }],
    [createChannel, { workspaceId, brandId: otherId, platform: "instagram", handle: "qa" }],
    [startOAuthConnect, { workspaceId, brandId: otherId, provider: "instagram" }],
  ])("rejects a hidden/foreign brand before creating or connecting anything", async (fn, input) => {
    const f = fixture({ results: { brands: ok(null) } });
    await expect(invoke(fn, input, f)).rejects.toThrow("Marca não encontrada");
    expect(mutations(f)).toEqual([]);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("allows an editor to create a trimmed draft in their workspace", async () => {
    const f = fixture({ role: "editor" });
    await expect(
      invoke(createContent, { workspaceId, title: "  Rascunho  " }, f),
    ).resolves.toMatchObject({ id });
    expect(f.calls).toContainEqual({
      table: "content",
      action: "insert",
      args: [
        {
          workspace_id: workspaceId,
          brand_id: null,
          type: "post",
          title: "Rascunho",
          body: null,
          media: [],
          status: "draft",
          created_by: userId,
        },
      ],
    });
  });
});

describe("bio persistence, atomic ordering and failures", () => {
  it.each([
    ["email", "qa@example.invalid", "mailto:qa@example.invalid"],
    ["phone", "+55 (43) 99999-0000", "tel:+5543999990000"],
    ["whatsapp", "(55) 99999-0000", "https://wa.me/5555999990000"],
  ])("stores a normalized %s through the atomic append RPC", async (kind, raw, url) => {
    const f = fixture({ role: "editor" });
    await invoke(addBioLink, { workspaceId, label: "Contato", kind, raw }, f);
    expect(f.calls).toContainEqual({
      table: "add_bio_link",
      action: "rpc",
      args: [{ _workspace_id: workspaceId, _label: "Contato", _kind: kind, _url: url }],
    });
    expect(f.calls.some((c) => c.table === "bio_links")).toBe(false);
  });
  it("propagates append errors and missing returned rows", async () => {
    for (const result of [failure("append unavailable"), ok(null)]) {
      const f = fixture({ rpc: { add_bio_link: result } });
      await expect(
        invoke(
          addBioLink,
          { workspaceId, label: "Contato", kind: "email", raw: "qa@example.invalid" },
          f,
        ),
      ).rejects.toThrow();
    }
  });
  it("uses one full-set ordering RPC, not partial per-link writes", async () => {
    const f = fixture();
    await expect(
      invoke(reorderBioLinks, { workspaceId, orderedIds: [otherId, id] }, f),
    ).resolves.toEqual({ ok: true, count: 2 });
    expect(mutations(f)).toEqual([
      {
        table: "reorder_bio_links",
        action: "rpc",
        args: [{ _workspace_id: workspaceId, _ordered_ids: [otherId, id] }],
      },
    ]);
  });
  it("rejects duplicate IDs before sending a reorder", async () => {
    const f = fixture();
    await expect(
      invoke(reorderBioLinks, { workspaceId, orderedIds: [id, id] }, f),
    ).rejects.toThrow();
    expect(f.calls).toEqual([]);
  });
  it.each([null, 1])("does not confirm incomplete ordering (%s)", async (count) => {
    const f = fixture({ rpc: { reorder_bio_links: ok(count) } });
    await expect(
      invoke(reorderBioLinks, { workspaceId, orderedIds: [id, otherId] }, f),
    ).rejects.toThrow("confirmar");
  });
  it("requires a new destination when changing kinds", async () => {
    const f = fixture();
    await expect(invoke(updateBioLink, { workspaceId, id, kind: "email" }, f)).rejects.toThrow(
      "destino",
    );
    expect(mutations(f)).toEqual([]);
  });
  it("does not accept an empty update as saved", async () => {
    const f = fixture();
    await expect(invoke(updateBioLink, { workspaceId, id }, f)).rejects.toThrow(
      "Nenhuma alteração",
    );
    expect(mutations(f)).toEqual([]);
  });
  it.each([updateBioLink, deleteBioLink])(
    "detects a link removed between the ownership read and the mutation",
    async (fn) => {
      const f = fixture({
        results: { bio_links: [ok({ id, page_id: pageId, kind: "link" }), ok(null)] },
      });
      await expect(invoke(fn, { workspaceId, id, isActive: false }, f)).rejects.toThrow(
        "confirmar",
      );
      expect(f.calls).toContainEqual({
        table: "bio_links",
        action: "eq",
        args: ["page_id", pageId],
      });
    },
  );
  it("propagates a deletion pre-read failure", async () => {
    const f = fixture({ results: { bio_links: failure("link read unavailable") } });
    await expect(invoke(deleteBioLink, { workspaceId, id }, f)).rejects.toThrow(
      "link read unavailable",
    );
    expect(mutations(f)).toEqual([]);
  });
  it.each([getBioPage, getBioPageStats])(
    "rejects foreign workspace reads instead of manufacturing an empty page",
    async (fn) => {
      const f = fixture({ role: null });
      await expect(invoke(fn, { workspaceId }, f)).rejects.toThrow("forbidden");
    },
  );
  it("does not replace a failed stats link query with zero clicks", async () => {
    const f = fixture({ results: { bio_links: failure("stats links unavailable") } });
    await expect(invoke(getBioPageStats, { workspaceId }, f)).rejects.toThrow(
      "stats links unavailable",
    );
  });
  it("uses a boolean availability RPC rather than a private RLS row lookup", async () => {
    const f = fixture({ rpc: { bio_slug_available: ok(false) } });
    await expect(invoke(checkSlugAvailability, { slug: "ocupado" }, f)).resolves.toEqual({
      available: false,
      slug: "ocupado",
      error: "Este link já está em uso.",
    });
    expect(f.calls.some((c) => c.table === "bio_pages")).toBe(false);
  });
  it("does not claim availability after a failed RPC", async () => {
    const f = fixture({ rpc: { bio_slug_available: failure("slug unavailable") } });
    await expect(invoke(checkSlugAvailability, { slug: "minha-pagina" }, f)).rejects.toThrow(
      "slug unavailable",
    );
  });
  it("propagates a publish pre-read error and never writes afterward", async () => {
    const f = fixture({ results: { bio_pages: failure("page unavailable") } });
    await expect(invoke(setBioPagePublished, { workspaceId, published: true }, f)).rejects.toThrow(
      "page unavailable",
    );
    expect(mutations(f)).toEqual([]);
  });
});

describe("scheduler confirmation and tenant scope", () => {
  it("confirms only a complete, unique set of pending publication jobs", async () => {
    const jobs = [{ id, channel_id: id, content_id: otherId, status: "pending" }];
    const f = fixture({
      results: {
        content: ok({
          id: otherId,
          workspace_id: workspaceId,
          title: "Draft",
          body: "Text",
          media: [],
        }),
        channels: ok([{ id, platform: "facebook", status: "connected" }]),
      },
      rpc: { enqueue_publication: ok(jobs) },
    });
    await expect(
      invoke(
        enqueuePublication,
        { contentId: otherId, channelIds: [id], scheduledAt: "2030-01-01T12:00:00.000Z" },
        f,
      ),
    ).resolves.toEqual(jobs);
  });
  it.each([
    null,
    [],
    [{ channel_id: id, content_id: otherId, status: "succeeded" }],
    [{ channel_id: otherId, content_id: otherId, status: "pending" }],
  ])("does not advertise an unconfirmed/incorrect enqueue: %j", async (jobs) => {
    const f = fixture({
      results: {
        content: ok({
          id: otherId,
          workspace_id: workspaceId,
          title: "Draft",
          body: "Text",
          media: [],
        }),
        channels: ok([{ id, platform: "facebook", status: "connected" }]),
      },
      rpc: { enqueue_publication: ok(jobs) },
    });
    await expect(
      invoke(
        enqueuePublication,
        { contentId: otherId, channelIds: [id], scheduledAt: "2030-01-01T12:00:00.000Z" },
        f,
      ),
    ).rejects.toThrow("não confirmado");
  });
  it("rejects duplicate requested channels before enqueue", async () => {
    const f = fixture();
    await expect(
      invoke(
        enqueuePublication,
        { contentId: otherId, channelIds: [id, id], scheduledAt: "2030-01-01T12:00:00.000Z" },
        f,
      ),
    ).rejects.toThrow();
    expect(f.calls).toEqual([]);
  });

  it.each(["owner", "admin"])("%s can trigger only their selected workspace", async (role) => {
    const f = fixture({ role });
    await invoke(runSchedulerTickManual, { workspaceId, limit: 5 }, f);
    expect(mocks.dispatch).toHaveBeenCalledWith({ workspaceId, limit: 5 });
  });
  it("cancels transactionally and confirms a cancelled row", async () => {
    const f = fixture({ role: "editor" });
    await expect(invoke(cancelSchedulerJob, { workspaceId, jobId: id }, f)).resolves.toMatchObject({
      id,
      status: "cancelled",
    });
    expect(mutations(f)).toEqual([
      {
        table: "cancel_publication",
        action: "rpc",
        args: [{ _workspace_id: workspaceId, _job_id: id }],
      },
    ]);
  });
  it.each([null, { id, status: "failed" }])(
    "does not advertise an unconfirmed cancellation (%j)",
    async (row) => {
      const f = fixture({ rpc: { cancel_publication: ok(row) } });
      await expect(invoke(cancelSchedulerJob, { workspaceId, jobId: id }, f)).rejects.toThrow(
        "não confirmado",
      );
    },
  );
  it("accepts the actual cancelled filter", async () => {
    const f = fixture({ results: { scheduler_jobs: ok([]) } });
    await invoke(listSchedulerJobs, { workspaceId, status: "cancelled" }, f);
    expect(f.calls).toContainEqual({
      table: "scheduler_jobs",
      action: "eq",
      args: ["status", "cancelled"],
    });
  });
});
