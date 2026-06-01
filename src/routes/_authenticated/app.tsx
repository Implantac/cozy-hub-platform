import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Palette, Radio, FileText, Calendar, BarChart3,
  Brain, Target, Settings, LogOut, ChevronDown, Plus, Search, Sparkles,
  Compass, TrendingUp, RadarIcon, Wand2, Activity, GraduationCap, ShoppingBag,
  Lightbulb, Shield,
} from "lucide-react";
import { listMyWorkspaces, getMyProfile, createWorkspace, setDefaultWorkspace } from "@/lib/api/workspaces.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { signOut, useAuth } from "@/lib/auth/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationDrawer } from "@/components/app/NotificationDrawer";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

type NavItem = { to: string; labelKey: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV_GROUPS: Array<{ labelKey: string; items: NavItem[] }> = [
  {
    labelKey: "nav.group.command",
    items: [
      { to: "/app", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
      { to: "/app/score", labelKey: "nav.score", icon: TrendingUp },
      { to: "/app/health", labelKey: "nav.health", icon: Activity },
    ],
  },
  {
    labelKey: "nav.group.growth",
    items: [
      { to: "/app/navigator", labelKey: "nav.navigator", icon: Compass },
      { to: "/app/opportunities", labelKey: "nav.opportunities", icon: RadarIcon },
      { to: "/app/decisions", labelKey: "nav.decisions", icon: Lightbulb },
      { to: "/app/trust", labelKey: "nav.trust", icon: Shield },
      { to: "/app/coach", labelKey: "nav.coach", icon: Wand2 },
      { to: "/app/learning", labelKey: "nav.learning", icon: GraduationCap },
    ],
  },
  {
    labelKey: "nav.group.operation",
    items: [
      { to: "/app/brands", labelKey: "nav.brands", icon: Palette },
      { to: "/app/channels", labelKey: "nav.channels", icon: Radio },
      { to: "/app/content", labelKey: "nav.content", icon: FileText },
      { to: "/app/scheduler", labelKey: "nav.scheduler", icon: Calendar },
    ],
  },
  {
    labelKey: "nav.group.intelligence",
    items: [
      { to: "/app/brain", labelKey: "nav.brain", icon: Brain },
      { to: "/app/brain-lab", labelKey: "nav.brain_lab", icon: Brain },
      { to: "/app/missions", labelKey: "nav.missions", icon: Target },
      { to: "/app/analytics", labelKey: "nav.analytics", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.group.commerce",
    items: [{ to: "/app/commerce", labelKey: "nav.commerce", icon: ShoppingBag }],
  },
];

function findBreadcrumb(path: string, t: (k: string) => string) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      const match = it.exact ? path === it.to : path.startsWith(it.to);
      if (match && !(it.exact && path !== it.to)) {
        return { group: t(g.labelKey), page: t(it.labelKey) };
      }
    }
  }
  if (path.includes("/settings")) return { group: t("nav.group.settings"), page: t("nav.settings") };
  return { group: t("nav.group.overview"), page: t("nav.dashboard") };
}

function AppShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();
  const { t } = useTranslation();
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  // Auto-onboarding: no workspace -> create one
  useEffect(() => {
    if (wsQuery.isSuccess && workspaces.length === 0 && auth.user) {
      const name = (auth.user.user_metadata?.full_name as string) ?? t("workspace.mine");
      createWs({ data: { name: `${name}` } })
        .then((ws) => { setCurrentWsId(ws.id); wsQuery.refetch(); toast.success(t("workspace.created")); })
        .catch((e) => toast.error(e.message));
    }
  }, [wsQuery.isSuccess, workspaces.length, auth.user, createWs, setCurrentWsId, wsQuery, t]);

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* SIDEBAR */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid size-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold tracking-tight">USE OS</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Digital Growth</div>
          </div>
        </div>

        <WorkspaceSwitcher
          workspaces={workspaces}
          current={currentWs}
          onSelect={async (id) => { setCurrentWsId(id); await setDefaultWs({ data: { workspaceId: id } }); }}
          onCreate={async (name) => {
            const ws = await createWs({ data: { name } });
            setCurrentWsId(ws.id); await wsQuery.refetch(); toast.success(t("workspace.created"));
          }}
        />

        <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey}>
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {t(group.labelKey)}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact ? path === item.to : path.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
                      }`}
                    >
                      <item.icon className={`size-4 transition ${active ? "text-primary" : ""}`} />
                      <span className="flex-1 truncate">{t(item.labelKey)}</span>
                      {active && <span className="size-1.5 rounded-full bg-primary" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-sidebar-border p-3">
          <LanguageSwitcher />
          <Link to="/app/settings" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground">
            <Settings className="size-4" /> {t("nav.settings")}
          </Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" /> {t("common.signOut")}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="text-muted-foreground">{crumb.group}</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="font-medium text-foreground">{crumb.page}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden h-9 items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground sm:flex"
            >
              <Search className="size-3.5" />
              <span>{t("palette.placeholder", "Buscar...")}</span>
              <kbd className="ml-4 rounded border border-border bg-background px-1.5 text-[10px] font-mono">⌘K</kbd>
            </button>
            <NotificationDrawer workspaceId={currentWs?.id} />
            <div className="grid size-9 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground shadow-glow">
              {(profileQuery.data?.display_name ?? auth.user?.email ?? "U").slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {currentWs ? <Outlet /> : <div className="text-muted-foreground">{t("common.noWorkspace")}</div>}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      {needsOnboarding && currentWs && (
        <OnboardingWizard
          open
          onClose={() => profileQuery.refetch()}
          workspaceId={currentWs.id}
          workspaceName={currentWs.name}
          userName={auth.user?.user_metadata?.full_name as string | undefined}
        />
      )}
    </div>
  );
}

function WorkspaceSwitcher({
  workspaces, current, onSelect, onCreate,
}: {
  workspaces: Array<{ id: string; name: string; plan: string; role: string }>;
  current: { id: string; name: string; plan: string; role: string } | undefined;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <div className="px-3">
      <details className="group rounded-xl border border-sidebar-border bg-sidebar-accent/30 transition hover:bg-sidebar-accent/50">
        <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm">
          <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground">
            {(current?.name ?? "W").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{current?.name ?? "—"}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{current?.role} · {current?.plan}</div>
          </div>
          <ChevronDown className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-sidebar-border p-1">
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => onSelect(w.id)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent ${w.id === current?.id ? "text-primary" : ""}`}
            >
              <span className="truncate">{w.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{w.role}</span>
            </button>
          ))}
          <button
            onClick={async () => {
              const name = window.prompt(t("workspace.newName"));
              if (name && name.trim()) await onCreate(name.trim());
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-sidebar-accent"
          >
            <Plus className="size-3.5" /> {t("workspace.new")}
          </button>
        </div>
      </details>
    </div>
  );
}
