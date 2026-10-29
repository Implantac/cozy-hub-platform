import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { Row } from "@/lib/brain/types";
import { listSkillAssessments, upsertSkillAssessment } from "@/lib/api/brain-evolution.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { SKILL_AREAS, type SkillArea } from "../constants";

export function SkillsPanel() {
  const list = useServerFn(listSkillAssessments);
  const save = useServerFn(upsertSkillAssessment);
  const skillsQ = useWorkspaceQuery<Row<"skill_assessments">[]>(
    (ws) => ["skills", ws],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const wsId = skillsQ.wsId;

  const latest = new Map<string, Row<"skill_assessments">>();
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
      onSuccess: () => {
        setNotes("");
      },
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
            {SKILL_AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Nível atual: {score}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Observações</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          onClick={() => saveMut.mutate()}
          disabled={!wsId || saveMut.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
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
