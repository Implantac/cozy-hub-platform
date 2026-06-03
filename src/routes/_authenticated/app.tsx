import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Brain } from "lucide-react";
import { toast } from "sonner";
import {
  createWorkspace, getMyProfile, listMyWorkspaces, setDefaultWorkspace,
} from "@/lib/api/workspaces.functions";
import { hasSeenTour, ProductTour } from "@/components/app/ProductTour";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { signOut, useAuth } from "@/lib/auth/use-auth";
import { CommandPalette } from "@/components/app/CommandPalette";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcuts } from "@/components/app/KeyboardShortcuts";
import { cn } from "@/lib/utils";
import { AppHeader } from "@/features/shell/AppHeader";
import { SidebarBody } from "@/features/shell/SidebarBody";
import { findBreadcrumb, SIDEBAR_COLLAPSE_KEY } from "@/features/shell/nav-groups";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();
  const { t } = useTranslation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    const onToggle = () => setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "1");
    const onTourStart = () => setTourOpen(true);
    window.addEventListener("digitalos:sidebar-toggle", onToggle);
    window.addEventListener("digitalos:tour-start", onTourStart);
    return () => {
      window.removeEventListener("digitalos:sidebar-toggle", onToggle);
      window.removeEventListener("digitalos:tour-start", onTourStart);
    };
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (!isTyping && e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [path]);

  const fetchWs = useServerFn(listMyWorkspaces);
  const fetchProfile = useServerFn(getMyProfile);
  const createWs = useServerFn(createWorkspace);
  const setDefaultWs = useServerFn(setDefaultWorkspace);

  const wsQuery = useQuery({ queryKey: ["my-workspaces"], queryFn: () => fetchWs(), enabled: !!auth.user });
  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile(), enabled: !!auth.user });

  const [currentWsId, setCurrentWsId] = useCurrentWorkspaceId(profileQuery.data?.default_workspace_id ?? null);
  const workspaces = wsQuery.data ?? [];
  const currentWs = workspaces.find((w) => w.id === currentWsId) ?? workspaces[0];

  useEffect(() => {
    if (!currentWsId && currentWs?.id) setCurrentWsId(currentWs.id);
  }, [currentWsId, currentWs?.id, setCurrentWsId]);

  const bootstrappingRef = useRef(false);
  useEffect(() => {
    if (!wsQuery.isSuccess || workspaces.length !== 0 || !auth.user || bootstrappingRef.current) return;
    bootstrappingRef.current = true;
    const name = (auth.user.user_metadata?.full_name as string) ?? t("workspace.mine");
    createWs({ data: { name: `${name}` } })
      .then((ws) => { setCurrentWsId(ws.id); wsQuery.refetch(); toast.success(t("workspace.created")); })
      .catch((e) => { bootstrappingRef.current = false; toast.error(e.message); });
  }, [wsQuery.isSuccess, workspaces.length, auth.user, createWs, setCurrentWsId, wsQuery, t]);

  useEffect(() => {
    const p = profileQuery.data;
    if (!p?.onboarding_completed) return;
    if (hasSeenTour()) return;
    const id = window.setTimeout(() => setTourOpen(true), 600);
    return () => window.clearTimeout(id);
  }, [profileQuery.data?.onboarding_completed]);

  if (auth.loading || wsQuery.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-12 place-items-center rounded-xl bg-gradient-brand shadow-glow animate-pulse">
            <Brain className="size-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t("common.booting")}</p>
        </div>
      </div>
    );
  }

  const crumb = findBreadcrumb(path, t);
  const needsOnboarding = profileQuery.data && !profileQuery.data.onboarding_completed && !!currentWs;
  const displayName = profileQuery.data?.display_name ?? auth.user?.email ?? "—";
  const userInitial = (profileQuery.data?.display_name ?? auth.user?.email ?? "U").slice(0, 1).toUpperCase();

  const handleSelectWs = async (id: string) => {
    setCurrentWsId(id);
    await setDefaultWs({ data: { workspaceId: id } });
  };
  const handleCreateWs = async (name: string) => {
    const ws = await createWs({ data: { name } });
    setCurrentWsId(ws.id);
    await wsQuery.refetch();
    toast.success(t("workspace.created"));
  };
  const handleSignOut = async () => { await signOut(); navigate({ to: "/login" }); };

  return (
    <TooltipProvider delayDuration={150}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-glow"
      >
        {t("a11y.skipToContent", "Pular para o conteúdo")}
      </a>
      <div className="flex min-h-dvh bg-background">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col",
            collapsed ? "w-[68px]" : "w-64",
          )}
        >
          <SidebarBody
            path={path}
            collapsed={collapsed}
            workspaces={workspaces}
            currentWs={currentWs}
            onSelectWs={handleSelectWs}
            onCreateWs={handleCreateWs}
            onSignOut={handleSignOut}
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
              onSelectWs={handleSelectWs}
              onCreateWs={handleCreateWs}
              onSignOut={handleSignOut}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            crumb={crumb}
            userInitial={userInitial}
            displayName={displayName}
            workspaceId={currentWs?.id}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenMobileNav={() => setMobileOpen(true)}
            onOpenTour={() => setTourOpen(true)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />

          <main id="main-content" className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8 animate-rise-in">
              {currentWs ? <Outlet /> : <div className="text-muted-foreground">{t("common.noWorkspace")}</div>}
            </div>
          </main>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onShowShortcuts={() => setShortcutsOpen(true)} />
        <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        {needsOnboarding && currentWs && (
          <OnboardingWizard
            open
            onClose={() => profileQuery.refetch()}
            workspaceId={currentWs.id}
            workspaceName={currentWs.name}
            userName={auth.user?.user_metadata?.full_name as string | undefined}
          />
        )}
        <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} />
      </div>
    </TooltipProvider>
  );
}
