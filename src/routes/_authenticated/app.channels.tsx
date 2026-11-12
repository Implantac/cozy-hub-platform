import { QueryErrorState } from "@/features/shell/components/QueryErrorState";
import { modulePageHead } from "@/lib/page-head";
import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
import { ConnectPlatformGrid } from "@/features/channels/components/ConnectPlatformGrid";
import { ManualRegisterForm } from "@/features/channels/components/ManualRegisterForm";
import { ChannelCard } from "@/features/channels/components/ChannelCard";
import { useChannelsPage } from "@/features/channels/hooks/useChannelsPage";

export const Route = createFileRoute("/_authenticated/app/channels")({
  head: () => modulePageHead("channels"),
  component: ChannelsPage,
});

function ChannelsPage() {
  const { t } = useTranslation();
  const {
    q,
    platform,
    setPlatform,
    handle,
    setHandle,
    createMut,
    delMut,
    disconnectMut,
    connectMut,
  } = useChannelsPage();

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader icon={Radio} title={t("channels.title")} subtitle={t("channels.subtitle")} />

        <ConnectPlatformGrid
          disabled={!q.wsId || connectMut.isPending}
          onConnect={(oauth) => connectMut.mutate(oauth)}
        />

        <ManualRegisterForm
          platform={platform}
          setPlatform={setPlatform}
          handle={handle}
          setHandle={setHandle}
          onSubmit={() => createMut.mutate()}
          isPending={createMut.isPending}
        />

        {q.isError ? (
          <QueryErrorState onRetry={() => void q.refetch()} pending={q.isFetching} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(q.data ?? []).map((c) => (
              <ChannelCard
                key={c.id}
                channel={c}
                workspaceId={q.wsId}
                disabled={!q.wsId || delMut.isPending}
                onDelete={() => delMut.mutate(c.id)}
                onDisconnect={() => disconnectMut.mutate(c.id)}
                onConnect={(oauth) => connectMut.mutate(oauth)}
              />
            ))}
            {q.data?.length === 0 && (
              <EmptyState
                variant="card"
                icon={Radio}
                title={t("channels.emptyTitle")}
                text={t("channels.emptyText")}
              />
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
