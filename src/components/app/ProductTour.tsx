import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = {
  selector: string;
  title: string;
  desc: string;
  /** Optional route to navigate to before showing this step. */
  to?: string;
  placement?: "auto" | "right" | "bottom" | "left" | "top";
};

type Rect = { top: number; left: number; width: number; height: number };

const TOUR_KEY = "use-os:product-tour-completed";

export function hasSeenTour() {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(TOUR_KEY) === "1"; } catch { return false; }
}

export function resetTour() {
  try { window.localStorage.removeItem(TOUR_KEY); } catch {}
}

export function ProductTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const steps: Step[] = [
    {
      selector: '[data-tour="brand"]',
      title: t("tour.brand.title", "Bem-vindo ao USE OS"),
      desc: t("tour.brand.desc", "Seu sistema operacional para crescimento digital. Vamos fazer um tour rápido."),
      placement: "right",
    },
    {
      selector: '[data-tour="workspace"]',
      title: t("tour.workspace.title", "Seu workspace"),
      desc: t("tour.workspace.desc", "Troque entre workspaces e crie novos a qualquer momento."),
      placement: "right",
    },
    {
      selector: '[data-tour="dashboard"]',
      title: t("tour.dashboard.title", "Dashboard"),
      desc: t("tour.dashboard.desc", "Sua central com indicadores, missões e atalhos do dia."),
      placement: "right",
      to: "/app",
    },
    {
      selector: '[data-tour="brain"]',
      title: t("tour.brain.title", "Brain — IA Nativa"),
      desc: t("tour.brain.desc", "O cérebro cognitivo gera recomendações, missões e respostas com contexto da sua operação."),
      placement: "right",
    },
    {
      selector: '[data-tour="builder"]',
      title: t("tour.builder.title", "Builder"),
      desc: t("tour.builder.desc", "Construa marcas, canais e jornadas com assistência da IA."),
      placement: "right",
    },
    {
      selector: '[data-tour="content"]',
      title: t("tour.content.title", "Conteúdo"),
      desc: t("tour.content.desc", "Crie, agende e publique em múltiplos canais a partir de um único lugar."),
      placement: "right",
    },
    {
      selector: '[data-tour="search"]',
      title: t("tour.search.title", "Busca rápida (⌘K)"),
      desc: t("tour.search.desc", "Use o command palette para navegar e executar ações em segundos."),
      placement: "bottom",
    },
    {
      selector: '[data-tour="notifications"]',
      title: t("tour.notifications.title", "Notificações"),
      desc: t("tour.notifications.desc", "Acompanhe sinais, alertas e atualizações do Brain em tempo real."),
      placement: "bottom",
    },
  ];

  const current = steps[step];

  // Navigate when step has a target route.
  useEffect(() => {
    if (!open || !current?.to) return;
    navigate({ to: current.to }).catch(() => {});
  }, [open, current?.to, navigate]);

  const measure = useCallback(() => {
    if (!current) return;
    const el = document.querySelector<HTMLElement>(current.selector);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current]);

  useLayoutEffect(() => {
    if (!open) return;
    // Retry briefly to wait for route transition / animation.
    let n = 0;
    const id = window.setInterval(() => {
      measure();
      if (++n > 8) window.clearInterval(id);
    }, 80);
    return () => window.clearInterval(id);
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const h = () => measure();
    window.addEventListener("resize", h);
    window.addEventListener("scroll", h, true);
    return () => {
      window.removeEventListener("resize", h);
      window.removeEventListener("scroll", h, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, steps.length]);

  const finish = () => {
    setStep(0);
    try { window.localStorage.setItem(TOUR_KEY, "1"); } catch {}
    onClose();
  };

  const next = () => {
    if (step >= steps.length - 1) finish();
    else setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  if (!open) return null;

  const PAD = 8;
  const spotlight = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Position the popover card.
  const cardWidth = 340;
  const cardGap = 16;
  let cardStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: cardWidth,
  };
  if (spotlight) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const placement = current.placement ?? "auto";
    const spaceRight = vw - (spotlight.left + spotlight.width);
    const spaceBottom = vh - (spotlight.top + spotlight.height);
    const useRight = placement === "right" || (placement === "auto" && spaceRight > cardWidth + cardGap + 16);
    const useBottom = !useRight && (placement === "bottom" || spaceBottom > 240);
    if (useRight) {
      cardStyle = {
        position: "fixed",
        top: Math.max(16, Math.min(vh - 260, spotlight.top)),
        left: Math.min(vw - cardWidth - 16, spotlight.left + spotlight.width + cardGap),
        width: cardWidth,
      };
    } else if (useBottom) {
      cardStyle = {
        position: "fixed",
        top: Math.min(vh - 260, spotlight.top + spotlight.height + cardGap),
        left: Math.max(16, Math.min(vw - cardWidth - 16, spotlight.left)),
        width: cardWidth,
      };
    } else {
      cardStyle = {
        position: "fixed",
        top: Math.max(16, spotlight.top - 240 - cardGap),
        left: Math.max(16, Math.min(vw - cardWidth - 16, spotlight.left)),
        width: cardWidth,
      };
    }
  }

  const body = (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop with cut-out */}
      <svg className="absolute inset-0 h-full w-full pointer-events-auto" onClick={finish}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(2,6,23,0.72)" mask="url(#tour-mask)" />
      </svg>

      {/* Spotlight ring */}
      {spotlight && (
        <div
          className="absolute rounded-xl ring-2 ring-primary/70 shadow-[0_0_0_4px_rgba(99,102,241,0.18)] pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {/* Card */}
      <div
        className={cn(
          "pointer-events-auto rounded-2xl border border-border/70 bg-card/95 p-5 shadow-2xl backdrop-blur-xl",
          "animate-rise-in",
        )}
        style={cardStyle}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand shadow-glow-sm">
              <Sparkles className="size-4 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("tour.step", "Passo")} {step + 1}/{steps.length}
            </span>
          </div>
          <button
            onClick={finish}
            aria-label={t("tour.close", "Fechar")}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold tracking-tight text-foreground">{current.title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{current.desc}</p>

        <div className="mt-4 flex items-center gap-1">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/60" : "w-3 bg-border",
              )}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            {t("tour.skip", "Pular tour")}
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={prev}>
                <ArrowLeft className="size-3.5" />
                {t("tour.prev", "Voltar")}
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {step >= steps.length - 1 ? t("tour.finish", "Concluir") : t("tour.next", "Próximo")}
              {step < steps.length - 1 && <ArrowRight className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
