import { useCallback, useEffect, useState } from "react";

const KEY = "digitalos.current_workspace_id";

export function useCurrentWorkspaceId(fallback?: string | null) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(KEY);
    setId(stored || fallback || null);
  }, [fallback]);

  const update = useCallback((next: string | null) => {
    if (typeof window !== "undefined") {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    }
    setId(next);
  }, []);

  return [id, update] as const;
}
