import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { getWorkspace } from "@/lib/api/workspaces.functions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetch = useServerFn(getWorkspace);
  const q = useWorkspaceQuery(
    (wsId) => ["ws-detail", wsId],
    ({ workspaceId }) => fetch({ data: { id: workspaceId } }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Workspace settings"
        subtitle="Members, plan and configuration."
      />
      {q.data && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="text-sm font-medium text-muted-foreground">
              Workspace
            </h3>
            <p className="mt-2 text-lg font-semibold">
              {q.data.workspace.name}
            </p>
            <p className="text-xs text-muted-foreground">
              /{q.data.workspace.slug} · plan: {q.data.workspace.plan}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-5">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Members ({q.data.members.length})
            </h3>
            <ul className="space-y-1.5">
              {q.data.members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {m.profile?.display_name ?? m.user_id.slice(0, 8)}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
