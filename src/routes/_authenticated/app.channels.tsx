import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Link2, Plus, Radio, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
import {
  PLATFORMS,
  getPlatformIcon,
  type PlatformId,
} from "@/components/app/PlatformIcon";
import {
  createChannel,
  deleteChannel,
  listChannels,
} from "@/lib/api/channels.functions";
import {
  disconnectChannel,
  startOAuthConnect,
} from "@/lib/api/oauth.functions";
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import type { Channel } from "@/lib/api/_types";

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

  // Surface OAuth callback feedback from query string.
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
    async (providerId: string) => {
      // redirectUri is built server-side from APP_ORIGIN / request headers —
      // never send it from the client (prevents redirect-URI tampering).
      return connect({
        data: { workspaceId: q.wsId!, provider: providerId },
      });
    },
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

      {/* OAuth Connect grid */}
      <div className="section-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Connect a platform
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => connectMut.mutate(p.oauth)}
              disabled={!q.wsId || connectMut.isPending}
              className="group hover-lift flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
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
      <div className="section-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Or register a handle manually
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (handle.length > 0) createMut.mutate();
          }}
          className="grid gap-3 md:grid-cols-[auto_1fr_auto]"
        >
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformId)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
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
        {(q.data ?? []).map((c) => {
          const meta = PLATFORMS.find((p) => p.id === c.platform);
          const Icon = getPlatformIcon(c.platform);
          const isConnected = c.status === "connected";
          return (
            <div
              key={c.id}
              className="section-card p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-secondary">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <div className="font-semibold capitalize">{c.platform}</div>
                    <div className="text-sm text-muted-foreground">
                      {c.handle ?? c.external_id ?? "—"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${c.platform} channel`}
                  onClick={() => delMut.mutate(c.id)}
                  disabled={!q.wsId || delMut.isPending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  title="Delete channel"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span
                  className={`rounded-full px-2 py-0.5 ${
                    isConnected
                      ? "bg-success/20 text-success"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {c.status}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {c.brand?.name ?? "no brand"}
                  </span>
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
