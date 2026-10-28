import { createFileRoute } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { PageTransition } from "@/components/app/Motion";
import { BioEditor } from "@/features/bio/components/BioEditor";

export const Route = createFileRoute("/_authenticated/app/bio")({
  component: BioPageRoute,
});

function BioPageRoute() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          icon={Link2}
          title="Link na bio"
          subtitle="Uma página pública com seus links, contato e ofertas — pronta para a bio do Instagram."
        />
        {/* Loading and error states live inside the editor: it owns the query, and
            mounting the form before the row arrives would hydrate it with empty
            strings and swallow the first keystrokes. */}
        <BioEditor />
      </div>
    </PageTransition>
  );
}
