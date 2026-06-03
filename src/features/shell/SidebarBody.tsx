import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isItemActive, type Workspace } from "./nav-groups";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const TOUR_KEYS: Record<string, string> = {
  "/app": "dashboard",
  "/app/brain": "brain",
  "/app/builder": "builder",
  "/app/content": "content",
};

interface SidebarBodyProps {
  path: string;
  collapsed: boolean;
  workspaces: Workspace[];
  currentWs: Workspace | undefined;
  onSelectWs: (id: string) => void | Promise<void>;
  onCreateWs: (name: string) => Promise<void>;
  onSignOut: () => void | Promise<void>;
  onToggleCollapse?: () => void;
}

export function SidebarBody({
  path, collapsed, workspaces, currentWs, onSelectWs, onCreateWs, onSignOut, onToggleCollapse,
}: SidebarBodyProps) {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col">
      <div data-tour="brand" className={cn("flex items-center gap-2.5 py-5", collapsed ? "px-3 justify-center" : "px-5")}>
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-brand shadow-glow">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold tracking-tight text-gradient-brand">VELT</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Digital Growth</div>
          </div>
        )}
        {!collapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden rounded-md p-1.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-foreground lg:inline-flex"
            aria-label={t("nav.collapse", "Recolher menu")}
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {collapsed ? (
        <div data-tour="workspace" className="flex justify-center pb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid size-9 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground shadow-glow">
                {(currentWs?.name ?? "W").slice(0, 1).toUpperCase()}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">{currentWs?.name ?? "—"}</TooltipContent>
          </Tooltip>
        </div>
      ) : (
        <div data-tour="workspace">
          <WorkspaceSwitcher workspaces={workspaces} current={currentWs} onSelect={onSelectWs} onCreate={onCreateWs} />
        </div>
      )}

      <nav className={cn("mt-4 flex-1 overflow-y-auto pb-3", collapsed ? "px-2 space-y-3" : "px-3 space-y-5")}>
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            {!collapsed && (
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                {t(group.labelKey)}
              </div>
            )}
            {collapsed && <div className="mx-2 mb-1.5 h-px bg-sidebar-border/60" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(path, item);
                const link = (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-tour={TOUR_KEYS[item.to]}
                    className={cn(
                      "group relative flex items-center rounded-lg text-sm transition-colors duration-200",
                      collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2 min-h-9",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-brand shadow-glow-sm" />
                    )}
                    <item.icon className={cn("size-4 transition-colors", active ? "text-primary" : "group-hover:text-foreground")} />
                    {!collapsed && <span className="flex-1 truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip key={item.to}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                  </Tooltip>
                ) : link;
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("space-y-0.5 border-t border-sidebar-border p-3", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to="/app/settings" className="flex items-center justify-center rounded-lg px-2 py-2 text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
                <Settings className="size-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{t("nav.settings")}</TooltipContent>
          </Tooltip>
        ) : (
          <Link to="/app/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
            <Settings className="size-4" /> {t("nav.settings")}
          </Link>
        )}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onSignOut} className="flex w-full items-center justify-center rounded-lg px-2 py-2 text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
                <LogOut className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("common.signOut")}</TooltipContent>
          </Tooltip>
        ) : (
          <button onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
            <LogOut className="size-4" /> {t("common.signOut")}
          </button>
        )}

        {collapsed && onToggleCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onToggleCollapse}
                className="mt-1 hidden w-full items-center justify-center rounded-lg px-2 py-2 text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground lg:flex"
                aria-label={t("nav.expand", "Expandir menu")}
              >
                <PanelLeftOpen className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t("nav.expand", "Expandir menu")}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
