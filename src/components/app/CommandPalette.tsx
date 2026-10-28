import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Palette,
  Radio,
  FileText,
  Calendar,
  Link2,
  BarChart3,
  Brain,
  Target,
  Settings,
  LogOut,
  Rocket,
  GitBranch,
  RadarIcon,
  Brain as BrainIcon,
  Compass,
  TrendingUp,
  Activity,
  Lightbulb,
  Shield,
  Wand2,
  GraduationCap,
  FlaskConical,
  ShoppingBag,
  Keyboard,
  RefreshCw,
  PanelLeftClose,
} from "lucide-react";
import { signOut } from "@/lib/auth/use-auth";
import { resetTour } from "@/components/app/ProductTour";
import { toast } from "sonner";
import { NAV_GROUPS } from "@/features/shell/nav-groups";

type Item = { to: string; labelKey: string; icon: typeof LayoutDashboard };

/**
 * The palette used to keep its own copy of the navigation tree. Two lists that
 * are supposed to agree, maintained in different files, is a divergence waiting
 * to happen — and the Commerce flag would have made it visible immediately: the
 * group disappears from the sidebar and keeps appearing in search.
 */
const GROUPS: Array<{ labelKey: string; items: Item[] }> = NAV_GROUPS;

const COLLAPSE_KEY = "digitalos.sidebar_collapsed";

export function CommandPalette({
  open,
  onOpenChange,
  onShowShortcuts,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onShowShortcuts?: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  const close = () => onOpenChange(false);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("palette.placeholder", "Buscar páginas, ações...")} />
      <CommandList>
        <CommandEmpty>{t("palette.empty", "Nada encontrado.")}</CommandEmpty>

        {GROUPS.map((g, gi) => (
          <div key={g.labelKey}>
            {gi > 0 && <CommandSeparator />}
            <CommandGroup heading={t(g.labelKey)}>
              {g.items.map((it) => (
                <CommandItem
                  key={it.to}
                  value={`${t(g.labelKey)} ${t(it.labelKey)}`}
                  onSelect={() => {
                    close();
                    navigate({ to: it.to });
                  }}
                >
                  <it.icon className="mr-2 size-4" />
                  {t(it.labelKey)}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}

        <CommandSeparator />
        <CommandGroup heading={t("palette.actions", "Ações")}>
          <CommandItem
            value="settings configurações"
            onSelect={() => {
              close();
              navigate({ to: "/app/settings" });
            }}
          >
            <Settings className="mr-2 size-4" /> {t("nav.settings")}
          </CommandItem>
          {onShowShortcuts && (
            <CommandItem
              value="keyboard shortcuts atalhos teclado"
              onSelect={() => {
                close();
                onShowShortcuts();
              }}
            >
              <Keyboard className="mr-2 size-4" /> {t("shortcuts.title", "Atalhos de teclado")}
            </CommandItem>
          )}
          <CommandItem
            value="toggle sidebar recolher menu"
            onSelect={() => {
              close();
              try {
                const cur = window.localStorage.getItem(COLLAPSE_KEY) === "1";
                window.localStorage.setItem(COLLAPSE_KEY, cur ? "0" : "1");
                window.dispatchEvent(new Event("digitalos:sidebar-toggle"));
              } catch {
                /* localStorage indisponível (modo privado) — toggle só não persiste */
              }
            }}
          >
            <PanelLeftClose className="mr-2 size-4" />{" "}
            {t("palette.toggleSidebar", "Recolher/expandir menu")}
          </CommandItem>
          <CommandItem
            value="restart product tour reiniciar tour"
            onSelect={() => {
              close();
              resetTour();
              window.dispatchEvent(new Event("digitalos:tour-start"));
              toast.success(t("tour.restarted", "Tour reiniciado"));
            }}
          >
            <RefreshCw className="mr-2 size-4" /> {t("tour.restart", "Reiniciar tour do produto")}
          </CommandItem>
          <CommandItem
            value="sign out logout sair"
            onSelect={async () => {
              close();
              await signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="mr-2 size-4" /> {t("common.signOut")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
