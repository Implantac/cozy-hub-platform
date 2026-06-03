import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain } from "lucide-react";
import { hasSeenTour, ProductTour } from "@/components/app/ProductTour";
import { signOut } from "@/lib/auth/use-auth";
import { CommandPalette } from "@/components/app/CommandPalette";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcuts } from "@/components/app/KeyboardShortcuts";
import { AppShellLayout } from "@/features/shell/AppShellLayout";
import { useSidebarCollapse } from "@/features/shell/hooks/useSidebarCollapse";
import { useShortcutsHotkey } from "@/features/shell/hooks/useShortcutsHotkey";
import { useWorkspaceBootstrap } from "@/features/shell/hooks/useWorkspaceBootstrap";
import { findBreadcrumb } from "@/features/shell/nav-groups";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  useShortcutsHotkey(() => setShortcutsOpen((v) => !v));

  useEffect(() => {
    const onTourStart = () => setTourOpen(true);
    window.addEventListener("digitalos:tour-start", onTourStart);
    return () => window.removeEventListener("digitalos:tour-start", onTourStart);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [path]);

  const {
    auth, wsQuery, profileQuery, workspaces, currentWs,
    handleSelectWs, handleCreateWs,
  } = useWorkspaceBootstrap();

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

  const handleSignOut = async () => { await signOut(); navigate({ to: "/login" }); };

  return (
    <TooltipProvider delayDuration={150}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-glow"
      >
        {t("a11y.skipToContent", "Pular para o conteúdo")}
      </a>

      <AppShellLayout
        path={path}
        collapsed={collapsed}
        toggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        workspaces={workspaces}
        currentWs={currentWs}
        onSelectWs={handleSelectWs}
        onCreateWs={handleCreateWs}
        onSignOut={handleSignOut}
        crumb={crumb}
        userInitial={userInitial}
        displayName={displayName}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenTour={() => setTourOpen(true)}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

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
    </TooltipProvider>
  );
}
