import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  BrainCircuit, User, BarChart3, FlaskConical, Scale, ShieldAlert, Users2, History,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PageTransition } from "@/components/app/Motion";
import { EmptyState } from "@/components/app/EmptyState";
import {
  getDigitalTwin, upsertDigitalTwin,
  listSkillAssessments, upsertSkillAssessment,
  listExperiments, createExperiment, updateExperimentStatus,
  listDecisions, createDecision, markDecisionExecuted,
  listDueDiligenceReports, createDueDiligenceReport,
  askCouncil, listCouncilOpinions,
  getLongTermTimeline,
} from "@/lib/api/brain-evolution.functions";
import { useWorkspaceQuery, useWorkspaceMutation } from "@/lib/query/use-workspace-query";

export const Route = createFileRoute("/_authenticated/app/brain-lab")({
  component: BrainLabPage,
});

const SKILL_AREAS = [
  "copy", "content", "product", "sales", "branding",
  "analytics", "automation", "prospecting", "community", "strategy",
] as const;
type SkillArea = (typeof SKILL_AREAS)[number];

const ADVISORS = ["marketing", "financial", "strategy", "content", "business"] as const;
type Advisor = (typeof ADVISORS)[number];

type Tab = "twin" | "skills" | "experiments" | "decisions" | "anti_scam" | "council" | "timeline";

function BrainLabPage() {
  const [tab, setTab] = useState<Tab>("twin");

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={BrainCircuit}
          title="Brain Lab"
          subtitle="O cérebro por trás dos módulos: Digital Twin, habilidades, experimentos, decisões, anti-golpe, conselho IA."
        />

        <nav className="flex flex-wrap gap-2 border-b border-border pb-2">
          {([
            ["twin", "Digital Twin", User],
            ["skills", "Mapa de Skills", BarChart3],
            ["experiments", "Experimentos", FlaskConical],
            ["decisions", "Decisões", Scale],
            ["anti_scam", "Anti-Golpe", ShieldAlert],
            ["council", "Conselho IA", Users2],
            ["timeline", "Mentor LP", History],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition ${
                tab === key
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        {tab === "twin" && <TwinPanel />}
        {tab === "skills" && <SkillsPanel />}
        {tab === "experiments" && <ExperimentsPanel />}
        {tab === "decisions" && <DecisionsPanel />}
        {tab === "anti_scam" && <AntiScamPanel />}
        {tab === "council" && <CouncilPanel />}
        {tab === "timeline" && <TimelinePanel />}
      </div>
    </PageTransition>
  );
}

/* ============================================================
 * Digital Twin
 * ============================================================ */
function TwinPanel() {
  const get = useServerFn(getDigitalTwin);
  const save = useServerFn(upsertDigitalTwin);

  const twinQ = useWorkspaceQuery<any>(
    (ws) => ["twin", ws],
    ({ workspaceId }) => get({ data: { workspaceId } }),
  );

  const [form, setForm] = useState({
    work_style: "",
    daily_hours: 2,
    audience_type: "",
    best_channel: "",
    monetization_model: "",
    preferred_formats: "",
    avoided_formats: "",
    pain_points: "",
    strengths: "",
  });
  const wsId = twinQ.wsId;

  // hydrate form once
  if (twinQ.data && form.work_style === "" && twinQ.data.work_style) {
    setForm({
      work_style: twinQ.data.work_style ?? "",
      daily_hours: Number(twinQ.data.daily_hours ?? 2),
      audience_type: twinQ.data.audience_type ?? "",
      best_channel: twinQ.data.best_channel ?? "",
      monetization_model: twinQ.data.monetization_model ?? "",
      preferred_formats: (twinQ.data.preferred_formats ?? []).join(", "),
      avoided_formats: (twinQ.data.avoided_formats ?? []).join(", "),
      pain_points: (twinQ.data.pain_points ?? []).join(", "),
      strengths: (twinQ.data.strengths ?? []).join(", "),
    });
  }

  const saveMut = useWorkspaceMutation(
    () => save({
      data: {
        workspaceId: wsId!,
        work_style: form.work_style || null,
        daily_hours: Number(form.daily_hours) || 0,
        audience_type: form.audience_type || null,
        best_channel: form.best_channel || null,
        monetization_model: form.monetization_model || null,
        preferred_formats: form.preferred_formats.split(",").map((s) => s.trim()).filter(Boolean),
        avoided_formats: form.avoided_formats.split(",").map((s) => s.trim()).filter(Boolean),
        pain_points: form.pain_points.split(",").map((s) => s.trim()).filter(Boolean),
        strengths: form.strengths.split(",").map((s) => s.trim()).filter(Boolean),
      },
    }),
    { invalidate: wsId ? ["twin", wsId] : ["twin"], successMessage: "Digital Twin atualizado" },
  );

  const F = (label: string, key: keyof typeof form, placeholder?: string) => (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={String(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </label>
  );

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <div>
        <h3 className="text-sm font-medium">Quem você é, digitalmente</h3>
        <p className="text-xs text-muted-foreground">
          Quanto mais o Brain te conhece, mais relevante fica cada recomendação.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {F("Estilo de trabalho", "work_style", "Ex: criativo em rajadas, executor diário…")}
        {F("Horas/dia disponíveis", "daily_hours", "2")}
        {F("Público-alvo", "audience_type", "Ex: PMEs do varejo, criadores iniciantes…")}
        {F("Canal mais forte", "best_channel", "instagram, youtube, linkedin…")}
        {F("Modelo de monetização", "monetization_model", "afiliado, serviço, infoproduto, SaaS…")}
        {F("Formatos preferidos (vírgula)", "preferred_formats", "carrossel, reels, artigo")}
        {F("Formatos evitados (vírgula)", "avoided_formats", "vídeo longo, podcast")}
        {F("Dores recorrentes (vírgula)", "pain_points", "consistência, vendas, posicionamento")}
        {F("Pontos fortes (vírgula)", "strengths", "comunicação, técnica, rede")}
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending || !wsId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saveMut.isPending ? "Salvando…" : "Salvar Digital Twin"}
        </button>
      </div>
      {twinQ.data && (
        <p className="text-xs text-muted-foreground">
          Versão {twinQ.data.version} · atualizado em {new Date(twinQ.data.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

/* ============================================================
 * Skills
 * ============================================================ */
function SkillsPanel() {
  const list = useServerFn(listSkillAssessments);
  const save = useServerFn(upsertSkillAssessment);
  const skillsQ = useWorkspaceQuery<any[]>(
    (ws) => ["skills", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = skillsQ.wsId;

  // last score per area
  const latest = new Map<string, any>();
  for (const row of skillsQ.data ?? []) {
    if (!latest.has(row.area)) latest.set(row.area, row);
  }

  const [area, setArea] = useState<SkillArea>("copy");
  const [score, setScore] = useState(50);
  const [notes, setNotes] = useState("");

  const saveMut = useWorkspaceMutation(
    () => save({ data: { workspaceId: wsId!, area, score, notes: notes || undefined } }),
    {
      invalidate: wsId ? ["skills", wsId] : ["skills"],
      successMessage: "Avaliação registrada",
      onSuccess: () => { setNotes(""); },
    },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
        <h3 className="text-sm font-medium">Auto-avaliação</h3>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Área</span>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value as SkillArea)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SKILL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Nível atual: {score}</span>
          <input type="range" min={0} max={100} value={score}
            onChange={(e) => setScore(Number(e.target.value))} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Observações</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </label>
        <button onClick={() => saveMut.mutate()} disabled={!wsId || saveMut.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {saveMut.isPending ? "Salvando…" : "Registrar"}
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-medium">Mapa atual</h3>
        <div className="space-y-2">
          {SKILL_AREAS.map((a) => {
            const r = latest.get(a);
            const s = r?.score ?? 0;
            return (
              <div key={a} className="flex items-center gap-3">
                <span className="w-28 text-xs capitalize text-muted-foreground">{a}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${s}%` }} />
                </div>
                <span className="w-10 text-right text-xs">{s}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Experiments
 * ============================================================ */
function ExperimentsPanel() {
  const list = useServerFn(listExperiments);
  const create = useServerFn(createExperiment);
  const update = useServerFn(updateExperimentStatus);
  const expQ = useWorkspaceQuery<any[]>(
    (ws) => ["experiments", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = expQ.wsId;

  const [form, setForm] = useState({
    title: "", hypothesis: "", area: "copy" as SkillArea,
    metric_name: "", duration_days: 7,
  });

  const createMut = useWorkspaceMutation(
    () => create({
      data: {
        workspaceId: wsId!,
        title: form.title, hypothesis: form.hypothesis,
        area: form.area,
        metric_name: form.metric_name || undefined,
        duration_days: Number(form.duration_days) || 7,
      },
    }),
    {
      invalidate: wsId ? ["experiments", wsId] : ["experiments"],
      successMessage: "Experimento criado",
      onSuccess: () => setForm({ ...form, title: "", hypothesis: "", metric_name: "" }),
    },
  );

  const setStatus = (id: string, status: "running" | "completed" | "abandoned") => {
    update({ data: { id, status } }).then(() => expQ.refetch());
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (form.title && form.hypothesis) createMut.mutate(); }}
        className="rounded-2xl border border-border bg-card/60 p-5 space-y-3"
      >
        <h3 className="text-sm font-medium">Novo experimento</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="Título" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <select value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value as SkillArea })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {SKILL_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input placeholder="Métrica (ex: CTR, leads/semana)" value={form.metric_name}
            onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="number" min={1} max={365} placeholder="Duração (dias)"
            value={form.duration_days}
            onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <textarea placeholder="Hipótese: se eu fizer X, espero Y porque Z…"
          value={form.hypothesis} rows={3}
          onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex justify-end">
          <button disabled={!wsId || createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            Criar experimento
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-medium">Em andamento</h3>
        <div className="space-y-2">
          {(expQ.data ?? []).map((x) => (
            <div key={x.id} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{x.title}</div>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{x.status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{x.hypothesis}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {x.status === "proposed" && (
                  <button onClick={() => setStatus(x.id, "running")}
                    className="rounded-md bg-primary/20 px-2 py-1 text-primary">Iniciar</button>
                )}
                {x.status === "running" && (
                  <>
                    <button onClick={() => setStatus(x.id, "completed")}
                      className="rounded-md bg-success/20 px-2 py-1 text-success">Concluir</button>
                    <button onClick={() => setStatus(x.id, "abandoned")}
                      className="rounded-md bg-secondary px-2 py-1">Abandonar</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {(expQ.data ?? []).length === 0 && <EmptyState text="Nenhum experimento ainda." />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Decisions
 * ============================================================ */
function DecisionsPanel() {
  const list = useServerFn(listDecisions);
  const create = useServerFn(createDecision);
  const exec = useServerFn(markDecisionExecuted);
  const decQ = useWorkspaceQuery<any[]>(
    (ws) => ["decisions", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = decQ.wsId;

  const [form, setForm] = useState({
    title: "", category: "tool", cost_estimate: 0, expected_benefit: "", description: "",
  });

  const createMut = useWorkspaceMutation(
    () => create({
      data: {
        workspaceId: wsId!, title: form.title, category: form.category,
        cost_estimate: Number(form.cost_estimate) || 0,
        expected_benefit: form.expected_benefit || undefined,
        description: form.description || undefined,
      },
    }),
    {
      invalidate: wsId ? ["decisions", wsId] : ["decisions"],
      successMessage: "Decisão avaliada",
      onSuccess: () => setForm({ ...form, title: "", expected_benefit: "", description: "" }),
    },
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (form.title) createMut.mutate(); }}
        className="rounded-2xl border border-border bg-card/60 p-5 space-y-3"
      >
        <h3 className="text-sm font-medium">Vou tomar uma decisão. O Brain me ajuda a pensar.</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="O que estou pensando em fazer?" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <select value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {["tool", "course", "hire", "ads", "pivot", "launch", "drop", "other"].map((c) =>
              <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" min={0} placeholder="Custo estimado (R$)"
            value={form.cost_estimate}
            onChange={(e) => setForm({ ...form, cost_estimate: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input placeholder="Benefício esperado (concreto)"
            value={form.expected_benefit}
            onChange={(e) => setForm({ ...form, expected_benefit: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <textarea placeholder="Contexto adicional (opcional)" value={form.description} rows={2}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex justify-end">
          <button disabled={!wsId || createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            Avaliar com o Brain
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-medium">Histórico</h3>
        <div className="space-y-2">
          {(decQ.data ?? []).map((d) => {
            const ev = (d.evaluation ?? {}) as { score?: number; verdict?: string; reasoning?: string[] };
            const verdictColor = ev.verdict === "approve" ? "text-success" :
              ev.verdict === "postpone" ? "text-destructive" : "text-yellow-500";
            return (
              <div key={d.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${verdictColor}`}>{ev.verdict ?? "—"}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">Score {ev.score ?? 0}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.category} · R$ {Number(d.cost_estimate).toFixed(0)} · {d.status}
                </p>
                {ev.reasoning && ev.reasoning.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                    {ev.reasoning.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                {d.status === "evaluated" && (
                  <button
                    onClick={() => exec({ data: { id: d.id } }).then(() => decQ.refetch())}
                    className="mt-2 rounded-md bg-primary/20 px-2 py-1 text-xs text-primary">
                    Marcar como executada
                  </button>
                )}
              </div>
            );
          })}
          {(decQ.data ?? []).length === 0 && <EmptyState text="Nenhuma decisão registrada." />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Anti-Scam
 * ============================================================ */
function AntiScamPanel() {
  const list = useServerFn(listDueDiligenceReports);
  const create = useServerFn(createDueDiligenceReport);
  const repQ = useWorkspaceQuery<any[]>(
    (ws) => ["dd", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = repQ.wsId;

  const [form, setForm] = useState({
    target_name: "", target_type: "course", source_url: "", raw_input: "",
  });

  const createMut = useWorkspaceMutation(
    () => create({
      data: {
        workspaceId: wsId!, target_name: form.target_name, target_type: form.target_type,
        source_url: form.source_url || undefined,
        raw_input: form.raw_input,
      },
    }),
    {
      invalidate: wsId ? ["dd", wsId] : ["dd"],
      successMessage: "Análise gerada",
      onSuccess: () => setForm({ ...form, target_name: "", source_url: "", raw_input: "" }),
    },
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (form.target_name && form.raw_input.length >= 10) createMut.mutate();
        }}
        className="rounded-2xl border border-border bg-card/60 p-5 space-y-3"
      >
        <h3 className="text-sm font-medium">Cole a oferta e o Brain analisa o risco</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="Nome (curso, mentor, oportunidade)"
            value={form.target_name}
            onChange={(e) => setForm({ ...form, target_name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <select value={form.target_type}
            onChange={(e) => setForm({ ...form, target_type: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {["course", "mentor", "affiliate", "tool", "investment", "other"].map((c) =>
              <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input placeholder="URL (opcional)" value={form.source_url}
          onChange={(e) => setForm({ ...form, source_url: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <textarea placeholder="Cole o texto da oferta, página de vendas ou proposta…"
          value={form.raw_input} rows={5}
          onChange={(e) => setForm({ ...form, raw_input: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex justify-end">
          <button disabled={!wsId || createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            Analisar risco
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-medium">Análises</h3>
        <div className="space-y-2">
          {(repQ.data ?? []).map((r) => {
            const c = (r.checks ?? {}) as any;
            const color = r.verdict === "high_risk" ? "text-destructive" :
              r.verdict === "low_risk" ? "text-success" : "text-yellow-500";
            return (
              <div key={r.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{r.target_name}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${color}`}>{r.verdict}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">Risco {r.risk_score}/100</span>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
                {Array.isArray(c.red_flags) && c.red_flags.length > 0 && (
                  <p className="mt-1 text-xs text-destructive">🚩 {c.red_flags.join(" · ")}</p>
                )}
                {Array.isArray(c.green_flags) && c.green_flags.length > 0 && (
                  <p className="mt-1 text-xs text-success">✅ {c.green_flags.join(" · ")}</p>
                )}
              </div>
            );
          })}
          {(repQ.data ?? []).length === 0 && <EmptyState text="Nenhuma análise ainda." />}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
 * Council
 * ============================================================ */
function CouncilPanel() {
  const ask = useServerFn(askCouncil);
  const list = useServerFn(listCouncilOpinions);
  const opQ = useWorkspaceQuery<any[]>(
    (ws) => ["council", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = opQ.wsId;

  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<Advisor[]>([...ADVISORS]);

  const askMut = useWorkspaceMutation(
    () => ask({ data: { workspaceId: wsId!, topic, advisors: selected } }),
    {
      invalidate: wsId ? ["council", wsId] : ["council"],
      successMessage: "Conselho consultado",
      onSuccess: () => setTopic(""),
    },
  );

  const toggle = (a: Advisor) => {
    setSelected((s) => s.includes(a) ? s.filter((x) => x !== a) : [...s, a]);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
        <h3 className="text-sm font-medium">Consultar o conselho</h3>
        <textarea
          placeholder="Sobre o que você quer ouvir o conselho? Ex: 'devo lançar um produto pago agora ou esperar mais audiência?'"
          value={topic} rows={3}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <div className="flex flex-wrap gap-2">
          {ADVISORS.map((a) => (
            <button key={a} type="button" onClick={() => toggle(a)}
              className={`rounded-full px-3 py-1 text-xs capitalize transition ${
                selected.includes(a) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}>
              {a}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={() => askMut.mutate()}
            disabled={!wsId || askMut.isPending || topic.length < 5 || selected.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {askMut.isPending ? "Consultando…" : "Pedir parecer"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(opQ.data ?? []).map((o) => (
          <div key={o.id} className="rounded-lg border border-border bg-card/60 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs capitalize text-primary">{o.advisor}</span>
              <span className="text-xs text-muted-foreground">conf. {Math.round((o.confidence ?? 0) * 100)}%</span>
            </div>
            <p className="text-xs font-medium">{o.topic}</p>
            <p className="text-sm text-muted-foreground">{o.analysis}</p>
            {Array.isArray(o.recommendations) && (
              <ul className="list-disc pl-5 text-sm space-y-0.5">
                {o.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            )}
          </div>
        ))}
        {(opQ.data ?? []).length === 0 && (
          <div className="md:col-span-2">
            <EmptyState text="Sem pareceres ainda. Faça uma pergunta acima." />
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Timeline / Long-term Mentor ---------------- */
function TimelinePanel() {
  const fetchTimeline = useServerFn(getLongTermTimeline);
  const tlQ = useWorkspaceQuery<Awaited<ReturnType<typeof fetchTimeline>>>(
    (ws) => ["brain-timeline", ws],
    ({ workspaceId }) => fetchTimeline({ data: { workspaceId } }),
  );

  if (!tlQ.wsId) {
    return <EmptyState icon={History} title="Sem workspace" description="Selecione um workspace para ver a linha do tempo." />;
  }
  if (tlQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Construindo narrativa…</div>;
  }
  const data = tlQ.data;
  if (!data || data.periods.length === 0) {
    return <EmptyState icon={History} title="Histórico ainda raso" description="Conforme você usar o sistema, o Mentor de Longo Prazo vai construir sua trajetória trimestre a trimestre." />;
  }

  const trajectory = data.mentor.trajectory_delta;
  const trajectoryColor = trajectory == null ? "text-muted-foreground" : trajectory > 10 ? "text-emerald-500" : trajectory < -10 ? "text-destructive" : "text-amber-500";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-3 flex items-center gap-2">
          <History className="size-5 text-primary" />
          <h3 className="text-lg font-semibold">Visão do Mentor</h3>
        </header>
        <p className="text-sm leading-relaxed text-foreground">{data.mentor.verdict}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Stat label="Períodos" value={String(data.mentor.periods_tracked)} />
          <Stat label="Eventos" value={String(data.mentor.total_events)} />
          <Stat label="Decisões" value={String(data.mentor.total_decisions)} />
          <Stat label="Experimentos OK" value={String(data.mentor.completed_experiments)} />
        </div>
        {trajectory != null && (
          <p className={`mt-3 text-sm font-medium ${trajectoryColor}`}>
            Trajetória: {trajectory > 0 ? "+" : ""}{trajectory.toFixed(1)} pts de score acumulado.
          </p>
        )}
        {data.mentor.patterns.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {data.mentor.patterns.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Linha do tempo</h4>
        <ol className="relative space-y-4 border-l border-border pl-5">
          {data.periods.map((p) => (
            <li key={p.key} className="relative">
              <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-primary ring-4 ring-background" />
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-semibold">{p.key}</h5>
                  <div className="flex flex-wrap gap-1">
                    {p.highlights.map((h, i) => (
                      <span key={i} className="rounded-full bg-secondary px-2 py-0.5 text-xs">{h}</span>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground">{p.narrative}</p>
                {p.score_avg != null && (
                  <p className="mt-1 text-xs text-muted-foreground">Score médio: {p.score_avg.toFixed(1)}</p>
                )}
                {(p.wins.length > 0 || p.setbacks.length > 0) && (
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {p.wins.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-emerald-500">Vitórias</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {p.wins.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                    {p.setbacks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase text-destructive">Tropeços</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {p.setbacks.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/50 p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
