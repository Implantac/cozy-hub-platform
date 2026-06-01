import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  MapPin, Flag, Compass, CheckCircle2, Circle, Clock, Sparkles, ArrowUpRight,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";

export const Route = createFileRoute("/_authenticated/app/journey")({
  component: JourneyPage,
});

type Phase = "discovery" | "validation" | "build" | "launch" | "growth" | "scale";
type Status = "done" | "current" | "next" | "future";

type Milestone = {
  id: string;
  phase: Phase;
  title: string;
  date?: string;
  status: Status;
  detail: string;
};

const PHASES: Record<Phase, { label: string; color: string }> = {
  discovery: { label: "Descoberta", color: "text-muted-foreground" },
  validation: { label: "Validação", color: "text-accent" },
  build: { label: "Construção", color: "text-primary" },
  launch: { label: "Lançamento", color: "text-success" },
  growth: { label: "Crescimento", color: "text-warning" },
  scale: { label: "Escala", color: "text-destructive" },
};

const MILESTONES: Milestone[] = [
  { id: "m1", phase: "discovery", title: "Definiu nicho e persona", date: "Jan 2026", status: "done", detail: "Identidade clara de para quem o negócio existe." },
  { id: "m2", phase: "discovery", title: "Mapeou concorrentes diretos", date: "Jan 2026", status: "done", detail: "5 referências analisadas em profundidade." },
  { id: "m3", phase: "validation", title: "Primeiras 10 conversas com público", date: "Fev 2026", status: "done", detail: "Validou dor real, não suposta." },
  { id: "m4", phase: "validation", title: "MVP da oferta no ar", date: "Mar 2026", status: "done", detail: "Página simples + checkout funcionando." },
  { id: "m5", phase: "build", title: "Identidade visual e tom de voz", date: "Abr 2026", status: "done", detail: "Marca consistente cross-channel." },
  { id: "m6", phase: "build", title: "Pilares de conteúdo definidos", date: "Mai 2026", status: "current", detail: "3 temas centrais que sustentam toda a presença." },
  { id: "m7", phase: "launch", title: "Primeira venda recorrente", status: "next", detail: "Sinal de product-market fit inicial." },
  { id: "m8", phase: "launch", title: "100 seguidores qualificados", status: "next", detail: "Audiência pequena mas engajada > grande e fria." },
  { id: "m9", phase: "growth", title: "R$ 5k MRR", status: "future", detail: "Receita previsível sustentando o operador." },
  { id: "m10", phase: "growth", title: "Funil automatizado", status: "future", detail: "Captação → nutrição → venda sem você no meio." },
  { id: "m11", phase: "scale", title: "Primeira contratação", status: "future", detail: "Operação não depende mais de uma pessoa só." },
  { id: "m12", phase: "scale", title: "R$ 30k MRR", status: "future", detail: "Negócio digital sustentável e replicável." },
];

function JourneyPage() {
  const done = MILESTONES.filter((m) => m.status === "done").length;
  const total = MILESTONES.length;
  const current = MILESTONES.find((m) => m.status === "current");
  const progress = Math.round((done / total) * 100);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Compass className="size-3 text-accent" /> Journey · sua trajetória digital
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Linha do tempo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              De onde você veio, onde está, e o que vem depois. Sem dashboards confusos.
            </p>
          </div>
        </motion.header>

        {/* Progress summary */}
        <motion.section variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Progresso total</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold tabular-nums">{done}</span>
                <span className="text-sm text-muted-foreground">/ {total} marcos</span>
              </div>
            </div>
            {current && (
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Você está aqui</div>
                <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <MapPin className="size-3" /> {current.title}
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        </motion.section>

        {/* Timeline */}
        <motion.section variants={stagger} className="relative">
          <div className="absolute bottom-2 left-[15px] top-2 w-px bg-gradient-to-b from-border via-border to-transparent" />
          <div className="space-y-4">
            {MILESTONES.map((m, i) => (
              <TimelineRow key={m.id} milestone={m} last={i === MILESTONES.length - 1} />
            ))}
          </div>
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}

function TimelineRow({ milestone: m }: { milestone: Milestone; last: boolean }) {
  const Icon =
    m.status === "done" ? CheckCircle2
    : m.status === "current" ? Sparkles
    : m.status === "next" ? Flag : Circle;

  const dotTone =
    m.status === "done" ? "bg-success/20 text-success ring-success/30"
    : m.status === "current" ? "bg-primary/20 text-primary ring-primary/40 animate-pulse"
    : m.status === "next" ? "bg-accent/20 text-accent ring-accent/30"
    : "bg-secondary text-muted-foreground ring-border";

  const cardTone =
    m.status === "done" ? "border-success/20 bg-card/40"
    : m.status === "current" ? "border-primary/40 bg-primary/5 shadow-glow"
    : m.status === "next" ? "border-accent/30 bg-card/60"
    : "border-border/50 bg-card/30 opacity-70";

  return (
    <motion.div variants={fadeUp} className="relative flex gap-4">
      <div className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-2 ${dotTone}`}>
        <Icon className="size-3.5" />
      </div>
      <div className={`min-w-0 flex-1 rounded-xl border p-4 backdrop-blur transition ${cardTone}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${PHASES[m.phase].color}`}>
              {PHASES[m.phase].label}
            </span>
            {m.date && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="size-3" /> {m.date}
              </span>
            )}
          </div>
          {m.status === "current" && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">agora</span>
          )}
        </div>
        <div className="mt-1 text-sm font-semibold">{m.title}</div>
        <p className="mt-1 text-xs text-muted-foreground">{m.detail}</p>
        {m.status === "next" && (
          <button className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
            Plano de ataque <ArrowUpRight className="size-3" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
