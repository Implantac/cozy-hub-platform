import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import {
  createMission,
  listMissions,
  updateMissionStatus,
} from "@/lib/api/missions.functions";
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import type { Mission } from "@/lib/api/_types";

export const Route = createFileRoute("/_authenticated/app/missions")({
  component: MissionsPage,
});

const COLS = ["pending", "in_progress", "done"] as const;
type MissionStatus = (typeof COLS)[number];

function MissionsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listMissions);
  const create = useServerFn(createMission);
  const update = useServerFn(updateMissionStatus);

  const q = useWorkspaceQuery<Mission[]>(
    (wsId) => ["missions", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const invalidateKey = q.wsId ? ["missions", q.wsId] : ["missions"];

  const [title, setTitle] = useState("");
  const createMut = useWorkspaceMutation(
    () => create({ data: { workspaceId: q.wsId!, title } }),
    {
      invalidate: invalidateKey,
      successMessage: "Mission added",
      onSuccess: () => setTitle(""),
    },
  );

  const byCol = COLS.map((s) => ({
    status: s,
    items: (q.data ?? []).filter((m) => m.status === s),
  }));

  const moveTo = (id: string, status: MissionStatus) => {
    if (!q.wsId) return;
    update({ data: { id, status, workspaceId: q.wsId } })
      .then(() => qc.invalidateQueries({ queryKey: invalidateKey }))
      .catch((e: Error) => {
        import("sonner").then(({ toast }) => toast.error(e.message));
      });
  };

  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        icon={Target}
        title="Missions"
        subtitle="Strategic goals tracked by the Brain."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.length >= 2) createMut.mutate();
        }}
        className="flex gap-2"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New mission..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="size-4" />Add
        </button>
      </form>

      {q.isLoading ? (
        <ListSkeleton rows={3} />
      ) : q.data && q.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Target}
          title="Nenhuma missão ativa"
          text="Defina uma missão de 7 dias para o Brain te acompanhar. Missões criam o loop de feedback que evolui as recomendações."
          action={
            <button
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[placeholder="New mission..."]');
                input?.focus();
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-4" /> Criar primeira missão
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {byCol.map((col) => (
            <div
              key={col.status}
              className="section-card p-4"
            >
              <h3 className="mb-3 text-sm font-medium capitalize text-muted-foreground">
                {col.status.replace("_", " ")} · {col.items.length}
              </h3>
              <div className="space-y-2">
                {col.items.map((m) => (
                  <div
                    key={m.id}
                    className="hover-lift rounded-lg border border-border bg-background/40 p-3 text-sm"
                  >
                    <div className="font-medium">{m.title}</div>
                    <div className="mt-2 flex gap-1 text-xs">
                      {COLS.filter((s) => s !== m.status).map((s) => (
                        <button
                          key={s}
                          onClick={() => moveTo(m.id, s)}
                          className="rounded-md bg-secondary px-2 py-1 capitalize hover:bg-primary hover:text-primary-foreground"
                        >
                          → {s.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {col.items.length === 0 && (
                  <p className="text-xs text-muted-foreground">Vazio</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </PageTransition>
  );
}
