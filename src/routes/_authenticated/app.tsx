import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Palette, Radio, FileText, Calendar, BarChart3,
  Brain, Target, Settings, LogOut, ChevronDown, Plus,
} from "lucide-react";
import { listMyWorkspaces, getMyProfile, createWorkspace, setDefaultWorkspace } from "@/lib/api/workspaces.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { signOut, useAuth } from "@/lib/auth/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

const NAV: Array<{ to: string; labelKey: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/app", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/brands", labelKey: "nav.brands", icon: Palette },
  { to: "/app/channels", labelKey: "nav.channels", icon: Radio },
  { to: "/app/content", labelKey: "nav.content", icon: FileText },
  { to: "/app/scheduler", labelKey: "nav.scheduler", icon: Calendar },
  { to: "/app/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { to: "/app/brain", labelKey: "nav.brain", icon: Brain },
  { to: "/app/missions", labelKey: "nav.missions", icon: Target },
];

function AppShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();
  const { t } = useTranslation();

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
    return <div className="grid min-h-screen place-items-center text-muted-foreground">{t("common.booting")}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand shadow-glow">
            <Brain className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">Digital OS</span>
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

        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          {NAV.map((item) => {
            const active = item.exact ? path === item.to : path.startsWith(item.to);
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                <item.icon className="size-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-0.5 border-t border-sidebar-border p-3">
          <LanguageSwitcher />
          <Link to="/app/settings" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground">
            <Settings className="size-4" /> {t("nav.settings")}
          </Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" /> {t("common.signOut")}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">
          {currentWs ? <Outlet /> : <div className="text-muted-foreground">{t("common.noWorkspace")}</div>}
        </div>
      </main>
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
  return (
    <div className="px-3">
      <details className="group rounded-lg border border-sidebar-border bg-sidebar-accent/30">
        <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <div className="truncate font-medium">{current?.name ?? "—"}</div>
            <div className="text-xs text-muted-foreground capitalize">{current?.role} · {current?.plan}</div>
          </div>
          <ChevronDown className="size-4 transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-sidebar-border p-1">
          {workspaces.map((w) => (
            <button key={w.id} onClick={() => onSelect(w.id)}
              className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-sidebar-accent ${w.id === current?.id ? "text-primary" : ""}`}>
              <span className="truncate">{w.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{w.role}</span>
            </button>
          ))}
          <button onClick={async () => {
              const name = window.prompt("New workspace name");
              if (name && name.trim()) await onCreate(name.trim());
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-sidebar-accent">
            <Plus className="size-3.5" /> New workspace
          </button>
        </div>
      </details>
    </div>
  );
}
