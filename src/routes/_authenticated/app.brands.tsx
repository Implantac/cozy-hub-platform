import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Palette, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listBrands, createBrand, deleteBrand } from "@/lib/api/brands.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";

export const Route = createFileRoute("/_authenticated/app/brands")({ component: BrandsPage });

function BrandsPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const list = useServerFn(listBrands);
  const create = useServerFn(createBrand);
  const remove = useServerFn(deleteBrand);

  const q = useQuery({ queryKey: ["brands", wsId], queryFn: () => list({ data: { workspaceId: wsId! } }), enabled: !!wsId });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMut = useMutation({
    mutationFn: () => create({ data: { workspaceId: wsId!, name, description } }),
    onSuccess: () => { setName(""); setDescription(""); qc.invalidateQueries({ queryKey: ["brands", wsId] }); toast.success("Brand created"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["brands", wsId] }); toast.success("Brand removed"); },
  });

  return (
    <div className="space-y-6">
      <PageHeader icon={Palette} title="Brands" subtitle="Voice, palette and identity per project." />

      <div className="rounded-2xl border border-border bg-card/60 p-5">
        <form onSubmit={(e) => { e.preventDefault(); if (name.length >= 2) createMut.mutate(); }} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <button disabled={createMut.isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            <Plus className="size-4" /> Create
          </button>
        </form>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(q.data ?? []).map((b: any) => (
          <div key={b.id} className="rounded-2xl border border-border bg-card/60 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{b.name}</h3>
              <button onClick={() => delMut.mutate(b.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{b.description ?? "—"}</p>
          </div>
        ))}
        {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No brands yet.</p>}
      </div>
    </div>
  );
}

export function PageHeader({ icon: Icon, title, subtitle }: any) {
  return (
    <header className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand shadow-glow"><Icon className="size-5 text-primary-foreground" /></div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </header>
  );
}
