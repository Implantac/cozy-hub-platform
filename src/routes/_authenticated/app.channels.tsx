import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
import type { PlatformId } from "@/components/app/PlatformIcon";
import { createChannel, deleteChannel, listChannels } from "@/lib/api/channels.functions";
import { disconnectChannel, startOAuthConnect } from "@/lib/api/oauth.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import type { Channel } from "@/lib/api/_types";
import { ConnectPlatformGrid } from "@/features/channels/components/ConnectPlatformGrid";
import { ManualRegisterForm } from "@/features/channels/components/ManualRegisterForm";
import { ChannelCard } from "@/features/channels/components/ChannelCard";

export const Route = createFileRoute("/_authenticated/app/channels")({
  component: ChannelsPage,
});

function ChannelsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listChannels);
  const create = useServerFn(createChannel);
  const remove = useServerFn(deleteChannel);
  const connect = useServerFn(startOAuthConnect);
  const disconnect = useServerFn(disconnectChannel);

  const q = useWorkspaceQuery<Channel[]>(
    (wsId) => ["channels", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const invalidateKey = q.wsId ? ["channels", q.wsId] : ["channels"];

  useEffect(() => {
    const url = new URL(window.location.href);
    const ok = url.searchParams.get("oauth_connected");
    const err = url.searchParams.get("oauth_error");
    if (ok) {
      toast.success(`${ok} connected`);
      url.searchParams.delete("oauth_connected");
      window.history.replaceState({}, "", url.toString());
      qc.invalidateQueries({ queryKey: invalidateKey });
    }
    if (err) {
      toast.error(`OAuth error: ${err}`);
      url.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qc, q.wsId]);

  const [platform, setPlatform] = useState<PlatformId>("instagram");
  const [handle, setHandle] = useState("");

  const createMut = useWorkspaceMutation(
    () => create({ data: { workspaceId: q.wsId!, platform, handle } }),
    { invalidate: invalidateKey, successMessage: "Channel registered", onSuccess: () => setHandle("") },
  );

  const delMut = useWorkspaceMutation(
    (id: string) => remove({ data: { id, workspaceId: q.wsId! } }),
    { invalidate: invalidateKey },
  );

  const disconnectMut = useWorkspaceMutation(
    (channelId: string) => disconnect({ data: { channelId } }),
    { invalidate: invalidateKey, successMessage: "Channel disconnected" },
  );

  const connectMut = useWorkspaceMutation(
    async (providerId: string) => connect({ data: { workspaceId: q.wsId!, provider: providerId } }),
    { onSuccess: (res) => { window.location.href = res.url; } },
  );

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
