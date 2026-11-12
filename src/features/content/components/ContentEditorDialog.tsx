import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateContent } from "@/lib/api/content.functions";
import type { Content } from "@/lib/api/_types";
import { contentMediaUrls, parseMediaInput } from "@/lib/content/media";
import { useWorkspaceMutation } from "@/lib/query/use-workspace-query";

/** Local draft survives network failures; opening another item always creates a fresh editor. */
export function ContentEditorDialog({ item, onClose }: { item: Content; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useServerFn(updateContent);
  const [title, setTitle] = useState(item.title ?? "");
  const [body, setBody] = useState(item.body ?? "");
  const [media, setMedia] = useState(contentMediaUrls(item.media).join("\n"));
  const mutation = useWorkspaceMutation(
    () =>
      save({
        data: {
          workspaceId: item.workspace_id,
          id: item.id,
          title: title.trim(),
          body,
          mediaUrls: parseMediaInput(media),
        },
      }),
    {
      invalidate: [
        ["content", item.workspace_id],
        ["scheduler-options", item.workspace_id],
      ],
      successMessage: t("content.saved"),
      onSuccess: onClose,
    },
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("content.editTitle")}</DialogTitle>
          <DialogDescription>{t("content.editHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (title.trim() && !mutation.isPending) mutation.mutate();
          }}
          aria-busy={mutation.isPending}
        >
          <fieldset disabled={mutation.isPending} className="space-y-4">
            <label className="block space-y-1.5" htmlFor="edit-content-title">
              <span className="text-sm font-medium">{t("content.titleLabel")}</span>
              <input
                id="edit-content-title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1.5" htmlFor="edit-content-body">
              <span className="text-sm font-medium">{t("content.bodyLabel")}</span>
              <textarea
                id="edit-content-body"
                rows={6}
                maxLength={20000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1.5" htmlFor="edit-content-media">
              <span className="text-sm font-medium">{t("content.mediaLabel")}</span>
              <textarea
                id="edit-content-media"
                rows={3}
                maxLength={40000}
                value={media}
                onChange={(e) => setMedia(e.target.value)}
                aria-describedby="edit-content-media-hint"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </label>
            <p id="edit-content-media-hint" className="text-xs text-muted-foreground">
              {t("content.mediaHint")}
            </p>
          </fieldset>
          {mutation.isError && (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="min-h-11 rounded-lg border px-4 py-2 text-sm"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || !title.trim()}
              className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {t(mutation.isPending ? "content.saving" : "content.saveChanges")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
