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

export const Route = createFileRoute("/_authenticated/app/content")({
  component: ContentPage,
});

function ContentPage() {
  const p = useContentPage();
  const pre = usePreflight(p.body, p.title);
  // Explicit-trigger AI: never runs on its own, because each call is billed.
  const coach = useCoach(p.body, p.title);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={FileText}
          title="Content"
          subtitle="Drafts, templates and AI-assisted creation."
        />

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
      </div>
    </PageTransition>
  );
}
