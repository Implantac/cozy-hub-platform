import { useEffect, useSyncExternalStore } from "react";
import { WORKSPACE_STORAGE_KEY, workspaceStore } from "./workspace-store";

/** All callers observe one snapshot, including updates made elsewhere in this tab. */
export function useCurrentWorkspaceId(fallback?: string | null) {
  const id = useSyncExternalStore(
    workspaceStore.subscribe,
    workspaceStore.getSnapshot,
    workspaceStore.getServerSnapshot,
  );

  useEffect(() => {
    workspaceStore.initialize(fallback);
  }, [fallback]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_STORAGE_KEY || event.key === null) {
        workspaceStore.syncFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return [id, workspaceStore.set] as const;
}
