import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/features/shell/AppHeader";
import { SidebarBody } from "@/features/shell/SidebarBody";
import { findBreadcrumb, type Workspace } from "@/features/shell/nav-groups";

type Props = {
  path: string;
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  workspaces: Workspace[];
  currentWs?: Workspace;
  onSelectWs: (id: string) => Promise<void> | void;
  onCreateWs: (name: string) => Promise<void>;
  onSignOut: () => void;
  crumb: ReturnType<typeof findBreadcrumb>;
  userInitial: string;
  displayName: string;
  onOpenPalette: () => void;
  onOpenTour: () => void;
  onOpenShortcuts: () => void;
};

export function AppShellLayout({
  path, collapsed, toggleCollapsed, mobileOpen, setMobileOpen,
  workspaces, currentWs, onSelectWs, onCreateWs, onSignOut,
  crumb, userInitial, displayName,
  onOpenPalette, onOpenTour, onOpenShortcuts,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-sidebar-border/50 bg-sidebar/95 text-sidebar-foreground transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex lg:flex-col",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <SidebarBody
          path={path}
          collapsed={collapsed}
          workspaces={workspaces}
          currentWs={currentWs}
          onSelectWs={onSelectWs}
          onCreateWs={onCreateWs}
          onSignOut={onSignOut}
          onToggleCollapse={toggleCollapsed}
        />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">VELT</SheetTitle>
          <SidebarBody
            path={path}
            collapsed={false}
            workspaces={workspaces}
            currentWs={currentWs}
            onSelectWs={onSelectWs}
            onCreateWs={onCreateWs}
            onSignOut={onSignOut}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          crumb={crumb}
          userInitial={userInitial}
          displayName={displayName}
          workspaceId={currentWs?.id}
          onOpenPalette={onOpenPalette}
          onOpenMobileNav={() => setMobileOpen(true)}
          onOpenTour={onOpenTour}
          onOpenShortcuts={onOpenShortcuts}
        />

        <main id="main-content" className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-8 lg:px-10 lg:py-10 animate-rise-in">
            {currentWs ? <Outlet /> : <div className="text-muted-foreground">{t("common.noWorkspace")}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
