import { QueryErrorState } from "@/features/shell/components/QueryErrorState";
import { modulePageHead } from "@/lib/page-head";
import { useTranslation } from "react-i18next";
import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PageTransition } from "@/components/app/Motion";
import { ContentComposer } from "@/features/content/components/ContentComposer";
import { ContentFilters } from "@/features/content/components/ContentFilters";
import { BulkActionBar } from "@/features/content/components/BulkActionBar";
import { ContentList } from "@/features/content/components/ContentList";
import { useContentPage } from "@/features/content/hooks/useContentPage";
import { usePreflight } from "@/features/content/hooks/usePreflight";
import { PreflightPanel } from "@/features/content/components/PreflightPanel";
import { CoachCard } from "@/features/content/components/CoachCard";
import { useCoach } from "@/features/content/hooks/useCoach";
import { StudioPanel } from "@/features/content/components/StudioPanel";

export const Route = createFileRoute("/_authenticated/app/content")({
  head: () => modulePageHead("content"),
  component: ContentPage,
});

function ContentPage() {
  const { t } = useTranslation();
  const p = useContentPage();
  const pre = usePreflight(p.body, p.title);
  // Explicit-trigger AI: never runs on its own, because each call is billed.
  const coach = useCoach(p.body, p.title);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader icon={FileText} title={t("content.title")} subtitle={t("content.subtitle")} />

        {/* Composer + live preflight: the audit runs while you type, so the
            draft never reaches the queue with a limit violation. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ContentComposer
            title={p.title}
            body={p.body}
            onTitleChange={p.setTitle}
            onBodyChange={p.setBody}
            onSubmit={() => p.createMut.mutate()}
            isPending={p.createMut.isPending}
            canPublish={pre.result?.canPublish ?? true}
          />
          <div className="space-y-4">
            <PreflightPanel
              result={pre.result}
              loading={pre.loading}
              hookSuggestions={pre.hooks}
              platformLabel={pre.platformLabel}
              onUseHook={(text) =>
                p.setBody(`${text}\n\n${p.body.split(/\n\n/).slice(1).join("\n\n")}`.trim())
              }
            />
            <CoachCard coach={coach} onUseSuggestion={(text) => p.setBody(text)} />
          </div>
        </div>

        <details className="section-card overflow-hidden">
          <summary className="min-h-11 cursor-pointer px-5 py-4 text-sm font-semibold marker:text-primary">
            {t("content.advanced")}{" "}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t("content.optional")}
            </span>
          </summary>
          <StudioPanel key={p.q.wsId ?? "no-workspace"} workspaceId={p.q.wsId} items={p.items} />
        </details>

        <ContentFilters
          filter={p.filter}
          onFilterChange={p.setFilter}
          search={p.search}
          onSearchChange={p.setSearch}
          counts={p.counts}
        />

        {p.selected.size > 0 && (
          <BulkActionBar
            count={p.selected.size}
            onMoveTo={p.runBulkStatus}
            onDelete={p.runBulkDelete}
            onClear={() => p.setSelected(new Set())}
          />
        )}

        {p.q.isError ? (
          <QueryErrorState onRetry={() => void p.q.refetch()} pending={p.q.isFetching} />
        ) : (
          <ContentList
            items={p.items}
            filtered={p.filtered}
            isLoading={p.q.isLoading}
            selected={p.selected}
            allVisibleSelected={p.allVisibleSelected}
            onToggleAll={p.toggleAll}
            onToggleOne={p.toggleOne}
            onStatusChange={p.changeStatus}
            onClearFilters={p.clearFilters}
          />
        )}
      </div>
    </PageTransition>
  );
}
