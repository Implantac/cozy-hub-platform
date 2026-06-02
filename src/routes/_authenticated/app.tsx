import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Palette, Radio, FileText, Calendar, BarChart3,
  Brain, Target, Settings, LogOut, ChevronDown, Plus, Search, Sparkles,
  Compass, TrendingUp, RadarIcon, Wand2, Activity, GraduationCap, ShoppingBag,
  Lightbulb, Shield, Menu, PanelLeftClose, PanelLeftOpen, Check, FlaskConical,
  Rocket, GitBranch, Brain as BrainIcon,
} from "lucide-react";
import { listMyWorkspaces, getMyProfile, createWorkspace, setDefaultWorkspace } from "@/lib/api/workspaces.functions";
import { hasSeenTour } from "@/components/app/ProductTour";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { signOut, useAuth } from "@/lib/auth/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationDrawer } from "@/components/app/NotificationDrawer";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProductTour, resetTour } from "@/components/app/ProductTour";
import { KeyboardShortcuts } from "@/components/app/KeyboardShortcuts";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { HelpCircle, Keyboard, RefreshCw, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

type NavItem = { to: string; labelKey: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV_GROUPS: Array<{ labelKey: string; items: NavItem[] }> = [
  {
    labelKey: "nav.group.gps",
    items: [
      { to: "/app", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/score", labelKey: "nav.score", icon: TrendingUp },
      { to: "/app/health", labelKey: "nav.health", icon: Activity },
    ],
  },
  {
    labelKey: "nav.group.decision",
    items: [
      { to: "/app/navigator", labelKey: "nav.navigator", icon: Compass },
      { to: "/app/journey", labelKey: "nav.journey", icon: GitBranch },
      { to: "/app/builder", labelKey: "nav.builder", icon: Rocket },
      { to: "/app/opportunities", labelKey: "nav.opportunities", icon: RadarIcon },
      { to: "/app/competitors", labelKey: "nav.competitors", icon: RadarIcon },
      { to: "/app/decisions", labelKey: "nav.decisions", icon: Lightbulb },
    ],
  },
  {
    labelKey: "nav.group.trust",
    items: [
      { to: "/app/trust", labelKey: "nav.trust", icon: Shield },
    ],
  },
  {
    labelKey: "nav.group.execution",
    items: [
      { to: "/app/brands", labelKey: "nav.brands", icon: Palette },
      { to: "/app/channels", labelKey: "nav.channels", icon: Radio },
      { to: "/app/content", labelKey: "nav.content", icon: FileText },
      { to: "/app/scheduler", labelKey: "nav.scheduler", icon: Calendar },
    ],
  },
  {
    labelKey: "nav.group.growth",
    items: [
      { to: "/app/coach", labelKey: "nav.coach", icon: Wand2 },
      { to: "/app/missions", labelKey: "nav.missions", icon: Target },
      { to: "/app/skill-map", labelKey: "nav.skill_map", icon: BrainIcon },
      { to: "/app/learning", labelKey: "nav.learning", icon: GraduationCap },
      { to: "/app/analytics", labelKey: "nav.analytics", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.group.brain",
    items: [
      { to: "/app/brain", labelKey: "nav.brain", icon: Brain, exact: true },
      { to: "/app/brain-lab", labelKey: "nav.brain_lab", icon: FlaskConical },
    ],
  },
  {
    labelKey: "nav.group.commerce",
    items: [{ to: "/app/commerce", labelKey: "nav.commerce", icon: ShoppingBag }],
  },
];

// Boundary-aware active check: `/app/brain` no longer matches `/app/brain-lab`.
function isItemActive(path: string, item: NavItem) {
  if (item.exact) return path === item.to;
  return path === item.to || path.startsWith(item.to + "/");
}

function findBreadcrumb(path: string, t: (k: string) => string) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (isItemActive(path, it)) return { group: t(g.labelKey), page: t(it.labelKey) };
    }
  }
  if (path.includes("/settings")) return { group: t("nav.group.settings"), page: t("nav.settings") };
  return { group: t("nav.group.overview"), page: t("nav.dashboard") };
}

const COLLAPSE_KEY = "digitalos.sidebar_collapsed";

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

  // Hydrate collapsed state from localStorage (client-only) + listen for palette toggle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    const onToggle = () => {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    };
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
      if (typeof window !== "undefined") window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  // Global "?" shortcut to open keyboard shortcuts dialog.
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

  // Close mobile drawer on route change.
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

  // Auto-launch product tour once after onboarding completes — persisted in localStorage.
  useEffect(() => {
    const p = profileQuery.data;
    if (!p?.onboarding_completed) return;
    if (hasSeenTour()) return;
    const id = window.setTimeout(() => setTourOpen(true), 600);
    return () => window.clearTimeout(id);
  }, [profileQuery.data?.onboarding_completed]);

  if (auth.loading || wsQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
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

  const sidebarBody = (
    <SidebarBody
      path={path}
      collapsed={collapsed}
      workspaces={workspaces}
      currentWs={currentWs}
      onSelectWs={async (id) => { setCurrentWsId(id); await setDefaultWs({ data: { workspaceId: id } }); }}
      onCreateWs={async (name) => {
        const ws = await createWs({ data: { name } });
        setCurrentWsId(ws.id); await wsQuery.refetch(); toast.success(t("workspace.created"));
      }}
      onSignOut={async () => { await signOut(); navigate({ to: "/login" }); }}
      onToggleCollapse={toggleCollapsed}
    />
  );

  return (
    <TooltipProvider delayDuration={150}>
      {/* Skip to content for keyboard / screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-glow"
      >
        {t("a11y.skipToContent", "Pular para o conteúdo")}
      </a>
      <div className="flex min-h-screen bg-background">
        {/* DESKTOP SIDEBAR */}
        <aside
          className={cn(
            "hidden shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex lg:flex-col",
            collapsed ? "w-[68px]" : "w-64",
          )}
        >
          {sidebarBody}
        </aside>

        {/* MOBILE SIDEBAR */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">VELT</SheetTitle>
            <SidebarBody
              path={path}
              collapsed={false}
              workspaces={workspaces}
              currentWs={currentWs}
              onSelectWs={async (id) => { setCurrentWsId(id); await setDefaultWs({ data: { workspaceId: id } }); }}
              onCreateWs={async (name) => {
                const ws = await createWs({ data: { name } });
                setCurrentWsId(ws.id); await wsQuery.refetch(); toast.success(t("workspace.created"));
              }}
              onSignOut={async () => { await signOut(); navigate({ to: "/login" }); }}
            />
          </SheetContent>
        </Sheet>

        {/* MAIN */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/50 bg-background/75 px-4 backdrop-blur-xl backdrop-saturate-150 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 text-sm">
              <button
                onClick={() => setMobileOpen(true)}
                className="press inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </button>
              <span className="hidden text-muted-foreground/80 sm:inline">{crumb.group}</span>
              <span className="hidden text-muted-foreground/30 sm:inline">/</span>
              <span className="truncate font-medium text-foreground">{crumb.page}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                data-tour="search"
                onClick={() => setPaletteOpen(true)}
                className="press hidden h-9 items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-card hover:text-foreground hover:shadow-glow-sm sm:flex"
              >
                <Search className="size-3.5" />
                <span className="text-xs">{t("palette.placeholder", "Buscar...")}</span>
                <kbd className="ml-6 rounded border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
              </button>
              {/* Mobile: icon-only search trigger */}
              <button
                onClick={() => setPaletteOpen(true)}
                className="press inline-flex size-9 items-center justify-center rounded-lg border border-border/60 bg-card/50 text-muted-foreground transition hover:border-primary/30 hover:bg-card hover:text-foreground sm:hidden"
                aria-label={t("palette.placeholder", "Buscar")}
              >
                <Search className="size-4" />
              </button>
              <div className="hidden sm:block">
                <LanguageSwitcher compact />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setTourOpen(true)}
                    className="press hidden size-9 items-center justify-center rounded-lg border border-border/60 bg-card/50 text-muted-foreground transition hover:border-primary/30 hover:bg-card hover:text-foreground sm:inline-flex"
                    aria-label={t("tour.start", "Iniciar tour")}
                  >
                    <HelpCircle className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t("tour.start", "Iniciar tour")}</TooltipContent>
              </Tooltip>
              <div data-tour="notifications">
                <NotificationDrawer workspaceId={currentWs?.id} />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={t("nav.account", "Conta")}
                    className="press grid size-9 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground shadow-glow-sm ring-1 ring-primary/20 transition hover:shadow-glow"
                  >
                    {(profileQuery.data?.display_name ?? auth.user?.email ?? "U").slice(0, 1).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">
                    {profileQuery.data?.display_name ?? auth.user?.email ?? "—"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate({ to: "/app/settings" })}>
                    <User className="mr-2 size-4" /> {t("nav.profile", "Perfil & conta")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate({ to: "/app/settings" })}>
                    <Settings className="mr-2 size-4" /> {t("nav.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                    <Keyboard className="mr-2 size-4" /> {t("shortcuts.title", "Atalhos de teclado")}
                    <span className="ml-auto text-[10px] text-muted-foreground">?</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { resetTour(); setTourOpen(true); }}>
                    <RefreshCw className="mr-2 size-4" /> {t("tour.restart", "Reiniciar tour")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async () => { await signOut(); navigate({ to: "/login" }); }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 size-4" /> {t("common.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>


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
        <ProductTour
          open={tourOpen}
          onClose={() => setTourOpen(false)}
        />
      </div>
    </TooltipProvider>
  );
}

type Workspace = { id: string; name: string; plan: string; role: string };

function SidebarBody({
  path, collapsed, workspaces, currentWs, onSelectWs, onCreateWs, onSignOut, onToggleCollapse,
}: {
  path: string;
  collapsed: boolean;
  workspaces: Workspace[];
  currentWs: Workspace | undefined;
  onSelectWs: (id: string) => void | Promise<void>;
  onCreateWs: (name: string) => Promise<void>;
  onSignOut: () => void | Promise<void>;
  onToggleCollapse?: () => void;
}) {
  const { t } = useTranslation();

  const TOUR_KEYS: Record<string, string> = {
    "/app": "dashboard",
    "/app/brain": "brain",
    "/app/builder": "builder",
    "/app/content": "content",
  };

  return (
    <div className="flex h-full flex-col">
      {/* BRAND */}
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

      {/* WORKSPACE */}
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

      {/* NAV */}
      <nav className={cn("mt-4 flex-1 overflow-y-auto pb-3", collapsed ? "px-2 space-y-3" : "px-3 space-y-5")}>
        {NAV_GROUPS.map((group) => (
          <div key={group.labelKey}>
            {!collapsed && (
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t(group.labelKey)}
              </div>
            )}
            {collapsed && <div className="mx-2 mb-1.5 h-px bg-sidebar-border/70" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isItemActive(path, item);
                const link = (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-tour={TOUR_KEYS[item.to]}
                    className={cn(
                      "group relative flex items-center rounded-lg text-sm transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      collapsed ? "justify-center px-2 py-2" : "gap-2.5 px-3 py-2",
                      active
                        ? "bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-soft ring-1 ring-primary/20"
                        : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground hover:translate-x-0.5",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && !collapsed && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-gradient-brand shadow-glow-sm" />
                    )}
                    <item.icon className={cn("size-4 transition-all duration-200", active ? "text-primary scale-110" : "group-hover:text-foreground group-hover:scale-105")} />
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

      {/* FOOTER */}
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

function WorkspaceSwitcher({
  workspaces, current, onSelect, onCreate,
}: {
  workspaces: Workspace[];
  current: Workspace | undefined;
  onSelect: (id: string) => void | Promise<void>;
  onCreate: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  // Close on outside click.
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
                  onClick={async () => { setOpen(false); if (!isCurrent) await onSelect(w.id); }}
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
                if (name && name.trim()) { setOpen(false); await onCreate(name.trim()); }
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
