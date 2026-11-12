import { modulePageHead } from "@/lib/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, User, Users, Globe, Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getWorkspace } from "@/lib/api/workspaces.functions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { QueryErrorState } from "@/features/shell/components/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileTab } from "@/features/settings/components/ProfileTab";
import { WorkspaceTab } from "@/features/settings/components/WorkspaceTab";
import { TeamTab } from "@/features/settings/components/TeamTab";
import { AppearanceTab } from "@/features/settings/components/AppearanceTab";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => modulePageHead("settings"),
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const fetchWs = useServerFn(getWorkspace);
  const q = useWorkspaceQuery(
    (wsId) => ["ws-detail", wsId],
    ({ workspaceId }) => fetchWs({ data: { id: workspaceId } }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title={t("settings.title", "Configurações")}
        subtitle={t("settings.subtitle", "Perfil, workspace e equipe.")}
      />

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList
          className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:w-fit"
          aria-label={t("settings.title")}
        >
          <TabsTrigger value="profile" className="min-h-11 min-w-0">
            <User className="mr-2 size-3.5" />
            {t("settings.tabs.profile", "Perfil")}
          </TabsTrigger>
          <TabsTrigger value="workspace" className="min-h-11 min-w-0">
            <Building2 className="mr-2 size-3.5" />
            {t("settings.tabs.workspace", "Workspace")}
          </TabsTrigger>
          <TabsTrigger value="team" className="min-h-11 min-w-0">
            <Users className="mr-2 size-3.5" />
            {t("settings.tabs.team", "Equipe")}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="min-h-11 min-w-0">
            <Globe className="mr-2 size-3.5" />
            {t("settings.tabs.appearance", "Idioma")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="workspace">
          {q.isError ? (
            <QueryErrorState onRetry={() => void q.refetch()} pending={q.isFetching} />
          ) : q.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : q.data ? (
            <WorkspaceTab workspace={q.data.workspace} />
          ) : null}
        </TabsContent>
        <TabsContent value="team">
          {q.isError ? (
            <QueryErrorState onRetry={() => void q.refetch()} pending={q.isFetching} />
          ) : q.isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : q.data ? (
            <TeamTab members={q.data.members} />
          ) : null}
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
