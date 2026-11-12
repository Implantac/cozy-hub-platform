import { describe, it, expect, vi } from "vitest";
import { readAllPages } from "../_pagination";
describe("complete paginated reads", () => {
  it("reads successive stable ranges including the final short page", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: [3, 4], error: null })
      .mockResolvedValueOnce({ data: [5], error: null });
    expect(await readAllPages(fn, { pageSize: 2 })).toEqual([1, 2, 3, 4, 5]);
    expect(fn.mock.calls).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });
  it("does not label an empty response body as an empty successful dataset", async () => {
    await expect(readAllPages(async () => ({ data: null, error: null }))).rejects.toThrow(
      "dados esperados",
    );
  });
  it("propagates errors on later pages instead of exporting a partial total", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2], error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "page unavailable" } });
    await expect(readAllPages(fn, { pageSize: 2 })).rejects.toThrow("page unavailable");
  });
  it("fails explicitly beyond the safety ceiling instead of silently truncating", async () => {
    await expect(
      readAllPages(async () => ({ data: [1, 2], error: null }), { pageSize: 2, maxRows: 3 }),
    ).rejects.toThrow("Reduza o período");
  });
  it("handles an actually empty successful table", async () => {
    expect(await readAllPages(async () => ({ data: [], error: null }))).toEqual([]);
  });
});
