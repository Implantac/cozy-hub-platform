import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
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
import type { MissionStatus } from "@/features/missions/constants";
import { MissionComposer } from "@/features/missions/components/MissionComposer";
import { MissionBoard } from "@/features/missions/components/MissionBoard";

export const Route = createFileRoute("/_authenticated/app/missions")({
  component: MissionsPage,
});

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

  const moveTo = (id: string, status: MissionStatus) => {
    if (!q.wsId) return;
    update({ data: { id, status, workspaceId: q.wsId } })
      .then(() => qc.invalidateQueries({ queryKey: invalidateKey }))
      .catch((e: Error) => toast.error(e.message));
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Target}
          title="Missions"
          subtitle="Strategic goals tracked by the Brain."
        />

        <MissionComposer
          title={title}
          onTitleChange={setTitle}
          onSubmit={() => createMut.mutate()}
        />

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
          <MissionBoard missions={q.data ?? []} onMove={moveTo} />
        )}
      </div>
    </PageTransition>
  );
}
