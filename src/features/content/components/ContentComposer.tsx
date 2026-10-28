import { Plus } from "lucide-react";

interface ContentComposerProps {
  title: string;
  body: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  /** False when the live preflight found a blocker for at least one channel. */
  canPublish?: boolean;
}

export function ContentComposer({
  title,
  body,
  onTitleChange,
  onBodyChange,
  onSubmit,
  isPending,
  canPublish = true,
}: ContentComposerProps) {
  return (
    <div className="section-card p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.length >= 1) onSubmit();
        }}
        className="space-y-3"
      >
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Gancho do post (primeira linha)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Escreva o post. A primeira linha é o que 90% das pessoas vão ler."
          rows={4}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center gap-3">
          <button
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> Salvar rascunho
          </button>
          {!canPublish && (
            <span className="text-xs text-amber-500">
              Impedimento detectado no pré-voo — dá para salvar, mas não para agendar.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
