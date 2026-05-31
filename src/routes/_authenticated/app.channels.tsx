import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Radio, Plus, Trash2, Instagram, Facebook, Youtube, Linkedin, Music2 } from "lucide-react";
import { toast } from "sonner";
import { listChannels, createChannel, deleteChannel } from "@/lib/api/channels.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { PageHeader } from "./app.brands";

export const Route = createFileRoute("/_authenticated/app/channels")({ component: ChannelsPage });

const PLATFORMS = [
  { id: "instagram", label: "Instagram", Icon: Instagram },
  { id: "facebook", label: "Facebook", Icon: Facebook },
  { id: "youtube", label: "YouTube", Icon: Youtube },
  { id: "tiktok", label: "TikTok", Icon: Music2 },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin },
] as const;

function ChannelsPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(listChannels);
  const create = useServerFn(createChannel);
  const remove = useServerFn(deleteChannel);

  const q = useQuery({ queryKey: ["channels", wsId], queryFn: () => list({ data: { workspaceId: wsId! } }), enabled: !!wsId });

  const [platform, setPlatform] = useState<typeof PLATFORMS[number]["id"]>("instagram");
  const [handle, setHandle] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { workspaceId: wsId!, platform, handle } }),
    onSuccess: () => { setHandle(""); qc.invalidateQueries({ queryKey: ["channels", wsId] }); toast.success("Channel registered"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["channels", wsId] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={Radio} title="Channels" subtitle="Connect your social platforms. OAuth flow coming in Phase 2." />

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <form onSubmit={(e) => { e.preventDefault(); if (handle.length > 0) createMut.mutate(); }} className="grid gap-3 md:grid-cols-[auto_1fr_auto]">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as any)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button disabled={createMut.isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Plus className="size-4" /> Register
          </button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((c: any) => {
          const meta = PLATFORMS.find((p) => p.id === c.platform);
          const Icon = meta?.Icon ?? Radio;
          return (
            <div key={c.id} className="rounded-2xl border border-border bg-card/60 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-secondary"><Icon className="size-5" /></div>
                  <div>
                    <div className="font-semibold capitalize">{c.platform}</div>
                    <div className="text-sm text-muted-foreground">{c.handle ?? "—"}</div>
                  </div>
                </div>
                <button onClick={() => delMut.mutate(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`rounded-full px-2 py-0.5 ${c.status === "connected" ? "bg-success/20 text-success" : "bg-secondary text-secondary-foreground"}`}>{c.status}</span>
                <span className="text-muted-foreground">{c.brand?.name ?? "no brand"}</span>
              </div>
            </div>
          );
        })}
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No channels yet.</p>}
      </div>
    </div>
  );
}
