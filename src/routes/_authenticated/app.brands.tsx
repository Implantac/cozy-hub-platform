import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Palette, Plus } from "lucide-react";
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
import { BrandComposer } from "@/features/brands/components/BrandComposer";
import { BrandGrid } from "@/features/brands/components/BrandGrid";

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

        <BrandComposer
          name={name}
          description={description}
          isPending={createMut.isPending}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSubmit={() => createMut.mutate()}
        />

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
          <BrandGrid
            brands={q.data ?? []}
            canDelete={!!q.wsId}
            isDeleting={delMut.isPending}
            onDelete={(id) => delMut.mutate(id)}
          />
        )}
      </div>
    </PageTransition>
  );
}
