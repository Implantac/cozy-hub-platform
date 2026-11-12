import { modulePageHead } from "@/lib/page-head";
import { useTranslation } from "react-i18next";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import {
  cancelSchedulerJob,
  listSchedulerJobs,
  runSchedulerTickManual,
} from "@/lib/api/scheduler.functions";
import type { SchedulerJob } from "@/lib/api/_types";
import { STATUSES } from "@/features/scheduler/constants";
import { SchedulerFilters } from "@/features/scheduler/components/SchedulerFilters";
import { SchedulerTable } from "@/features/scheduler/components/SchedulerTable";
import { BestTimeCard } from "@/features/scheduler/components/BestTimeCard";
import { PublishCapabilityStrip } from "@/features/scheduler/components/PublishCapabilityStrip";

export const Route = createFileRoute("/_authenticated/app/scheduler")({
  head: () => modulePageHead("scheduler"),
  component: SchedulerPage,
});

function SchedulerPage() {
  const { t } = useTranslation();
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
    { invalidate: invalidateKey, successMessage: t("scheduler.canceled") },
  );

  const tickMut = useWorkspaceMutation(() => tick({ data: { workspaceId: q.wsId!, limit: 10 } }), {
    invalidate: invalidateKey,
    successMessage: (r) =>
      t("scheduler.ran", { count: (r as { processed?: number }).processed ?? 0 }),
  });

  const counts = (q.data ?? []).reduce<Record<string, number>>((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Calendar}
          title={t("scheduler.title")}
          subtitle={t("scheduler.subtitle")}
        />

        <PublishCapabilityStrip />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <SchedulerFilters
              filter={filter}
              setFilter={setFilter}
              counts={counts}
              total={q.data?.length ?? 0}
              onTick={() => tickMut.mutate()}
              tickDisabled={!q.wsId || tickMut.isPending}
              tickPending={tickMut.isPending}
            />
          </div>
          <BestTimeCard platform="instagram" />
        </div>

        {q.isLoading ? (
          <ListSkeleton rows={4} />
        ) : q.data?.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Calendar}
            title={t("scheduler.emptyTitle")}
            text={t("scheduler.emptyText")}
            action={
              <Link
                to="/app/content"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                {t("scheduler.contentLink")}
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
