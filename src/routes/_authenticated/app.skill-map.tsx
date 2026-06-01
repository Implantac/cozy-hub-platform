import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain, CheckCircle2, Circle, Lock, Sparkles, TrendingUp, Target, BookOpen, ArrowUpRight,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";

export const Route = createFileRoute("/_authenticated/app/skill-map")({
  component: SkillMapPage,
});

type Level = "beginner" | "intermediate" | "advanced" | "expert";
type Status = "mastered" | "learning" | "locked" | "todo";

type Skill = {
  id: string;
  name: string;
  category: string;
  level: Level;
  status: Status;
  progress: number;
  why: string;
};

const SKILLS: Skill[] = [
  { id: "branding-basics", name: "Posicionamento de marca", category: "Marca", level: "beginner", status: "mastered", progress: 100, why: "Base para tudo: clareza de quem você atende." },
  { id: "visual-identity", name: "Identidade visual", category: "Marca", level: "beginner", status: "learning", progress: 65, why: "Reconhecimento e consistência cross-channel." },
  { id: "content-pillars", name: "Pilares de conteúdo", category: "Conteúdo", level: "beginner", status: "mastered", progress: 100, why: "Você nunca mais fica sem ideia do que postar." },
  { id: "hook-writing", name: "Escrita de hooks", category: "Conteúdo", level: "intermediate", status: "learning", progress: 40, why: "Multiplica alcance sem aumentar produção." },
  { id: "shortform-video", name: "Vídeo curto", category: "Conteúdo", level: "intermediate", status: "todo", progress: 0, why: "Maior canal orgânico em 2026." },
  { id: "funnel-design", name: "Design de funil", category: "Aquisição", level: "intermediate", status: "todo", progress: 0, why: "Transforma audiência em receita previsível." },
  { id: "paid-ads", name: "Tráfego pago", category: "Aquisição", level: "advanced", status: "locked", progress: 0, why: "Escala receita quando o orgânico já funciona." },
  { id: "email-automation", name: "Automação de email", category: "Retenção", level: "intermediate", status: "todo", progress: 0, why: "Receita recorrente sem depender de plataformas." },
  { id: "analytics-reading", name: "Leitura de métricas", category: "Decisão", level: "intermediate", status: "learning", progress: 25, why: "Para de adivinhar, começa a decidir com dado." },
  { id: "offer-design", name: "Design de oferta", category: "Vendas", level: "advanced", status: "todo", progress: 0, why: "Ticket maior sem aumentar audiência." },
  { id: "automation-ai", name: "Automação com IA", category: "Operação", level: "advanced", status: "locked", progress: 0, why: "Multiplica sua hora de trabalho." },
  { id: "team-systems", name: "Sistemas de equipe", category: "Escala", level: "expert", status: "locked", progress: 0, why: "Só importa quando você passa de 10k/mês." },
];

const CATEGORIES = ["Marca", "Conteúdo", "Aquisição", "Retenção", "Decisão", "Vendas", "Operação", "Escala"];

function SkillMapPage() {
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = filter ? SKILLS.filter((s) => s.category === filter) : SKILLS;
  const mastered = SKILLS.filter((s) => s.status === "mastered").length;
  const learning = SKILLS.filter((s) => s.status === "learning").length;
  const next = SKILLS.find((s) => s.status === "learning") ?? SKILLS.find((s) => s.status === "todo");

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Brain className="size-3 text-accent" /> Skill Map · capacidades do operador
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Suas habilidades</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O que você já domina, o que está construindo e o que vem depois.
            </p>
          </div>
        </motion.header>

        {/* Stats */}
        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-3">
          <StatCard icon={CheckCircle2} label="Dominadas" value={mastered} accent="success" />
          <StatCard icon={TrendingUp} label="Em construção" value={learning} accent="primary" />
          <StatCard icon={Target} label="Próximo foco" value={next?.name ?? "—"} accent="accent" small />
        </motion.section>

        {/* Filter */}
        <motion.div variants={fadeUp} className="flex flex-wrap gap-2">
          <Chip active={filter === null} onClick={() => setFilter(null)}>Todas</Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
          ))}
        </motion.div>

        {/* Skill grid */}
        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <SkillCard key={s.id} skill={s} />
          ))}
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}

function SkillCard({ skill }: { skill: Skill }) {
  const Icon =
    skill.status === "mastered" ? CheckCircle2
    : skill.status === "learning" ? TrendingUp
    : skill.status === "locked" ? Lock
    : Circle;

  const tone =
    skill.status === "mastered" ? "border-success/30 bg-success/5"
    : skill.status === "learning" ? "border-primary/30 bg-primary/5"
    : skill.status === "locked" ? "border-border/50 bg-card/30 opacity-60"
    : "border-border bg-card/60";

  return (
    <motion.div variants={fadeUp}
      className={`relative overflow-hidden rounded-2xl border p-4 backdrop-blur transition hover:border-primary/40 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 size-4 ${
            skill.status === "mastered" ? "text-success"
            : skill.status === "learning" ? "text-primary"
            : skill.status === "locked" ? "text-muted-foreground" : "text-accent"}`} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{skill.name}</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              {skill.category} · {skill.level}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{skill.why}</p>
      {skill.progress > 0 && skill.status !== "mastered" && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${skill.progress}%` }} />
        </div>
      )}
      {skill.status !== "locked" && skill.status !== "mastered" && (
        <button className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
          <BookOpen className="size-3" /> Estudar agora <ArrowUpRight className="size-3" />
        </button>
      )}
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, accent, small }: {
  icon: typeof CheckCircle2; label: string; value: string | number; accent: string; small?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`size-3 text-${accent}`} /> {label}
      </div>
      <div className={`mt-2 ${small ? "text-base font-medium" : "text-3xl font-bold tabular-nums"}`}>{value}</div>
    </motion.div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-card/40 text-muted-foreground hover:border-border hover:text-foreground"
      }`}>
      {children}
    </button>
  );
}
