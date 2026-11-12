export const WORKSPACE_STORAGE_KEY = "digitalos.current_workspace_id";

type WorkspaceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Listener = () => void;

/** A single browser snapshot shared by every workspace consumer in the same tab. */
export function createWorkspaceStore(getStorage: () => WorkspaceStorage | undefined) {
  let currentId: string | null = null;
  let initialized = false;
  const listeners = new Set<Listener>();

  const publish = (next: string | null) => {
    if (currentId === next) return;
    currentId = next;
    listeners.forEach((listener) => listener());
  };

  const set = (next: string | null) => {
    initialized = true;
    try {
      const storage = getStorage();
      if (next) storage?.setItem(WORKSPACE_STORAGE_KEY, next);
      else storage?.removeItem(WORKSPACE_STORAGE_KEY);
    } catch {
      // Private browsing / full storage must not prevent an in-memory selection.
    }
    publish(next);
  };

  const syncFromStorage = () => {
    try {
      const storage = getStorage();
      if (storage) publish(storage.getItem(WORKSPACE_STORAGE_KEY) || null);
    } catch {
      // Keep the in-memory snapshot when storage is inaccessible.
    }
  };

  return {
    getSnapshot: () => currentId,
    // Never share a browser selection between SSR requests or render it into HTML.
    getServerSnapshot: (): null => null,
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    initialize: (fallback?: string | null) => {
      if (!initialized) {
        initialized = true;
        syncFromStorage();
      }
      if (!currentId && fallback) set(fallback);
    },
    set,
    reset: () => set(null),
    syncFromStorage,
  };
}

/** A saved ID is a preference, not evidence of membership. */
export function resolveWorkspaceId(
  workspaces: ReadonlyArray<{ id: string }>,
  savedId?: string | null,
  defaultId?: string | null,
): string | null {
  const contains = (id?: string | null) => !!id && workspaces.some((w) => w.id === id);
  if (contains(savedId)) return savedId!;
  if (contains(defaultId)) return defaultId!;
  return workspaces[0]?.id ?? null;
}

export const workspaceStore = createWorkspaceStore(() =>
  typeof window === "undefined" ? undefined : window.localStorage,
);
