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
              {q.data.members.map((m) => {
                // Supabase's generated type can't infer the joined profile
                // relation here, so we narrow at the consumption site.
                const member = m as unknown as {
                  user_id: string;
                  role: string;
                  profile?: { display_name?: string | null } | null;
                };
                return (
                  <li
                    key={member.user_id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {member.profile?.display_name ?? member.user_id.slice(0, 8)}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">
                      {member.role}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
