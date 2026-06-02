import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Palette, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import { Button } from "@/components/ui/button";
import {
  useWorkspaceMutation,
  useWorkspaceQuery,
} from "@/lib/query/use-workspace-query";
import {
  createBrand,
  deleteBrand,
  listBrands,
} from "@/lib/api/brands.functions";
import type { Brand } from "@/lib/api/_types";

export const Route = createFileRoute("/_authenticated/app/brands")({
  component: BrandsPage,
});

function BrandsPage() {
  const list = useServerFn(listBrands);
  const create = useServerFn(createBrand);
  const remove = useServerFn(deleteBrand);

  const q = useWorkspaceQuery<Brand[]>(
    (wsId) => ["brands", wsId],
    ({ workspaceId }) => list({ data: { workspaceId } }),
  );
  const invalidateKey = q.wsId ? ["brands", q.wsId] : ["brands"];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createMut = useWorkspaceMutation(
    () => create({ data: { workspaceId: q.wsId!, name, description } }),
    {
      invalidate: invalidateKey,
      successMessage: "Brand created",
      onSuccess: () => {
        setName("");
        setDescription("");
      },
    },
  );

  const delMut = useWorkspaceMutation(
    (id: string) => remove({ data: { id, workspaceId: q.wsId! } }),
    { invalidate: invalidateKey, successMessage: "Brand removed" },
  );

  return (
    <PageTransition>
      <div className="space-y-6">
      <PageHeader
        icon={Palette}
        title="Brands"
        subtitle="Voice, palette and identity per project."
      />

      <div className="section-card p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.length >= 2) createMut.mutate();
          }}
          className="grid gap-3 md:grid-cols-[1fr_2fr_auto]"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Brand name"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            disabled={createMut.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> Create
          </button>
        </form>
      </div>

      {q.isLoading ? (
        <ListSkeleton rows={3} />
      ) : q.data && q.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Palette}
          title="Nenhuma marca ainda"
          text="Crie sua primeira marca para definir voz, paleta e canais. É a base da operação no VELT."
          action={
            <Button
              size="sm"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>('input[placeholder="Brand name"]');
                input?.focus();
              }}
            >
              <Plus className="size-4" /> Criar primeira marca
            </Button>
          }
          helpHref="https://docs.lovable.dev"
          helpLabel="Como estruturar uma marca"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).map((b) => (
            <div
              key={b.id}
              className="section-card hover-lift p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{b.name}</h3>
                <button
                  type="button"
                  aria-label={`Delete brand ${b.name}`}
                  onClick={() => delMut.mutate(b.id)}
                  disabled={!q.wsId || delMut.isPending}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.description ?? "—"}
              </p>
            </div>
          ))}
        </div>
      )}
      </div>
    </PageTransition>
  );
}
