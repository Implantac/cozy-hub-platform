import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/analytics")({ component: AnalyticsPage });

function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Analytics" subtitle="Aggregated metrics, trends and channel comparison." />
      <div className="rounded-2xl border border-border bg-card/60 p-8 text-center text-muted-foreground">
        Analytics aggregation lands in Phase 2 (analytics_snapshots are wired and ready).
      </div>
    </div>
  );
}
