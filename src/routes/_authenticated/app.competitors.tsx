import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  RadarIcon, TrendingUp, TrendingDown, Minus, Eye, Lightbulb, Plus, Trash2, X,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { BuilderService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/competitors")({
  component: CompetitorRadarPage,
});

type Competitor = {
  id: string; workspace_id: string;
  name: string; handle: string | null;
  followers: number; engagement: number;
  trend: "up" | "down" | "flat";
  threat: "high" | "medium" | "low";
  positioning: string | null; recent_move: string | null; gap: string | null;
};

function CompetitorRadarPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(BuilderService.listCompetitors);
  const upsert = useServerFn(BuilderService.upsertCompetitor);
  const del = useServerFn(BuilderService.deleteCompetitor);

  const q = useQuery({
    queryKey: ["competitors", wsId],
    queryFn: () => list({ data: { workspaceId: wsId! } }) as Promise<Competitor[]>,
    enabled: !!wsId,
  });

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "matrix">("list");

  const create = useMutation({
    mutationFn: (data: Partial<Competitor> & { name: string }) =>
      upsert({ data: { workspaceId: wsId!, ...data } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competitors", wsId] }); setOpen(false); toast.success("Concorrente adicionado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { workspaceId: wsId!, id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["competitors", wsId] }); toast.success("Removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const competitors = q.data ?? [];

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <PageHeader
          icon={RadarIcon}
          eyebrow="Radar · inteligência competitiva"
          title="Concorrentes"
          subtitle="Quem está no seu radar, o que estão fazendo, onde você pode ganhar."
          action={
            <>
              <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5">
                <button onClick={() => setView("list")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  Lista
                </button>
                <button onClick={() => setView("matrix")}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${view === "matrix" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  Matriz
                </button>
              </div>
              <button onClick={() => setOpen(true)}
                className="hover-lift inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated">
                <Plus className="size-4" /> Adicionar
              </button>
            </>
          }
        />

        {q.isLoading ? (
          <Loading />
        ) : competitors.length === 0 ? (
          <Empty onAdd={() => setOpen(true)} />
        ) : view === "list" ? (
          <motion.section variants={stagger} className="space-y-3">
            {competitors.map((c) => <CompetitorRow key={c.id} c={c} onRemove={() => remove.mutate(c.id)} />)}
          </motion.section>
        ) : (
          <ThreatMatrix items={competitors} />
        )}

        {open && <NewCompetitorDialog onClose={() => setOpen(false)} onSave={(data) => create.mutate(data)} saving={create.isPending} />}
      </motion.div>
    </PageTransition>
  );
}

function CompetitorRow({ c, onRemove }: { c: Competitor; onRemove: () => void }) {
  const TIcon = c.trend === "up" ? TrendingUp : c.trend === "down" ? TrendingDown : Minus;
  const tTone = c.trend === "up" ? "text-success" : c.trend === "down" ? "text-destructive" : "text-muted-foreground";
  const threatTone =
    c.threat === "high" ? "bg-destructive/15 text-destructive"
    : c.threat === "medium" ? "bg-warning/15 text-warning"
    : "bg-secondary text-muted-foreground";

  return (
    <motion.div variants={fadeUp}
      className="section-card hover-lift p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{c.name}</span>
            {c.handle && <span className="text-xs text-muted-foreground">{c.handle}</span>}
          </div>
          {c.positioning && <p className="mt-1 text-xs text-muted-foreground">{c.positioning}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${threatTone}`}>
            ameaça {c.threat}
          </span>
          <button onClick={onRemove} className="grid size-8 place-items-center rounded-lg border border-border bg-background/40 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Stat label="Seguidores" value={c.followers.toLocaleString("pt-BR")} />
        <Stat label="Engajamento" value={`${c.engagement}%`} />
        <Stat label="Tendência" value={
          <span className={`inline-flex items-center gap-1 ${tTone}`}>
            <TIcon className="size-3" /> {c.trend === "up" ? "Subindo" : c.trend === "down" ? "Caindo" : "Estável"}
          </span>
        } />
      </div>

      {(c.recent_move || c.gap) && (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {c.recent_move && <Block icon={Eye} label="Movimento recente" body={c.recent_move} />}
          {c.gap && <Block icon={Lightbulb} label="Seu gap" body={c.gap} accent />}
        </div>
      )}
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Block({ icon: Icon, label, body, accent }: { icon: typeof Eye; label: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-accent/30 bg-accent/5" : "border-border bg-background/40"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`size-3 ${accent ? "text-accent" : ""}`} /> {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed">{body}</p>
    </div>
  );
}

function ThreatMatrix({ items }: { items: Competitor[] }) {
  const maxF = Math.max(1, ...items.map((i) => i.followers));
  const maxE = Math.max(1, ...items.map((i) => i.engagement));
  return (
    <motion.div variants={fadeUp}
      className="section-card relative h-[420px] p-6">
      <div className="absolute left-3 top-3 text-[10px] uppercase tracking-wider text-muted-foreground">↑ Engajamento</div>
      <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground">Audiência →</div>
      <div className="absolute inset-12">
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
        <div className="absolute inset-y-0 left-0 w-px bg-border" />
        {items.map((c) => {
          const x = (c.followers / maxF) * 100;
          const y = (c.engagement / maxE) * 100;
          const size = c.threat === "high" ? 56 : c.threat === "medium" ? 40 : 28;
          const tone = c.threat === "high" ? "bg-destructive/30 ring-destructive/60"
                     : c.threat === "medium" ? "bg-warning/30 ring-warning/60"
                     : "bg-muted ring-border";
          return (
            <div key={c.id}
              className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 transition hover:scale-110 ${tone}`}
              style={{ left: `${x}%`, bottom: `${y}%`, width: size, height: size }}
              title={c.name}>
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium">{c.name}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function NewCompetitorDialog({ onClose, onSave, saving }: {
  onClose: () => void; onSave: (data: { name: string; handle?: string; followers?: number; engagement?: number; trend?: "up" | "down" | "flat"; threat?: "high" | "medium" | "low"; positioning?: string; recent_move?: string; gap?: string }) => void; saving: boolean;
}) {
  const [form, setForm] = useState({
    name: "", handle: "", followers: 0, engagement: 0,
    trend: "flat" as "up" | "down" | "flat",
    threat: "medium" as "high" | "medium" | "low",
    positioning: "", recent_move: "", gap: "",
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Novo concorrente</h3>
          <button onClick={onClose} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return; onSave(form); }}
          className="space-y-3">
          <Field label="Nome *"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Handle"><input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@..." className="input" /></Field>
            <Field label="Seguidores"><input type="number" min={0} value={form.followers} onChange={(e) => setForm({ ...form, followers: Number(e.target.value) })} className="input" /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Engajamento %"><input type="number" min={0} max={100} step={0.1} value={form.engagement} onChange={(e) => setForm({ ...form, engagement: Number(e.target.value) })} className="input" /></Field>
            <Field label="Tendência">
              <select value={form.trend} onChange={(e) => setForm({ ...form, trend: e.target.value as "up" | "down" | "flat" })} className="input">
                <option value="up">Subindo</option><option value="flat">Estável</option><option value="down">Caindo</option>
              </select>
            </Field>
            <Field label="Ameaça">
              <select value={form.threat} onChange={(e) => setForm({ ...form, threat: e.target.value as "high" | "medium" | "low" })} className="input">
                <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option>
              </select>
            </Field>
          </div>
          <Field label="Posicionamento"><textarea rows={2} value={form.positioning} onChange={(e) => setForm({ ...form, positioning: e.target.value })} className="input resize-none" /></Field>
          <Field label="Movimento recente"><textarea rows={2} value={form.recent_move} onChange={(e) => setForm({ ...form, recent_move: e.target.value })} className="input resize-none" /></Field>
          <Field label="Seu gap"><textarea rows={2} value={form.gap} onChange={(e) => setForm({ ...form, gap: e.target.value })} className="input resize-none" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60">
              {saving ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
        <style>{`.input{width:100%;border-radius:.5rem;border:1px solid hsl(var(--border));background:hsl(var(--background)/.6);padding:.5rem .75rem;font-size:.875rem;outline:none}.input:focus{border-color:hsl(var(--primary)/.4);box-shadow:0 0 0 2px hsl(var(--primary)/.2)}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Loading() {
  return <ListSkeleton rows={4} />;
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      variant="card"
      icon={RadarIcon}
      title="Radar vazio"
      text="Adicione concorrentes para acompanhar movimentos, gaps e oportunidades."
      action={
        <button onClick={onAdd} className="hover-lift inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow">
          <Plus className="size-4" /> Adicionar o primeiro
        </button>
      }
    />
  );
}
