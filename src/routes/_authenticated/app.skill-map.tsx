import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Brain, CheckCircle2, Circle, TrendingUp, Target, Sparkles, X,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { PageHeader } from "@/components/app/PageHeader";
import { BrainEvolutionService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/skill-map")({
  component: SkillMapPage,
});

const AREAS = [
  { id: "copy",         label: "Copywriting",  why: "Palavras que convertem." },
  { id: "content",      label: "Conteúdo",     why: "Conexão constante com audiência." },
  { id: "product",      label: "Produto",      why: "Encaixe da oferta na dor real." },
  { id: "sales",        label: "Vendas",       why: "Conversa que vira receita." },
  { id: "branding",     label: "Marca",        why: "Reconhecimento e diferenciação." },
  { id: "analytics",    label: "Métricas",     why: "Decidir com dado, não palpite." },
  { id: "automation",   label: "Automação",    why: "Multiplica horas de trabalho." },
  { id: "prospecting",  label: "Prospecção",   why: "Conseguir clientes intencionalmente." },
  { id: "community",    label: "Comunidade",   why: "Tribo > audiência fria." },
  { id: "strategy",     label: "Estratégia",   why: "Foco e tradeoffs claros." },
] as const;
type AreaId = (typeof AREAS)[number]["id"];

function SkillMapPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(BrainEvolutionService.listSkillAssessments);
  const upsert = useServerFn(BrainEvolutionService.upsertSkillAssessment);

  const q = useQuery({
    queryKey: ["skills", wsId],
    queryFn: () => list({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  const mut = useMutation({
    mutationFn: (p: { area: AreaId; score: number }) =>
      upsert({ data: { workspaceId: wsId!, area: p.area, score: p.score, source: "self" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["skills", wsId] }); toast.success("Avaliação salva"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Reduce: latest assessment per area
  const latest = new Map<AreaId, { score: number; assessed_at: string }>();
  for (const a of (q.data ?? []) as Array<{ area: AreaId; score: number; assessed_at: string }>) {
    if (!latest.has(a.area)) latest.set(a.area, { score: a.score, assessed_at: a.assessed_at });
  }

  const scored = AREAS.map((a) => ({ ...a, score: latest.get(a.id)?.score ?? null }));
  const mastered = scored.filter((s) => (s.score ?? 0) >= 80).length;
  const learning = scored.filter((s) => s.score != null && s.score < 80 && s.score >= 30).length;
  const next = scored.find((s) => s.score != null && s.score < 80);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <motion.header variants={fadeUp}>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Brain className="size-3 text-accent" /> Skill Map · capacidades do operador
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Suas habilidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Avalie de 0 a 100 em cada área. O Brain usa isso pra recomendar o próximo passo.
          </p>
        </motion.header>

        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-3">
          <Stat label="Dominadas" value={mastered} icon={CheckCircle2} />
          <Stat label="Em construção" value={learning} icon={TrendingUp} />
          <Stat label="Próximo foco" value={next?.label ?? "Tudo dominado"} icon={Target} small />
        </motion.section>

        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scored.map((s) => (
            <SkillCard key={s.id} area={s} pending={mut.isPending}
              onScore={(score) => mut.mutate({ area: s.id, score })} />
          ))}
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}

function SkillCard({ area, pending, onScore }: {
  area: { id: AreaId; label: string; why: string; score: number | null };
  pending: boolean;
  onScore: (score: number) => void;
}) {
  const [draft, setDraft] = useState<number>(area.score ?? 0);
  const score = area.score ?? draft;
  const status = score >= 80 ? "mastered" : score >= 30 ? "learning" : "todo";
  const Icon = status === "mastered" ? CheckCircle2 : status === "learning" ? TrendingUp : Circle;
  const tone =
    status === "mastered" ? "border-success/30 bg-success/5"
    : status === "learning" ? "border-primary/30 bg-primary/5"
    : "border-border bg-card/60";

  return (
    <motion.div variants={fadeUp}
      className={`rounded-2xl border p-4 backdrop-blur transition hover:border-primary/40 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-4 ${
          status === "mastered" ? "text-success" : status === "learning" ? "text-primary" : "text-muted-foreground"
        }`} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{area.label}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{area.why}</p>
        </div>
        <span className="text-xs font-mono tabular-nums text-muted-foreground">{score}</span>
      </div>
      <input
        type="range" min={0} max={100} step={5}
        value={draft || (area.score ?? 0)}
        onChange={(e) => setDraft(Number(e.target.value))}
        onMouseUp={(e) => onScore(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onScore(Number((e.target as HTMLInputElement).value))}
        disabled={pending}
        className="mt-3 w-full accent-primary"
      />
    </motion.div>
  );
}

function Stat({ label, value, icon: Icon, small }: {
  label: string; value: string | number; icon: typeof CheckCircle2; small?: boolean;
}) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3 text-accent" /> {label}
      </div>
      <div className={`mt-2 ${small ? "text-base font-medium" : "text-3xl font-bold tabular-nums"}`}>{value}</div>
    </motion.div>
  );
}
