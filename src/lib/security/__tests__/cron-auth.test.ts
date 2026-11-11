import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCronPost, verifyCronRequest } from "../cron-auth.server";

const SECRET = "cron-test-secret-".repeat(3);

function request(headers?: HeadersInit) {
  return new Request("https://app.example.test/api/public/cron/scheduler-tick", {
    method: "POST",
    headers,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("verifyCronRequest", () => {
  it("fails closed when the secret is absent or too short", () => {
    expect(verifyCronRequest(request(), "")).toBe("not_configured");
    expect(verifyCronRequest(request(), "weak-secret")).toBe("not_configured");
  });

  it("accepts only the dedicated x-cron-secret header", () => {
    expect(verifyCronRequest(request({ "x-cron-secret": SECRET }), SECRET)).toBe("authorized");
    expect(verifyCronRequest(request({ apikey: SECRET }), SECRET)).toBe("unauthorized");
    expect(verifyCronRequest(request({ "x-cron-secret": "wrong-secret" }), SECRET)).toBe(
      "unauthorized",
    );
    expect(verifyCronRequest(request(), SECRET)).toBe("unauthorized");
  });
});

describe("handleCronPost", () => {
  it("returns 503 and never runs work when no secret is configured", async () => {
    const run = vi.fn().mockResolvedValue({ claimed: 0 });
    const response = await handleCronPost(request(), {
      routeName: "test",
      expectedSecret: "",
      run,
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cron_not_configured" });
    expect(run).not.toHaveBeenCalled();
  });

  it("rejects publishable-key-style requests before running work", async () => {
    const run = vi.fn().mockResolvedValue({ claimed: 0 });
    const response = await handleCronPost(request({ apikey: SECRET }), {
      routeName: "test",
      expectedSecret: SECRET,
      run,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(run).not.toHaveBeenCalled();
  });

  it("executes work after verifying the secret and disables caching", async () => {
    const run = vi.fn().mockResolvedValue({ claimed: 2, succeeded: 2 });
    const response = await handleCronPost(request({ "x-cron-secret": SECRET }), {
      routeName: "test",
      expectedSecret: SECRET,
      run,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, claimed: 2, succeeded: 2 });
    expect(run).toHaveBeenCalledOnce();
  });

  it("does not return internal error details to the caller", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = vi.fn().mockRejectedValue(new Error("private database detail"));
    const response = await handleCronPost(request({ "x-cron-secret": SECRET }), {
      routeName: "test",
      expectedSecret: SECRET,
      run,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "internal_error" });
    expect(run).toHaveBeenCalledOnce();
  });
});
