import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { enqueuePublication, getSchedulingOptions } from "@/lib/api/scheduler.functions";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import {
  futureScheduleIso,
  localDateTime,
  type SchedulingOptions,
} from "@/lib/scheduler/scheduling";
import { QueryErrorState } from "@/features/shell/components/QueryErrorState";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";

export function ScheduleComposer({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const fetchOptions = useServerFn(getSchedulingOptions);
  const enqueue = useServerFn(enqueuePublication);
  const q = useWorkspaceQuery<SchedulingOptions>(
    (ws) => ["scheduler-options", ws],
    ({ workspaceId }) => fetchOptions({ data: { workspaceId } }),
  );
  const [contentId, setContentId] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [when, setWhen] = useState(() => localDateTime(new Date(Date.now() + 3600_000)));
  const [validation, setValidation] = useState("");
  const mutation = useWorkspaceMutation(
    async () => {
      const scheduledAt = futureScheduleIso(when);
      if (
        !canEdit ||
        !q.wsId ||
        !scheduledAt ||
        !contentId ||
        channelIds.length === 0 ||
        channelIds.length > 20
      )
        throw new Error(t("scheduler.scheduleInvalid"));
      return enqueue({ data: { contentId, channelIds, scheduledAt } });
    },
    {
      invalidate: q.wsId
        ? [
            ["scheduler", q.wsId],
            ["content", q.wsId],
            ["scheduler-options", q.wsId],
          ]
        : ["scheduler"],
      successMessage: (jobs) => t("scheduler.enqueued", { count: jobs.length }),
      onSuccess: () => {
        setContentId("");
        setChannelIds([]);
        setValidation("");
      },
    },
  );
  const disabled = !canEdit || q.isPending || q.isError || mutation.isPending;
  const eligible = new Set(q.data?.channels.filter((c) => c.eligible).map((c) => c.id));
  const validSelection =
    channelIds.length > 0 &&
    channelIds.every((id) => eligible.has(id)) &&
    Boolean(q.data?.contents.some((c) => c.id === contentId));
  return (
    <section className="section-card p-5" aria-labelledby="schedule-composer-heading">
      <h2 id="schedule-composer-heading" className="text-lg font-semibold">
        {t("scheduler.composeTitle")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("scheduler.composeHint")}</p>
      {q.isPending && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      )}
      {q.isError ? (
        <QueryErrorState onRetry={() => void q.refetch()} pending={q.isFetching} />
      ) : (
        <form
          className="mt-4 space-y-4"
          aria-busy={mutation.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled) return;
            if (!futureScheduleIso(when) || !validSelection) {
              setValidation(t("scheduler.scheduleInvalid"));
              return;
            }
            setValidation("");
            mutation.mutate();
          }}
        >
          <fieldset disabled={disabled} className="min-w-0 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label htmlFor="schedule-content" className="block space-y-1.5">
                <span className="text-sm font-medium">{t("scheduler.chooseContent")}</span>
                <select
                  id="schedule-content"
                  required
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("scheduler.contentPlaceholder")}</option>
                  {(q.data?.contents ?? []).map((content) => (
                    <option key={content.id} value={content.id}>
                      {content.title || t("scheduler.untitled")}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="schedule-time" className="block space-y-1.5">
                <span className="text-sm font-medium">{t("scheduler.chooseTime")}</span>
                <input
                  id="schedule-time"
                  type="datetime-local"
                  required
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  aria-describedby="schedule-time-hint"
                  className="min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <span id="schedule-time-hint" className="block text-xs text-muted-foreground">
                  {t("scheduler.localTimezone")}
                </span>
              </label>
            </div>
            <fieldset className="min-w-0 space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("scheduler.chooseChannels")}</legend>
              {(q.data?.channels ?? []).map((channel) => (
                <label
                  key={channel.id}
                  className="flex min-h-11 min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={channelIds.includes(channel.id)}
                    disabled={
                      !channel.eligible ||
                      disabled ||
                      (!channelIds.includes(channel.id) && channelIds.length >= 20)
                    }
                    onChange={(e) =>
                      setChannelIds((ids) =>
                        e.target.checked
                          ? [...ids, channel.id]
                          : ids.filter((id) => id !== channel.id),
                      )
                    }
                  />
                  <span className="min-w-0 break-words">
                    {PLATFORM_RULES[channel.platform as PlatformId]?.label ?? channel.platform} ·{" "}
                    {channel.handle || "—"}
                    {!channel.eligible && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t(`scheduler.reason_${channel.reason}`)}
                      </span>
                    )}
                  </span>
                </label>
              ))}
              {!q.isPending && !q.data?.channels.some((c) => c.eligible) && (
                <p className="text-sm text-muted-foreground">
                  {t("scheduler.noEligibleChannels")}{" "}
                  <Link to="/app/channels" className="underline">
                    {t("scheduler.openChannels")}
                  </Link>
                </p>
              )}
              {!q.isPending && q.data?.contents.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("scheduler.noDrafts")}{" "}
                  <Link to="/app/content" className="underline">
                    {t("scheduler.contentLink")}
                  </Link>
                </p>
              )}
            </fieldset>
          </fieldset>
          {(validation || mutation.isError) && (
            <p role="alert" className="text-sm text-destructive">
              {validation || mutation.error?.message}
            </p>
          )}
          <button
            type="submit"
            disabled={disabled || !validSelection}
            className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t(mutation.isPending ? "scheduler.enqueueing" : "scheduler.enqueue")}
          </button>
        </form>
      )}
    </section>
  );
}
