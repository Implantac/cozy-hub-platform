import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Row } from "@/lib/brain/types";
import { FlaskConical } from "lucide-react";
import {
  createExperiment,
  listExperiments,
  updateExperimentStatus,
} from "@/lib/api/brain-evolution.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { SKILL_AREAS, type SkillArea } from "../constants";

export function ExperimentsPanel() {
  const list = useServerFn(listExperiments);
  const create = useServerFn(createExperiment);
  const update = useServerFn(updateExperimentStatus);
  const expQ = useWorkspaceQuery<Row<"brain_experiments">[]>(
    (ws) => ["experiments", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = expQ.wsId;

  const [form, setForm] = useState({
    title: "",
    hypothesis: "",
    area: "copy" as SkillArea,
    metric_name: "",
    duration_days: 7,
  });

  const createMut = useWorkspaceMutation(
    () =>
      create({
        data: {
          workspaceId: wsId!,
          title: form.title,
          hypothesis: form.hypothesis,
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

  type ExperimentStatus = Row<"brain_experiments">["status"];
  const setStatus = (id: string, status: ExperimentStatus) => {
    if (!wsId) return;
    update({ data: { workspaceId: wsId, id, status } }).then(() => expQ.refetch());
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (form.title && form.hypothesis) createMut.mutate();
        }}
        className="rounded-2xl border border-border bg-card/60 p-5 space-y-3"
      >
        <h3 className="text-sm font-medium">Novo experimento</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            placeholder="Título"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value as SkillArea })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {SKILL_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            placeholder="Métrica (ex: CTR, leads/semana)"
            value={form.metric_name}
            onChange={(e) => setForm({ ...form, metric_name: e.target.value })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            max={365}
            placeholder="Duração (dias)"
            value={form.duration_days}
            onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <textarea
          placeholder="Hipótese: se eu fizer X, espero Y porque Z…"
          value={form.hypothesis}
          rows={3}
          onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex justify-end">
          <button
            disabled={!wsId || createMut.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
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
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                  {x.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{x.hypothesis}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {x.status === "proposed" && (
                  <button
                    onClick={() => setStatus(x.id, "active")}
                    className="rounded-md bg-primary/20 px-2 py-1 text-primary"
                  >
                    Iniciar
                  </button>
                )}
                {x.status === "active" && (
                  <>
                    <button
                      onClick={() => setStatus(x.id, "succeeded")}
                      className="rounded-md bg-success/20 px-2 py-1 text-success"
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() => setStatus(x.id, "cancelled")}
                      className="rounded-md bg-secondary px-2 py-1"
                    >
                      Abandonar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {(expQ.data ?? []).length === 0 && (
            <EmptyState
              variant="dashed"
              icon={FlaskConical}
              title="Nenhum experimento ainda"
              text="Crie experimentos para testar hipóteses e medir impacto antes de escalar decisões."
            />
          )}
        </div>
      </div>
    </div>
  );
}
