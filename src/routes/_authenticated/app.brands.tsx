import { QueryErrorState } from "@/features/shell/components/QueryErrorState";
import { modulePageHead } from "@/lib/page-head";
import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Palette, Plus } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { ListSkeleton } from "@/components/app/Skeletons";
import { PageTransition } from "@/components/app/Motion";
import { Button } from "@/components/ui/button";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { createBrand, deleteBrand, listBrands } from "@/lib/api/brands.functions";
import type { Brand } from "@/lib/api/_types";
import { BrandComposer } from "@/features/brands/components/BrandComposer";
import { BrandGrid } from "@/features/brands/components/BrandGrid";

export const Route = createFileRoute("/_authenticated/app/brands")({
  head: () => modulePageHead("brands"),
  component: BrandsPage,
});

function BrandsPage() {
  const { t } = useTranslation();
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
    () => create({ data: { workspaceId: q.wsId!, name: name.trim(), description } }),
    {
      invalidate: invalidateKey,
      successMessage: t("brands.created"),
      onSuccess: () => {
        setName("");
        setDescription("");
      },
    },
  );

  const delMut = useWorkspaceMutation(
    (id: string) => remove({ data: { id, workspaceId: q.wsId! } }),
    { invalidate: invalidateKey, successMessage: t("brands.removed") },
  );

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader icon={Palette} title={t("brands.title")} subtitle={t("brands.subtitle")} />

        <BrandComposer
          name={name}
          description={description}
          isPending={createMut.isPending}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onSubmit={() => createMut.mutate()}
        />

        {q.isError ? (
          <QueryErrorState onRetry={() => void q.refetch()} pending={q.isFetching} />
        ) : q.isLoading ? (
          <ListSkeleton rows={3} />
        ) : q.data && q.data.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Palette}
            title={t("brands.emptyTitle")}
            text={t("brands.emptyText")}
            action={
              <Button
                size="sm"
                onClick={() => {
                  const input = document.querySelector<HTMLInputElement>("#brand-name");
                  input?.focus();
                }}
              >
                <Plus aria-hidden="true" className="size-4" /> {t("brands.first")}
              </Button>
            }
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
