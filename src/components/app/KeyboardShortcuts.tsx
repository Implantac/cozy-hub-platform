import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border/70 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl";

  const rows: Array<{ label: string; keys: string[] }> = [
    { label: t("shortcuts.palette", "Abrir busca rápida"), keys: [mod, "K"] },
    { label: t("shortcuts.help", "Mostrar atalhos"), keys: ["?"] },
    { label: t("shortcuts.tourNext", "Próximo passo no tour"), keys: ["→"] },
    { label: t("shortcuts.tourPrev", "Passo anterior no tour"), keys: ["←"] },
    { label: t("shortcuts.close", "Fechar overlay / tour"), keys: ["Esc"] },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 grid size-10 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Keyboard className="size-5 text-primary-foreground" />
          </div>
          <DialogTitle>{t("shortcuts.title", "Atalhos de teclado")}</DialogTitle>
          <DialogDescription>
            {t("shortcuts.desc", "Acelere sua navegação pelo VELT.")}
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border/60">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-foreground">{r.label}</span>
              <span className="flex items-center gap-1">
                {r.keys.map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
