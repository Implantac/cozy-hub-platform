import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain } from "lucide-react";
import { ProductTour } from "@/components/app/ProductTour";
import { signOut } from "@/lib/auth/use-auth";
import { CommandPalette } from "@/components/app/CommandPalette";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcuts } from "@/components/app/KeyboardShortcuts";
import { AppShellLayout } from "@/features/shell/AppShellLayout";
import { useSidebarCollapse } from "@/features/shell/hooks/useSidebarCollapse";
import { useShortcutsHotkey } from "@/features/shell/hooks/useShortcutsHotkey";
import { useWorkspaceBootstrap } from "@/features/shell/hooks/useWorkspaceBootstrap";
import { toast } from "sonner";
import { errorMessage } from "@/lib/json";
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
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingRequested, setOnboardingRequested] = useState(false);

  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  useShortcutsHotkey(() => setShortcutsOpen((v) => !v));

  useEffect(() => {
    const onSetupStart = () => setOnboardingRequested(true);
    window.addEventListener("digitalos:onboarding-start", onSetupStart);
    return () => window.removeEventListener("digitalos:onboarding-start", onSetupStart);
  }, []);

  useEffect(() => {
    const onTourStart = () => setTourOpen(true);
    window.addEventListener("digitalos:tour-start", onTourStart);
    return () => window.removeEventListener("digitalos:tour-start", onTourStart);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  const {
    auth,
    wsQuery,
    profileQuery,
    workspaces,
    currentWs,
    workspaceError,
    isWorkspaceReady,
    retryBootstrap,
    handleSelectWs,
    handleCreateWs,
  } = useWorkspaceBootstrap();

  if (!workspaceError && (auth.loading || !isWorkspaceReady)) {
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

  if (workspaceError) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background px-4">
        <section role="alert" aria-live="polite" className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">{t("errors.workspaceUnavailable")}</h1>
          <button
            type="button"
            onClick={retryBootstrap}
            disabled={wsQuery.isFetching}
            className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {wsQuery.isFetching ? t("common.loading") : t("common.tryAgain")}
          </button>
        </section>
      </div>
    );
  }

  const crumb = findBreadcrumb(path, t);
  const needsOnboarding =
    !!currentWs &&
    (onboardingRequested ||
      (profileQuery.data && !profileQuery.data.onboarding_completed && !onboardingDismissed));
  const displayName = profileQuery.data?.display_name ?? auth.user?.email ?? "—";
  const userInitial = (profileQuery.data?.display_name ?? auth.user?.email ?? "U")
    .slice(0, 1)
    .toUpperCase();

  const handleSignOut = async () => {
    try {
      await signOut();
      await navigate({ to: "/login", replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

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

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      {needsOnboarding && currentWs && (
        <OnboardingWizard
          open
          onClose={() => {
            setOnboardingRequested(false);
            setOnboardingDismissed(true);
            void profileQuery.refetch();
          }}
          workspaceId={currentWs.id}
          workspaceName={currentWs.name}
          userName={auth.user?.user_metadata?.full_name as string | undefined}
        />
      )}
      <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} />
    </TooltipProvider>
  );
}
