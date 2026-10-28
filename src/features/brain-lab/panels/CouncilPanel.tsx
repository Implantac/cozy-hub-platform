import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, CheckCircle2, Sparkles, Users2 } from "lucide-react";
import { askCouncil, listCouncilOpinions } from "@/lib/api/brain-evolution.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { ADVISOR_META, ADVISORS, type Advisor, type CouncilOpinion } from "../constants";

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const tone = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function OpinionCard({ o }: { o: CouncilOpinion }) {
  const meta = ADVISOR_META[o.advisor] ?? ADVISOR_META.strategy;
  const Icon = meta.icon;
  const recs = Array.isArray(o.recommendations) ? o.recommendations : [];
  const isError = o.model_used === "error";
  return (
    <article className="rounded-2xl border border-border bg-card/60 p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-xl border ${meta.tone}`}
          >
            <Icon className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{meta.label}</p>
            <p className="text-[11px] text-muted-foreground">{meta.lens}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceBar value={o.confidence ?? 0} />
          {o.model_used && o.model_used !== "error" && (
            <span className="text-[10px] text-muted-foreground">
              {o.model_used.split("/").pop()}
            </span>
          )}
        </div>
      </header>

      {o.summary && (
        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3" /> Diagnóstico
          </p>
          <p className="text-sm font-medium leading-snug">{o.summary}</p>
        </div>
      )}

      {o.analysis && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {isError ? "Erro" : "Justificativa"}
          </p>
          <p
            className={`whitespace-pre-line text-sm leading-relaxed ${isError ? "text-destructive" : "text-muted-foreground"}`}
          >
            {o.analysis}
          </p>
        </div>
      )}

      {recs.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Recomendações
          </p>
          <ul className="space-y-1.5">
            {recs.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function CouncilSession({ topic, opinions }: { topic: string; opinions: CouncilOpinion[] }) {
  const valid = opinions.filter(
    (o) =>
      o.model_used !== "error" && Array.isArray(o.recommendations) && o.recommendations!.length > 0,
  );
  const best = valid.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
  const nextAction = best?.recommendations?.[0];
  const avgConf = opinions.length
    ? opinions.reduce((s, o) => s + (o.confidence ?? 0), 0) / opinions.length
    : 0;
  const created = opinions[0]?.created_at ? new Date(opinions[0].created_at) : null;

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card/30 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Consulta ao conselho
          </p>
          <h4 className="text-base font-semibold leading-snug">{topic}</h4>
          {created && (
            <p className="text-[11px] text-muted-foreground">
              {created.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
              {opinions.length} {opinions.length === 1 ? "parecer" : "pareceres"} · confiança média{" "}
              {Math.round(avgConf * 100)}%
            </p>
          )}
        </div>
      </header>

      {nextAction && best && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <ArrowRight className="size-3" /> Próxima ação sugerida
          </p>
          <p className="text-sm font-medium leading-snug">{nextAction}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Recomendada por{" "}
            <span className="font-medium">{ADVISOR_META[best.advisor]?.label ?? best.advisor}</span>{" "}
            · confiança {Math.round((best.confidence ?? 0) * 100)}%
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {opinions.map((o) => (
          <OpinionCard key={o.id} o={o} />
        ))}
      </div>
    </section>
  );
}

export function CouncilPanel() {
  const ask = useServerFn(askCouncil);
  const list = useServerFn(listCouncilOpinions);
  const opQ = useWorkspaceQuery<CouncilOpinion[]>(
    (ws) => ["council", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }) as unknown as Promise<CouncilOpinion[]>,
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
    setSelected((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]));
  };

  const opinions = opQ.data ?? [];
  const sessions = (() => {
    const map = new Map<string, CouncilOpinion[]>();
    for (const o of opinions) {
      const bucket = `${o.topic}::${(o.created_at ?? "").slice(0, 16)}`;
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket)!.push(o);
    }
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      topic: list[0].topic,
      opinions: list,
    }));
  })();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Users2 className="size-4 text-primary" />
          <h3 className="text-sm font-medium">Consultar o conselho</h3>
        </div>
        <textarea
          placeholder="Sobre o que você quer ouvir o conselho? Ex: 'devo lançar um produto pago agora ou esperar mais audiência?'"
          value={topic}
          rows={3}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Conselheiros
          </p>
          <div className="flex flex-wrap gap-2">
            {ADVISORS.map((a) => {
              const meta = ADVISOR_META[a];
              const Icon = meta.icon;
              const active = selected.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggle(a)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? `${meta.tone} border-current`
                      : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            {selected.length}{" "}
            {selected.length === 1 ? "conselheiro selecionado" : "conselheiros selecionados"}
          </p>
          <button
            onClick={() => askMut.mutate()}
            disabled={!wsId || askMut.isPending || topic.length < 5 || selected.length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {askMut.isPending ? "Consultando…" : "Pedir parecer"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {sessions.map((s) => (
          <CouncilSession key={s.key} topic={s.topic} opinions={s.opinions} />
        ))}
        {sessions.length === 0 && (
          <EmptyState
            variant="dashed"
            icon={Users2}
            title="Sem pareceres do conselho"
            text="Faça uma pergunta acima e os mentores responderão com perspectivas complementares."
          />
        )}
      </div>
    </div>
  );
}
