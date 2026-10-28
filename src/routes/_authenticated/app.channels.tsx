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
  component: ChannelsPage,
});

function ChannelsPage() {
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
        <PageHeader
          icon={Radio}
          title="Channels"
          subtitle="Connect your social platforms via OAuth, or register a handle manually."
        />

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
              title="Nenhum canal conectado"
              text="Conecte Instagram, YouTube, TikTok ou outros canais para publicar e medir resultados a partir do hub."
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
