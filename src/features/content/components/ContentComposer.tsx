import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ContentComposerProps {
  title: string;
  body: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSubmit: () => void;
  isPending: boolean;
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
  const { t } = useTranslation();
  return (
    <section
      id="draft-composer"
      aria-labelledby="draft-composer-heading"
      className="section-card p-5"
    >
      <h2 id="draft-composer-heading" className="mb-4 text-lg font-semibold">
        {t("content.composerTitle")}
      </h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() && !isPending) onSubmit();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="draft-title" className="text-sm font-medium">
            {t("content.titleLabel")}
          </label>
          <input
            id="draft-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t("content.titlePlaceholder")}
            required
            maxLength={200}
            className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="draft-body" className="text-sm font-medium">
            {t("content.bodyLabel")}
          </label>
          <textarea
            id="draft-body"
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder={t("content.bodyPlaceholder")}
            rows={5}
            maxLength={20000}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <p id="draft-save-hint" className="text-xs leading-relaxed text-muted-foreground">
          {t("content.saveHint")}
        </p>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          aria-describedby="draft-save-hint"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          <Plus aria-hidden="true" className="size-4" />{" "}
          {t(isPending ? "content.saving" : "content.save")}
        </button>
        {!canPublish && <p className="text-xs text-warning">{t("content.blocked")}</p>}
      </form>
    </section>
  );
}
