import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getDigitalTwin, upsertDigitalTwin } from "@/lib/api/brain-evolution.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export function TwinPanel() {
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
    () =>
      save({
        data: {
          workspaceId: wsId!,
          work_style: form.work_style || null,
          daily_hours: Number(form.daily_hours) || 0,
          audience_type: form.audience_type || null,
          best_channel: form.best_channel || null,
          monetization_model: form.monetization_model || null,
          preferred_formats: form.preferred_formats
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          avoided_formats: form.avoided_formats
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          pain_points: form.pain_points
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          strengths: form.strengths
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
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
          Versão {twinQ.data.version} · atualizado em{" "}
          {new Date(twinQ.data.updated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
