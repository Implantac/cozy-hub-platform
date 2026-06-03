import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3 } from "lucide-react";
import { createDueDiligenceReport, listDueDiligenceReports } from "@/lib/api/brain-evolution.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";

export function AntiScamPanel() {
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
          {(repQ.data ?? []).length === 0 && <EmptyState variant="dashed" icon={BarChart3} title="Nenhuma análise ainda" text="Solicite uma análise para gerar red/green flags e recomendações acionáveis." />}
        </div>
      </div>
    </div>
  );
}
