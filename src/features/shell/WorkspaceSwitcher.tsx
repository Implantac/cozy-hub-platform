import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Workspace } from "./nav-groups";

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  current: Workspace | undefined;
  onSelect: (id: string) => void | Promise<void>;
  onCreate: (name: string) => Promise<void>;
}

export function WorkspaceSwitcher({
  workspaces,
  current,
  onSelect,
  onCreate,
}: WorkspaceSwitcherProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-ws-switcher]")) setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="px-3" data-ws-switcher>
      <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 transition hover:bg-sidebar-accent/50">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm"
          aria-expanded={open}
        >
          <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground">
            {(current?.name ?? "W").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{current?.name ?? "—"}</div>
            <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {current?.role} · {current?.plan}
            </div>
          </div>
          <ChevronDown className={cn("size-4 shrink-0 transition", open && "rotate-180")} />
        </button>
        {open && (
          <div className="border-t border-sidebar-border p-1">
            {workspaces.map((w) => {
              const isCurrent = w.id === current?.id;
              return (
                <button
                  key={w.id}
                  onClick={async () => {
                    setOpen(false);
                    if (!isCurrent) await onSelect(w.id);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent",
                    isCurrent && "text-primary",
                  )}
                >
                  <span className="truncate">{w.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                    {w.role}
                    {isCurrent && <Check className="size-3.5 text-primary" />}
                  </span>
                </button>
              );
            })}
            <button
              onClick={async () => {
                const name = window.prompt(t("workspace.newName"));
                if (name && name.trim()) {
                  setOpen(false);
                  await onCreate(name.trim());
                }
              }}
              className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-sidebar-accent"
            >
              <Plus className="size-3.5" /> {t("workspace.new")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
