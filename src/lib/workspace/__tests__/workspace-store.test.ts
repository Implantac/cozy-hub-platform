import { describe, expect, it, vi } from "vitest";
import {
  createWorkspaceStore,
  resolveWorkspaceId,
  WORKSPACE_STORAGE_KEY,
} from "../workspace-store";

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("workspace shared snapshot", () => {
  it("notifies every mounted consumer on same-tab selection", () => {
    const disk = storage();
    const store = createWorkspaceStore(() => disk);
    const shell = vi.fn();
    const content = vi.fn();
    store.subscribe(shell);
    store.subscribe(content);
    store.initialize();
    store.set("workspace-a");
    expect(store.getSnapshot()).toBe("workspace-a");
    expect(disk.getItem(WORKSPACE_STORAGE_KEY)).toBe("workspace-a");
    expect(shell).toHaveBeenCalledTimes(1);
    expect(content).toHaveBeenCalledTimes(1);
  });
  it("restores a saved preference only on initialization", () => {
    const disk = storage();
    disk.setItem(WORKSPACE_STORAGE_KEY, "saved");
    const store = createWorkspaceStore(() => disk);
    expect(store.getSnapshot()).toBeNull();
    store.initialize("default");
    expect(store.getSnapshot()).toBe("saved");
    store.set("selected");
    store.initialize("default");
    expect(store.getSnapshot()).toBe("selected");
  });
  it("uses a profile fallback in a fresh browser and informs other consumers", () => {
    const store = createWorkspaceStore(() => storage());
    const module = vi.fn();
    store.subscribe(module);
    store.initialize("profile-default");
    expect(module).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBe("profile-default");
  });
  it("updates from another tab and resets on external logout", () => {
    const disk = storage();
    const store = createWorkspaceStore(() => disk);
    store.initialize();
    disk.setItem(WORKSPACE_STORAGE_KEY, "other-tab");
    store.syncFromStorage();
    expect(store.getSnapshot()).toBe("other-tab");
    disk.removeItem(WORKSPACE_STORAGE_KEY);
    store.syncFromStorage();
    expect(store.getSnapshot()).toBeNull();
  });
  it("clears both memory and storage when signing out", () => {
    const disk = storage();
    const store = createWorkspaceStore(() => disk);
    store.set("private");
    store.reset();
    expect(store.getSnapshot()).toBeNull();
    expect(disk.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    store.initialize();
    expect(store.getSnapshot()).toBeNull();
  });
  it("continues in memory when browser storage is blocked", () => {
    const store = createWorkspaceStore(() => {
      throw new Error("blocked");
    });
    expect(() => store.initialize()).not.toThrow();
    store.set("valid");
    store.syncFromStorage();
    expect(store.getSnapshot()).toBe("valid");
    store.reset();
    expect(store.getSnapshot()).toBeNull();
  });
  it("does not publish duplicate values and unsubscribes cleanly", () => {
    const store = createWorkspaceStore(() => undefined);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set("a");
    store.set("a");
    unsubscribe();
    store.set("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it("never exposes a browser workspace in a server snapshot", () => {
    const store = createWorkspaceStore(() => storage());
    store.set("private");
    expect(store.getServerSnapshot()).toBeNull();
  });
});

describe("membership-aware selection", () => {
  const memberships = [{ id: "a" }, { id: "b" }];
  it("keeps a valid saved selection", () => {
    expect(resolveWorkspaceId(memberships, "b", "a")).toBe("b");
  });
  it("rejects another user's saved ID and uses an authorized default", () => {
    expect(resolveWorkspaceId(memberships, "foreign", "b")).toBe("b");
  });
  it("rejects a stale default and falls back to an existing membership", () => {
    expect(resolveWorkspaceId(memberships, "foreign", "deleted")).toBe("a");
  });
  it("returns null rather than accepting an ID when no membership exists", () => {
    expect(resolveWorkspaceId([], "foreign", "a")).toBeNull();
  });
});
