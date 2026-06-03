import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PageTransition } from "@/components/app/Motion";
import { ContentComposer } from "@/features/content/components/ContentComposer";
import { ContentFilters } from "@/features/content/components/ContentFilters";
import { BulkActionBar } from "@/features/content/components/BulkActionBar";
import { ContentList } from "@/features/content/components/ContentList";
import { useContentPage } from "@/features/content/hooks/useContentPage";

export const Route = createFileRoute("/_authenticated/app/content")({
  component: ContentPage,
});

function ContentPage() {
  const p = useContentPage();

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader icon={FileText} title="Content" subtitle="Drafts, templates and AI-assisted creation." />

        <ContentComposer
          title={p.title}
          body={p.body}
          onTitleChange={p.setTitle}
          onBodyChange={p.setBody}
          onSubmit={() => p.createMut.mutate()}
          isPending={p.createMut.isPending}
        />

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
