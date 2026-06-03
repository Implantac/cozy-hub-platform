import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import {
  cancelSchedulerJob,
  listSchedulerJobs,
  runSchedulerTickManual,
} from "@/lib/api/scheduler.functions";
import type { SchedulerJob } from "@/lib/api/_types";
import { STATUSES } from "@/features/scheduler/constants";
import { SchedulerFilters } from "@/features/scheduler/components/SchedulerFilters";
import { SchedulerTable } from "@/features/scheduler/components/SchedulerTable";

export const Route = createFileRoute("/_authenticated/app/scheduler")({
  component: SchedulerPage,
});

function SchedulerPage() {
  const list = useServerFn(listSchedulerJobs);
  const cancel = useServerFn(cancelSchedulerJob);
  const tick = useServerFn(runSchedulerTickManual);

  const [filter, setFilter] = useState<(typeof STATUSES)[number]>("all");

  const q = useWorkspaceQuery<SchedulerJob[]>(
    (wsId) => ["scheduler", wsId, filter],
    async ({ workspaceId }) => {
      const rows = await list({
        data: {
          workspaceId,
          status: filter === "all" ? undefined : filter,
          limit: 100,
        },
      });
      return rows as unknown as SchedulerJob[];
    },
  );
  const invalidateKey = q.wsId ? ["scheduler", q.wsId, filter] : ["scheduler"];

  const cancelMut = useWorkspaceMutation(
    (jobId: string) => cancel({ data: { workspaceId: q.wsId!, jobId } }),
    { invalidate: invalidateKey, successMessage: "Job canceled" },
  );

  const tickMut = useWorkspaceMutation(
    () => tick({ data: { workspaceId: q.wsId!, limit: 10 } }),
    {
      invalidate: invalidateKey,
      successMessage: (r) => `Dispatcher ran · ${(r as { processed?: number }).processed ?? 0} processed`,
    },
  );

  const counts = (q.data ?? []).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Calendar}
          title="Scheduler"
          subtitle="Multi-channel publishing queue with retry & DLQ."
        />

        <SchedulerFilters
          filter={filter}
          setFilter={setFilter}
          counts={counts}
          total={q.data?.length ?? 0}
          onTick={() => tickMut.mutate()}
          tickDisabled={!q.wsId || tickMut.isPending}
          tickPending={tickMut.isPending}
        />

        {q.isLoading ? (
          <ListSkeleton rows={4} />
        ) : q.data?.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Calendar}
            title="Nenhuma publicação na fila"
            text="Quando você agendar conteúdos no módulo Content, eles aparecem aqui aguardando o tick do scheduler."
            action={
              <Link
                to="/app/content"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Ir para Content
              </Link>
            }
          />
        ) : (
          <SchedulerTable
            jobs={q.data ?? []}
            onCancel={(id) => cancelMut.mutate(id)}
            cancelPending={cancelMut.isPending}
          />
        )}
      </div>
    </PageTransition>
  );
}
