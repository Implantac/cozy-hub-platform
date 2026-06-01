import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard, Palette, Radio, FileText, Calendar, BarChart3, Brain, Target, Settings, LogOut,
  Rocket, GitBranch, RadarIcon, Brain as BrainIcon,
} from "lucide-react";
import { signOut } from "@/lib/auth/use-auth";

const ITEMS = [
  { to: "/app", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/app/builder", labelKey: "nav.builder", icon: Rocket },
  { to: "/app/journey", labelKey: "nav.journey", icon: GitBranch },
  { to: "/app/competitors", labelKey: "nav.competitors", icon: RadarIcon },
  { to: "/app/skill-map", labelKey: "nav.skill_map", icon: BrainIcon },
  { to: "/app/brands", labelKey: "nav.brands", icon: Palette },
  { to: "/app/channels", labelKey: "nav.channels", icon: Radio },
  { to: "/app/content", labelKey: "nav.content", icon: FileText },
  { to: "/app/scheduler", labelKey: "nav.scheduler", icon: Calendar },
  { to: "/app/analytics", labelKey: "nav.analytics", icon: BarChart3 },
  { to: "/app/brain", labelKey: "nav.brain", icon: Brain },
  { to: "/app/missions", labelKey: "nav.missions", icon: Target },
  { to: "/app/settings", labelKey: "nav.settings", icon: Settings },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
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

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={t("palette.placeholder", "Buscar páginas, ações...")} />
      <CommandList>
        <CommandEmpty>{t("palette.empty", "Nada encontrado.")}</CommandEmpty>
        <CommandGroup heading={t("palette.navigate", "Navegar")}>
          {ITEMS.map((it) => (
            <CommandItem key={it.to} onSelect={() => { onOpenChange(false); navigate({ to: it.to }); }}>
              <it.icon className="mr-2 size-4" />
              {t(it.labelKey)}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading={t("palette.actions", "Ações")}>
          <CommandItem onSelect={async () => { onOpenChange(false); await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="mr-2 size-4" /> {t("common.signOut")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
