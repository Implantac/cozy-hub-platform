import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "lucide-react";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/scheduler")({ component: SchedulerPage });

function SchedulerPage() {
  return (
    <div className="space-y-6">
      <PageHeader icon={Calendar} title="Scheduler" subtitle="Multi-channel publishing queue with retry & DLQ." />
      <div className="rounded-2xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
        Scheduler UI lands in Phase 2 with the publishing worker. The queue table, retry policy and dead-letter handling are already in the schema (<code className="text-accent">scheduler_jobs</code>).
      </div>
    </div>
  );
}
