import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  HelpCircle, Keyboard, LogOut, Menu, RefreshCw, Search, Settings, User,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationDrawer } from "@/components/app/NotificationDrawer";
import { resetTour } from "@/components/app/ProductTour";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { signOut } from "@/lib/auth/use-auth";

interface AppHeaderProps {
  crumb: { group: string; page: string };
  userInitial: string;
  displayName: string;
  workspaceId: string | undefined;
  onOpenPalette: () => void;
  onOpenMobileNav: () => void;
  onOpenTour: () => void;
  onOpenShortcuts: () => void;
}

export function AppHeader({
  crumb, userInitial, displayName, workspaceId,
  onOpenPalette, onOpenMobileNav, onOpenTour, onOpenShortcuts,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-18 items-center justify-between gap-3 border-b border-border/40 bg-background/60 px-4 backdrop-blur-2xl backdrop-saturate-150 lg:px-8">
      <div className="flex min-w-0 items-center gap-2.5 text-sm">
        <button
          onClick={onOpenMobileNav}
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
          onClick={onOpenPalette}
          className="press hidden h-10 items-center gap-2.5 rounded-xl border border-border/60 bg-card/40 px-3.5 text-sm text-muted-foreground transition-all duration-300 hover:border-primary/40 hover:bg-card/70 hover:text-foreground hover:shadow-glow-sm sm:flex"
        >
          <Search className="size-3.5" />
          <span className="text-xs">{t("palette.placeholder", "Buscar...")}</span>
          <kbd className="ml-6 rounded border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
        </button>
        <button
          onClick={onOpenPalette}
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
              onClick={onOpenTour}
              className="press hidden size-9 items-center justify-center rounded-lg border border-border/60 bg-card/50 text-muted-foreground transition hover:border-primary/30 hover:bg-card hover:text-foreground sm:inline-flex"
              aria-label={t("tour.start", "Iniciar tour")}
            >
              <HelpCircle className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("tour.start", "Iniciar tour")}</TooltipContent>
        </Tooltip>
        <div data-tour="notifications">
          <NotificationDrawer workspaceId={workspaceId} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={t("nav.account", "Conta")}
              className="press grid size-9 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground shadow-glow-sm ring-1 ring-primary/20 transition hover:shadow-glow"
            >
              {userInitial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate({ to: "/app/settings" })}>
              <User className="mr-2 size-4" /> {t("nav.profile", "Perfil & conta")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate({ to: "/app/settings" })}>
              <Settings className="mr-2 size-4" /> {t("nav.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenShortcuts}>
              <Keyboard className="mr-2 size-4" /> {t("shortcuts.title", "Atalhos de teclado")}
              <span className="ml-auto text-[10px] text-muted-foreground">?</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => { resetTour(); onOpenTour(); }}>
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
  );
}
