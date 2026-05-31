import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Target, Plus } from "lucide-react";
import { toast } from "sonner";
import { listMissions, createMission, updateMissionStatus } from "@/lib/api/missions.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/missions")({ component: MissionsPage });

const COLS = ["pending", "in_progress", "done"] as const;

function MissionsPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(listMissions);
  const create = useServerFn(createMission);
  const update = useServerFn(updateMissionStatus);
  const q = useQuery({ queryKey: ["missions", wsId], queryFn: () => list({ data: { workspaceId: wsId! } }), enabled: !!wsId });

  const [title, setTitle] = useState("");
  const createMut = useMutation({
    mutationFn: () => create({ data: { workspaceId: wsId!, title } }),
    onSuccess: () => { setTitle(""); qc.invalidateQueries({ queryKey: ["missions", wsId] }); toast.success("Mission added"); },
  });

  const byCol = COLS.map((s) => ({ status: s, items: (q.data ?? []).filter((m: any) => m.status === s) }));

  return (
    <div className="space-y-6">
      <PageHeader icon={Target} title="Missions" subtitle="Strategic goals tracked by the Brain." />

      <form onSubmit={(e) => { e.preventDefault(); if (title.length >= 2) createMut.mutate(); }} className="flex gap-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New mission..." className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"><Plus className="size-4"/>Add</button>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        {byCol.map((col) => (
          <div key={col.status} className="rounded-2xl border border-border bg-card/40 p-4">
            <h3 className="mb-3 text-sm font-medium capitalize text-muted-foreground">{col.status.replace("_", " ")} · {col.items.length}</h3>
            <div className="space-y-2">
              {col.items.map((m: any) => (
                <div key={m.id} className="rounded-lg border border-border bg-background/40 p-3 text-sm">
                  <div className="font-medium">{m.title}</div>
                  <div className="mt-2 flex gap-1 text-xs">
                    {COLS.filter((s) => s !== m.status).map((s) => (
                      <button key={s} onClick={() => update({ data: { id: m.id, status: s } }).then(() => qc.invalidateQueries({ queryKey: ["missions", wsId] }))}
                        className="rounded-md bg-secondary px-2 py-1 capitalize hover:bg-primary hover:text-primary-foreground">→ {s.replace("_", " ")}</button>
                    ))}
                  </div>
                </div>
              ))}
              {col.items.length === 0 && <p className="text-xs text-muted-foreground">Empty</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
