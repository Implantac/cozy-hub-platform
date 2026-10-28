import { useEffect, useState } from "react";
import { SIDEBAR_COLLAPSE_KEY } from "@/features/shell/nav-groups";

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    const onToggle = () => setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    window.addEventListener("digitalos:sidebar-toggle", onToggle);
    return () => window.removeEventListener("digitalos:sidebar-toggle", onToggle);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined")
        window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return { collapsed, toggleCollapsed };
}
