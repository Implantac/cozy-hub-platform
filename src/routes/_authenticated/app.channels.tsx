import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  Radio, Plus, Trash2, Link2, Unlink,
  Instagram, Facebook, Youtube, Linkedin, Music2,
} from "lucide-react";
import { toast } from "sonner";
import { listChannels, createChannel, deleteChannel } from "@/lib/api/channels.functions";
import { startOAuthConnect, disconnectChannel } from "@/lib/api/oauth.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/channels")({ component: ChannelsPage });

type ProviderId = "instagram" | "facebook" | "youtube" | "tiktok" | "linkedin";

const PLATFORMS: { id: ProviderId; label: string; Icon: typeof Radio; oauth: string }[] = [
  { id: "instagram", label: "Instagram", Icon: Instagram, oauth: "instagram" },
  { id: "facebook", label: "Facebook", Icon: Facebook, oauth: "facebook" },
  { id: "youtube", label: "YouTube", Icon: Youtube, oauth: "google" },
  { id: "tiktok", label: "TikTok", Icon: Music2, oauth: "tiktok" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, oauth: "linkedin" },
];

function ChannelsPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(listChannels);
  const create = useServerFn(createChannel);
  const remove = useServerFn(deleteChannel);
  const connect = useServerFn(startOAuthConnect);
  const disconnect = useServerFn(disconnectChannel);

  const q = useQuery({
    queryKey: ["channels", wsId],
    queryFn: () => list({ data: { workspaceId: wsId! } }),
    enabled: !!wsId,
  });

  // Surface OAuth callback feedback from query string
  useEffect(() => {
    const url = new URL(window.location.href);
    const ok = url.searchParams.get("oauth_connected");
    const err = url.searchParams.get("oauth_error");
    if (ok) {
      toast.success(`${ok} connected`);
      url.searchParams.delete("oauth_connected");
      window.history.replaceState({}, "", url.toString());
      qc.invalidateQueries({ queryKey: ["channels", wsId] });
    }
    if (err) {
      toast.error(`OAuth error: ${err}`);
      url.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [qc, wsId]);

  const [platform, setPlatform] = useState<ProviderId>("instagram");
  const [handle, setHandle] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { workspaceId: wsId!, platform, handle } }),
    onSuccess: () => {
      setHandle("");
      qc.invalidateQueries({ queryKey: ["channels", wsId] });
      toast.success("Channel registered");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", wsId] }),
  });

  const disconnectMut = useMutation({
    mutationFn: (channelId: string) => disconnect({ data: { channelId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["channels", wsId] });
      toast.success("Channel disconnected");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connectMut = useMutation({
    mutationFn: async (providerId: string) => {
      const redirectUri = `${window.location.origin}/api/public/oauth/callback/${providerId}`;
      return connect({ data: { workspaceId: wsId!, provider: providerId, redirectUri } });
    },
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={Radio} title="Channels" subtitle="Connect your social platforms via OAuth, or register a handle manually." />

      {/* OAuth Connect grid */}
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Connect a platform</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => connectMut.mutate(p.oauth)}
              disabled={!wsId || connectMut.isPending}
              className="group flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
            >
              <div className="grid size-10 place-items-center rounded-lg bg-secondary group-hover:bg-primary/10">
                <p.Icon className="size-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="size-3" /> Connect
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual register */}
      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Or register a handle manually</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); if (handle.length > 0) createMut.mutate(); }}
          className="grid gap-3 md:grid-cols-[auto_1fr_auto]"
        >
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as ProviderId)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@handle"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={createMut.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> Register
          </button>
        </form>
      </div>

      {/* Channel list */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((c: any) => {
          const meta = PLATFORMS.find((p) => p.id === c.platform);
          const Icon = meta?.Icon ?? Radio;
          const isConnected = c.status === "connected";
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-secondary"><Icon className="size-5" /></div>
                  <div>
                    <div className="font-semibold capitalize">{c.platform}</div>
                    <div className="text-sm text-muted-foreground">{c.handle ?? c.external_id ?? "—"}</div>
                  </div>
                </div>
                <button
                  onClick={() => delMut.mutate(c.id)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete channel"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`rounded-full px-2 py-0.5 ${isConnected ? "bg-success/20 text-success" : "bg-secondary text-secondary-foreground"}`}>
                  {c.status}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{c.brand?.name ?? "no brand"}</span>
                  {isConnected ? (
                    <button
                      onClick={() => disconnectMut.mutate(c.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-secondary"
                    >
                      <Unlink className="size-3" /> Disconnect
                    </button>
                  ) : (
                    meta && (
                      <button
                        onClick={() => connectMut.mutate(meta.oauth)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:bg-primary/5"
                      >
                        <Link2 className="size-3" /> Connect
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No channels yet.</p>}
      </div>
    </div>
  );
}
