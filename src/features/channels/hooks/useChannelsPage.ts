import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { PlatformId } from "@/components/app/PlatformIcon";
import { createChannel, deleteChannel, listChannels } from "@/lib/api/channels.functions";
import { disconnectChannel, startOAuthConnect } from "@/lib/api/oauth.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import type { Channel } from "@/lib/api/_types";

export function useChannelsPage() {
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
    {
      invalidate: invalidateKey,
      successMessage: "Channel registered",
      onSuccess: () => setHandle(""),
    },
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
    {
      onSuccess: (res) => {
        window.location.href = res.url;
      },
    },
  );

  return {
    q,
    platform,
    setPlatform,
    handle,
    setHandle,
    createMut,
    delMut,
    disconnectMut,
    connectMut,
  };
}
