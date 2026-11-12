import { beforeEach, describe, expect, it, vi } from "vitest";

// No real OAuth/provider is called by these dispatcher unit tests.
const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  content: null as unknown,
  channel: null as unknown,
  publish: vi.fn(),
  token: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: state.rpc,
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        single: async () => ({
          data: table === "content" ? state.content : state.channel,
          error: null,
        }),
      };
      return q;
    },
  },
}));
vi.mock("@/lib/oauth/refresh.server", () => ({ getFreshToken: state.token }));
vi.mock("@/lib/scheduler/publishers.server", async () => ({
  PublisherError: (await import("@/lib/scheduler/contracts")).PublisherError,
  publishToPlatform: state.publish,
}));
import { runSchedulerTick } from "@/lib/scheduler/dispatcher.server";
import { PublisherError } from "@/lib/scheduler/contracts";

const workspaceId = "10000000-0000-4000-8000-000000000001";
const otherWorkspace = "10000000-0000-4000-8000-000000000002";
const job = {
  id: "job",
  workspace_id: workspaceId,
  content_id: "content",
  channel_id: "channel",
  attempts: 1,
  max_attempts: 5,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.content = {
    id: "content",
    workspace_id: workspaceId,
    title: "QA",
    body: "Texto",
    media: [],
    type: "post",
  };
  state.channel = {
    id: "channel",
    workspace_id: workspaceId,
    platform: "instagram",
    metadata: {},
    external_id: "test",
    status: "connected",
  };
  state.token.mockResolvedValue({ accessToken: "unit-test-only" });
  state.publish.mockResolvedValue({ externalPostId: "unit-test-post" });
  state.rpc.mockImplementation(async (name: string) => ({
    data: name.startsWith("claim_")
      ? [job]
      : name === "complete_scheduler_job"
        ? { ...job, status: "succeeded", external_post_id: "unit-test-post" }
        : null,
    error: null,
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("workspace-scoped manual dispatch", () => {
  it("uses the workspace RPC for a manual request", async () => {
    const result = await runSchedulerTick({ workspaceId, limit: 3, lockSeconds: 40 });
    expect(state.rpc).toHaveBeenNthCalledWith(1, "claim_workspace_scheduler_jobs", {
      _workspace_id: workspaceId,
      _limit: 3,
      _lock_seconds: 40,
    });
    expect(result).toMatchObject({ claimed: 1, succeeded: 1, failed: 0 });
  });
  it("preserves the global claim only for the cron caller", async () => {
    await runSchedulerTick({ limit: 2 });
    expect(state.rpc).toHaveBeenNthCalledWith(1, "claim_scheduler_jobs", {
      _limit: 2,
      _lock_seconds: 60,
    });
  });
  it("stops before loading tokens or providers if a scoped claim returns another workspace", async () => {
    state.rpc.mockResolvedValue({ data: [{ ...job, workspace_id: otherWorkspace }], error: null });
    await expect(runSchedulerTick({ workspaceId })).rejects.toThrow("different workspace");
    expect(state.token).not.toHaveBeenCalled();
    expect(state.publish).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["content", "channel"])(
    "refuses a mismatched %s before touching a token/provider",
    async (table) => {
      if (table === "content")
        state.content = { ...(state.content as object), workspace_id: otherWorkspace };
      else state.channel = { ...(state.channel as object), workspace_id: otherWorkspace };
      const result = await runSchedulerTick({ workspaceId });
      expect(result).toMatchObject({ claimed: 1, succeeded: 0, failed: 1 });
      expect(result.jobs[0].error).toMatch(/workspace does not match/);
      expect(state.publish).not.toHaveBeenCalled();
      expect(state.token).not.toHaveBeenCalled();
      expect(state.rpc).not.toHaveBeenCalledWith("complete_scheduler_job", expect.anything());
    },
  );
  it("refuses a disconnected channel before touching a token/provider", async () => {
    state.channel = { ...(state.channel as object), status: "disconnected" };
    const result = await runSchedulerTick({ workspaceId });
    expect(result).toMatchObject({ succeeded: 0, failed: 1 });
    expect(state.token).not.toHaveBeenCalled();
    expect(state.publish).not.toHaveBeenCalled();
  });
  it("returns an honest empty result without invoking publication", async () => {
    state.rpc.mockResolvedValue({ data: [], error: null });
    await expect(runSchedulerTick({ workspaceId })).resolves.toEqual({
      claimed: 0,
      succeeded: 0,
      failed: 0,
      jobs: [],
    });
    expect(state.publish).not.toHaveBeenCalled();
  });
  it("propagates a failed claim instead of manufacturing empty success", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: "claim unavailable" } });
    await expect(runSchedulerTick({ workspaceId })).rejects.toThrow("claim unavailable");
    expect(state.publish).not.toHaveBeenCalled();
  });
  it("does not count a failed completion RPC as a confirmed publication", async () => {
    state.rpc.mockImplementation(async (name: string) => ({
      data: name.startsWith("claim_") ? [job] : null,
      error: name === "complete_scheduler_job" ? { message: "completion unavailable" } : null,
    }));
    const result = await runSchedulerTick({ workspaceId });
    expect(result).toMatchObject({ claimed: 1, succeeded: 0, failed: 1 });
    expect(result.jobs[0].error).toContain("completion unavailable");
  });
  it("does not claim success when completion returns zero confirmed rows", async () => {
    state.rpc.mockImplementation(async (name: string) => ({
      data: name.startsWith("claim_") ? [job] : null,
      error: null,
    }));
    const result = await runSchedulerTick({ workspaceId });
    expect(result).toMatchObject({ succeeded: 0, failed: 1 });
    expect(state.rpc).toHaveBeenCalledWith(
      "fail_scheduler_job",
      expect.objectContaining({ _retryable: false, _external_post_id: "unit-test-post" }),
    );
  });
  it("keeps a provider-confirmed post out of automatic retry when acknowledgement fails", async () => {
    state.rpc.mockImplementation(async (name: string) => ({
      data: name.startsWith("claim_") ? [job] : null,
      error: name === "complete_scheduler_job" ? { message: "ack failed" } : null,
    }));
    await runSchedulerTick({ workspaceId });
    expect(state.publish).toHaveBeenCalledTimes(1);
    expect(state.rpc).toHaveBeenCalledWith(
      "fail_scheduler_job",
      expect.objectContaining({ _retryable: false, _external_post_id: "unit-test-post" }),
    );
  });
  it("recovers a lost acknowledgement only from a matching committed success row", async () => {
    state.rpc.mockImplementation(async (name: string) => ({
      data: name.startsWith("claim_")
        ? [job]
        : name === "fail_scheduler_job"
          ? { ...job, status: "succeeded", external_post_id: "unit-test-post" }
          : null,
      error: name === "complete_scheduler_job" ? { message: "ack lost" } : null,
    }));
    expect(await runSchedulerTick({ workspaceId })).toMatchObject({ succeeded: 1, failed: 0 });
  });
  it("never invokes a provider when an OAuth token is missing", async () => {
    state.token.mockRejectedValue(new Error("canal sem token OAuth — reconecte"));
    expect(await runSchedulerTick({ workspaceId })).toMatchObject({ succeeded: 0, failed: 1 });
    expect(state.publish).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledWith(
      "fail_scheduler_job",
      expect.objectContaining({ _retryable: false, _external_post_id: null }),
    );
  });
  it("rejects an unconfirmed null claim rather than labeling it an empty queue", async () => {
    state.rpc.mockResolvedValue({ data: null, error: null });
    await expect(runSchedulerTick({ workspaceId })).rejects.toThrow("confirmed job set");
  });
  it("records an accepted upstream reference without labeling pending public confirmation as success", async () => {
    state.publish.mockRejectedValue(
      new PublisherError("Pending provider visibility", {
        retryable: false,
        externalPostId: "qa-upstream-reference",
      }),
    );
    const result = await runSchedulerTick({ workspaceId });
    expect(result).toMatchObject({ succeeded: 0, failed: 1 });
    expect(state.rpc).toHaveBeenCalledWith(
      "fail_scheduler_job",
      expect.objectContaining({ _retryable: false, _external_post_id: "qa-upstream-reference" }),
    );
    expect(state.rpc).not.toHaveBeenCalledWith("complete_scheduler_job", expect.anything());
  });
});
