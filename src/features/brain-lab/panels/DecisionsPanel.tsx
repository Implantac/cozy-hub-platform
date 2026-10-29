import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Row } from "@/lib/brain/types";
import { Scale } from "lucide-react";
import {
  createDecision,
  listDecisions,
  markDecisionExecuted,
} from "@/lib/api/brain-evolution.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";

export function DecisionsPanel() {
  const list = useServerFn(listDecisions);
  const create = useServerFn(createDecision);
  const exec = useServerFn(markDecisionExecuted);
  const decQ = useWorkspaceQuery<Row<"brain_decisions">[]>(
    (ws) => ["decisions", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = decQ.wsId;

  const [form, setForm] = useState({
    title: "",
    category: "tool",
    cost_estimate: 0,
    expected_benefit: "",
    description: "",
  });

  const createMut = useWorkspaceMutation(
    () =>
      create({
        data: {
          workspaceId: wsId!,
          title: form.title,
          category: form.category,
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
        onSubmit={(e) => {
          e.preventDefault();
          if (form.title) createMut.mutate();
        }}
        className="rounded-2xl border border-border bg-card/60 p-5 space-y-3"
      >
        <h3 className="text-sm font-medium">Vou tomar uma decisão. O Brain me ajuda a pensar.</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            placeholder="O que estou pensando em fazer?"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {["tool", "course", "hire", "ads", "pivot", "launch", "drop", "other"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            placeholder="Custo estimado (R$)"
            value={form.cost_estimate}
            onChange={(e) => setForm({ ...form, cost_estimate: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Benefício esperado (concreto)"
            value={form.expected_benefit}
            onChange={(e) => setForm({ ...form, expected_benefit: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <textarea
          placeholder="Contexto adicional (opcional)"
          value={form.description}
          rows={2}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            disabled={!wsId || createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Avaliar com o Brain
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-medium">Histórico</h3>
        <div className="space-y-2">
          {(decQ.data ?? []).map((d) => {
            const ev = (d.evaluation ?? {}) as {
              score?: number;
              verdict?: string;
              reasoning?: string[];
            };
            const verdictColor =
              ev.verdict === "approve"
                ? "text-success"
                : ev.verdict === "postpone"
                  ? "text-destructive"
                  : "text-yellow-500";
            return (
              <div key={d.id} className="rounded-lg border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{d.title}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-medium ${verdictColor}`}>{ev.verdict ?? "—"}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5">
                      Score {ev.score ?? 0}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {d.category} · R$ {Number(d.cost_estimate).toFixed(0)} · {d.status}
                </p>
                {ev.reasoning && ev.reasoning.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                    {ev.reasoning.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {d.status === "evaluated" && (
                  <button
                    onClick={() =>
                      wsId &&
                      exec({ data: { workspaceId: wsId, id: d.id } }).then(() => decQ.refetch())
                    }
                    disabled={!wsId}
                    className="mt-2 rounded-md bg-primary/20 px-2 py-1 text-xs text-primary disabled:opacity-50"
                  >
                    Marcar como executada
                  </button>
                )}
              </div>
            );
          })}
          {(decQ.data ?? []).length === 0 && (
            <EmptyState
              variant="dashed"
              icon={Scale}
              title="Nenhuma decisão registrada"
              text="Use o registro de decisões para documentar contexto, opções consideradas e resultado esperado."
            />
          )}
        </div>
      </div>
    </div>
  );
}
