import { describe, expect, it, vi } from "vitest";

type QueryResult = { data?: unknown; count?: number | null; error: { message: string } | null };
type Call = { table: string; action: string; args: unknown[] };
type Handler = (args: {
  data?: unknown;
  context: { supabase: unknown; userId: string };
}) => Promise<unknown>;

// These tests exercise handlers with a pre-authenticated context, not the Auth
// middleware or Postgres/RLS. No real provider or database is contacted.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let parse = (value: unknown) => value;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: typeof parse) => {
        parse = fn;
        return builder;
      },
      handler:
        (fn: Handler): Handler =>
        async (args) =>
          fn({ ...args, data: parse(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
const mocks = vi.hoisted(() => ({ runSync: vi.fn() }));
vi.mock("@/lib/analytics/sync.server", () => ({ runAnalyticsSync: mocks.runSync }));

import { getMetricsReadiness, syncWorkspaceMetrics } from "@/lib/api/analytics-sync.functions";
import { getWorkspace } from "@/lib/api/workspaces.functions";
import { updateMyProfile } from "@/lib/api/notifications.functions";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000002";
const readiness = getMetricsReadiness as unknown as Handler;
const sync = syncWorkspaceMetrics as unknown as Handler;
const workspace = getWorkspace as unknown as Handler;
const update = updateMyProfile as unknown as Handler;

function fixture(overrides: Record<string, QueryResult> = {}) {
  const results: Record<string, QueryResult> = {
    workspace_members: { data: { role: "owner" }, error: null },
    channels: { data: [], error: null },
    scheduler_jobs: { data: null, count: 0, error: null },
    analytics_snapshots: { data: null, count: 0, error: null },
    ...overrides,
  };
  const calls: Call[] = [];
  return {
    calls,
    context: {
      userId,
      supabase: {
        from: (table: string) => {
          calls.push({ table, action: "from", args: [] });
          const query: Record<string, unknown> = {};
          for (const action of ["select", "eq", "not", "update", "in"]) {
            query[action] = (...args: unknown[]) => {
              calls.push({ table, action, args });
              return query;
            };
          }
          query.single = query.maybeSingle = async () => results[table];
          query.then = (resolve: (result: QueryResult) => void) => resolve(results[table]);
          return query;
        },
      },
    },
  };
}

describe("readiness read failures never become empty successful metrics", () => {
  it.each(["workspace_members", "channels", "scheduler_jobs", "analytics_snapshots"])(
    "propagates a failure reading %s",
    async (table) => {
      const f = fixture({
        [table]: { data: null, count: null, error: { message: "database unavailable" } },
      });
      await expect(readiness({ data: { workspaceId }, context: f.context })).rejects.toThrow(
        "database unavailable",
      );
    },
  );
  it("rejects a nonmember before reading workspace metrics", async () => {
    const f = fixture({ workspace_members: { data: null, error: null } });
    await expect(readiness({ data: { workspaceId }, context: f.context })).rejects.toThrow(
      "forbidden",
    );
    expect(f.calls.filter((call) => call.action === "from").map((call) => call.table)).toEqual([
      "workspace_members",
    ]);
  });
  it.each(["scheduler_jobs", "analytics_snapshots"])(
    "does not substitute zero for an unreturned %s count",
    async (table) => {
      const f = fixture({ [table]: { count: null, error: null } });
      await expect(readiness({ data: { workspaceId }, context: f.context })).rejects.toThrow(
        "counts were not returned",
      );
    },
  );
  it("scopes reads and excludes simulated publications from the actual-publication count", async () => {
    const f = fixture();
    await expect(readiness({ data: { workspaceId }, context: f.context })).resolves.toMatchObject({
      reasonCode: "no_channels",
      snapshots: 0,
      publishedPosts: 0,
      canSync: true,
    });
    expect(f.calls).toContainEqual({
      table: "scheduler_jobs",
      action: "not",
      args: ["external_post_id", "like", "sim\\_%"],
    });
    for (const table of ["channels", "scheduler_jobs", "analytics_snapshots"])
      expect(f.calls).toContainEqual({ table, action: "eq", args: ["workspace_id", workspaceId] });
    expect(f.calls.some((call) => call.action === "update")).toBe(false);
  });
  it("does not trigger providers for a viewer even if they call the server function directly", async () => {
    mocks.runSync.mockClear();
    const f = fixture({ workspace_members: { data: { role: "viewer" }, error: null } });
    await expect(sync({ data: { workspaceId }, context: f.context })).rejects.toThrow("forbidden");
    expect(mocks.runSync).not.toHaveBeenCalled();
  });
});

describe("profile and workspace details", () => {
  it("does not return a blank team after a failed member query", async () => {
    const f = fixture({
      workspaces: { data: { id: workspaceId }, error: null },
      workspace_members: { data: null, error: { message: "members unavailable" } },
    });
    await expect(workspace({ data: { id: workspaceId }, context: f.context })).rejects.toThrow(
      "members unavailable",
    );
  });
  it("reads team profiles separately under the caller's RLS without inventing a missing join", async () => {
    const f = fixture({
      workspaces: { data: { id: workspaceId }, error: null },
      workspace_members: {
        data: [
          { user_id: userId, role: "owner" },
          { user_id: "hidden-profile", role: "viewer" },
        ],
        error: null,
      },
      profiles: { data: [{ id: userId, display_name: "Ana", avatar_url: null }], error: null },
    });
    await expect(
      workspace({ data: { id: workspaceId }, context: f.context }),
    ).resolves.toMatchObject({
      members: [
        { user_id: userId, profile: { display_name: "Ana" } },
        { user_id: "hidden-profile", profile: null },
      ],
    });
    expect(f.calls).toContainEqual({
      table: "profiles",
      action: "in",
      args: ["id", [userId, "hidden-profile"]],
    });
    expect(
      f.calls.some(
        (call) => call.action === "select" && String(call.args[0]).includes("profile:profiles"),
      ),
    ).toBe(false);
  });
  it("does not claim a successful team read when fetching visible profiles failed", async () => {
    const f = fixture({
      workspaces: { data: { id: workspaceId }, error: null },
      workspace_members: { data: [{ user_id: userId, role: "owner" }], error: null },
      profiles: { data: null, error: { message: "profiles unavailable" } },
    });
    await expect(workspace({ data: { id: workspaceId }, context: f.context })).rejects.toThrow(
      "profiles unavailable",
    );
  });
  it("saves only the authenticated profile, returning the confirmed row for the shared cache", async () => {
    const profile = { id: userId, display_name: "Ana" };
    const f = fixture({ profiles: { data: profile, error: null } });
    await expect(
      update({ data: { display_name: " Ana ", id: "someone-else" }, context: f.context }),
    ).resolves.toEqual({ ok: true, profile });
    expect(f.calls).toContainEqual({ table: "profiles", action: "eq", args: ["id", userId] });
    expect(f.calls).toContainEqual({
      table: "profiles",
      action: "update",
      args: [{ display_name: "Ana" }],
    });
  });
  it("does not claim a save when no updated profile was returned", async () => {
    const f = fixture({ profiles: { data: null, error: null } });
    await expect(update({ data: { display_name: "Ana" }, context: f.context })).rejects.toThrow(
      "not confirmed",
    );
  });
  it("rejects whitespace without issuing a database update", async () => {
    const f = fixture();
    await expect(update({ data: { display_name: "   " }, context: f.context })).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
  });
});
