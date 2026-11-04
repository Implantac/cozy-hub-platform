import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import {
  generateStudioScript,
  saveStudioDraft,
  createStudioVideo,
  getStudioVideoStatus,
  downloadStudioVideo,
} from "@/lib/api/studio.functions";
import { studioMetadataSchema, type StudioBrief, type StudioScript } from "@/lib/studio/schema";
import type { Content } from "@/lib/api/_types";
import {
  estimateNarrationSeconds,
  isRenderOutdated,
  type RenderSnapshot,
} from "@/lib/studio/editor";

const control = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const button =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50";
const initialBrief = (workspaceId: string, language: "pt-BR" | "en-US"): StudioBrief => ({
  workspaceId,
  topic: "",
  audience: "",
  goal: "",
  sourceMaterial: "",
  platform: "instagram",
  duration: "30",
  tone: "educational",
  language,
});

export function StudioPanel({
  workspaceId,
  items,
}: {
  workspaceId: string | null;
  items: Content[];
}) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === "en-US" ? "en-US" : "pt-BR";
  const [brief, setBrief] = useState(() => initialBrief(workspaceId ?? "", language));
  const [script, setScript] = useState<StudioScript | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>();
  const [selected, setSelected] = useState("");
  const [saved, setSaved] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [renderSnapshot, setRenderSnapshot] = useState<RenderSnapshot | null>(null);
  const runGenerate = useServerFn(generateStudioScript);
  const runSave = useServerFn(saveStudioDraft);
  const runRender = useServerFn(createStudioVideo);
  const runStatus = useServerFn(getStudioVideoStatus);
  const runDownload = useServerFn(downloadStudioVideo);
  const qc = useQueryClient();
  const generate = useMutation({
    mutationFn: () => runGenerate({ data: { ...brief, workspaceId: workspaceId! } }),
    onSuccess: (result) => {
      setScript(result);
      setDraftId(undefined);
      setJobId(null);
      setRenderSnapshot(null);
      setSaved(false);
    },
    retry: false,
  });
  const save = useMutation({
    mutationFn: () =>
      runSave({
        data: {
          workspaceId: workspaceId!,
          draftId,
          brief: { ...brief, workspaceId: workspaceId! },
          script: script!,
        },
      }),
    onSuccess: (result) => {
      setDraftId(result.id);
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["content", workspaceId] });
    },
    retry: false,
  });
  const createVideo = useMutation({
    mutationFn: (snapshot: RenderSnapshot) =>
      runRender({ data: { workspaceId: workspaceId!, ...snapshot } }),
    onSuccess: (result, snapshot) => {
      setJobId(result.jobId);
      setRenderSnapshot(snapshot);
    },
    retry: false,
  });
  const status = useQuery({
    queryKey: ["studio-local-video", workspaceId, jobId],
    queryFn: () => runStatus({ data: { workspaceId: workspaceId!, jobId: jobId! } }),
    enabled: Boolean(workspaceId && jobId),
    refetchInterval: (query) => {
      const state = query.state.data?.status;
      return query.state.error || state === "completed" || state === "failed" ? false : 3000;
    },
    retry: false,
  });
  const download = useMutation({
    mutationFn: () => runDownload({ data: { workspaceId: workspaceId!, jobId: jobId! } }),
    onSuccess: ({ data }) => {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "velt-video.mp4";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    retry: false,
  });
  const videoOutdated = script ? isRenderOutdated(renderSnapshot, script) : false;
  const busy = generate.isPending || save.isPending || createVideo.isPending || download.isPending;
  const drafts = items.filter(
    (item) => item.status === "draft" && studioMetadataSchema.safeParse(item.metadata).success,
  );
  const updateBrief = <K extends keyof StudioBrief>(key: K, value: StudioBrief[K]) => {
    setBrief((old) => ({ ...old, [key]: value }));
    setSaved(false);
  };
  const updateScript = (key: keyof StudioScript, value: string) => {
    setScript((old) => (old ? { ...old, [key]: value } : old));
    setSaved(false);
  };
  const confirmReplace = () => !script || saved || window.confirm(t("studio.confirmReplace"));
  const openDraft = () => {
    const item = drafts.find((draft) => draft.id === selected);
    const parsed = studioMetadataSchema.safeParse(item?.metadata);
    if (!item || !parsed.success || !confirmReplace()) return;
    setBrief(parsed.data.studio.brief);
    setScript(parsed.data.studio.script);
    setDraftId(item.id);
    setJobId(null);
    setRenderSnapshot(null);
    setSaved(true);
    generate.reset();
    save.reset();
  };
  const reset = () => {
    if (!confirmReplace()) return;
    setBrief(initialBrief(workspaceId ?? "", language));
    setScript(null);
    setDraftId(undefined);
    setSelected("");
    setJobId(null);
    setRenderSnapshot(null);
    setSaved(false);
    generate.reset();
    save.reset();
  };
  const label = (id: string, text: string, child: React.ReactNode) => (
    <label htmlFor={id} className="block space-y-1 text-sm font-medium">
      <span>{text}</span>
      {child}
    </label>
  );
  if (!workspaceId)
    return <div className="section-card p-5 text-sm">{t("studio.unavailable")}</div>;
  return (
    <section className="section-card space-y-4 p-5" aria-labelledby="studio-heading">
      <div>
        <h2 id="studio-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5" />
          {t("studio.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("studio.description")}</p>
      </div>
      {drafts.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          {label(
            "studio-drafts",
            t("studio.drafts"),
            <select
              id="studio-drafts"
              className={control}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
            >
              <option value="">{t("studio.selectDraft")}</option>
              {drafts.map((d) => (
                <option value={d.id} key={d.id}>
                  {d.title}
                </option>
              ))}
            </select>,
          )}
          <button type="button" className={button} onClick={openDraft} disabled={!selected || busy}>
            {t("studio.loadingDraft")}
          </button>
        </div>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (confirmReplace()) generate.mutate();
        }}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {label(
            "studio-topic",
            t("studio.topic"),
            <input
              id="studio-topic"
              className={control}
              required
              maxLength={300}
              value={brief.topic}
              onChange={(e) => updateBrief("topic", e.target.value)}
              disabled={busy}
            />,
          )}
          {label(
            "studio-audience",
            t("studio.audience"),
            <input
              id="studio-audience"
              className={control}
              required
              maxLength={300}
              value={brief.audience}
              onChange={(e) => updateBrief("audience", e.target.value)}
              disabled={busy}
            />,
          )}
          {label(
            "studio-goal",
            t("studio.goal"),
            <input
              id="studio-goal"
              className={control}
              required
              maxLength={300}
              value={brief.goal}
              onChange={(e) => updateBrief("goal", e.target.value)}
              disabled={busy}
            />,
          )}
        </div>
        {label(
          "studio-source",
          t("studio.source"),
          <textarea
            id="studio-source"
            className={control}
            rows={3}
            maxLength={5000}
            value={brief.sourceMaterial}
            onChange={(e) => updateBrief("sourceMaterial", e.target.value)}
            disabled={busy}
          />,
        )}
        <p className="text-xs text-muted-foreground">{t("studio.sourceHelp")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {label(
            "studio-platform",
            t("studio.platform"),
            <select
              id="studio-platform"
              className={control}
              value={brief.platform}
              onChange={(e) => updateBrief("platform", e.target.value as StudioBrief["platform"])}
              disabled={busy}
            >
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="tiktok">TikTok</option>
            </select>,
          )}
          {label(
            "studio-duration",
            t("studio.duration"),
            <select
              id="studio-duration"
              className={control}
              value={brief.duration}
              onChange={(e) => updateBrief("duration", e.target.value as StudioBrief["duration"])}
              disabled={busy}
            >
              {["15", "30", "60"].map((v) => (
                <option value={v} key={v}>
                  {v} {t("studio.seconds")}
                </option>
              ))}
            </select>,
          )}
          {label(
            "studio-tone",
            t("studio.tone"),
            <select
              id="studio-tone"
              className={control}
              value={brief.tone}
              onChange={(e) => updateBrief("tone", e.target.value as StudioBrief["tone"])}
              disabled={busy}
            >
              {(["educational", "friendly", "professional"] as const).map((v) => (
                <option value={v} key={v}>
                  {t(`studio.${v}`)}
                </option>
              ))}
            </select>,
          )}
        </div>
        {label(
          "studio-language",
          t("studio.scriptLanguage"),
          <select
            id="studio-language"
            className={control}
            value={brief.language}
            onChange={(e) => updateBrief("language", e.target.value as StudioBrief["language"])}
            disabled={busy}
          >
            <option value="pt-BR">Português (Brasil)</option>
            <option value="en-US">English</option>
          </select>,
        )}
        <button
          className={button}
          type="submit"
          disabled={busy || !brief.topic.trim() || !brief.audience.trim() || !brief.goal.trim()}
        >
          {generate.isPending ? t("studio.generating") : t("studio.generate")}
        </button>
      </form>
      {generate.error && (
        <p role="alert" className="text-sm text-destructive">
          {generate.error.message || t("studio.failed")}
        </p>
      )}
      {script && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm text-amber-600">{t("studio.review")}</p>
          {(
            [
              ["title", "scriptTitle", 200],
              ["hook", "hook", 500],
              ["narration", "narration", 5000],
              ["scenes", "scenes", 3000],
              ["callToAction", "cta", 500],
              ["caption", "caption", 5000],
            ] as const
          ).map(([key, translation, max]) =>
            label(
              `studio-${key}`,
              t(`studio.${translation}`),
              <textarea
                id={`studio-${key}`}
                className={control}
                rows={key === "narration" || key === "scenes" || key === "caption" ? 3 : 1}
                maxLength={max}
                value={script[key]}
                onChange={(e) => updateScript(key, e.target.value)}
                disabled={busy}
              />,
            ),
          )}
          <p className="text-xs text-muted-foreground">
            {t("studio.narrationEstimate", {
              seconds: estimateNarrationSeconds(script.narration),
              target: brief.duration,
            })}
          </p>
          <p className="text-xs text-muted-foreground">{t("studio.unsaved")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              disabled={busy || Object.values(script).some((s) => !s.trim())}
              onClick={() => save.mutate()}
            >
              {save.isPending ? t("studio.saving") : t("studio.save")}
            </button>
            <button
              type="button"
              className="rounded-md border border-input px-4 py-2 text-sm"
              disabled={busy || !script.title.trim() || !script.narration.trim()}
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      { version: 1, title: script.title, narration: script.narration },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "velt-roteiro.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              {t("studio.export")}
            </button>
            <button
              type="button"
              className="rounded-md border border-input px-4 py-2 text-sm"
              onClick={reset}
              disabled={busy}
            >
              {t("studio.new")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{t("studio.exportHelp")}</p>
          <div className="space-y-3 rounded-md border border-input p-4">
            <h3 className="font-semibold">{t("studio.renderTitle")}</h3>
            <p className="text-sm text-muted-foreground">{t("studio.renderInfo")}</p>
            <button
              type="button"
              className={button}
              disabled={
                busy ||
                !script.title.trim() ||
                !script.narration.trim() ||
                script.narration.length > 3000 ||
                (Boolean(jobId) &&
                  (status.isLoading ||
                    status.data?.status === "queued" ||
                    status.data?.status === "processing"))
              }
              onClick={() => {
                if (window.confirm(t("studio.renderConfirm")))
                  createVideo.mutate({ title: script.title, narration: script.narration });
              }}
            >
              {t("studio.render")}
            </button>
            {script.narration.length > 3000 && (
              <p className="text-sm text-amber-600">{t("studio.renderLimit")}</p>
            )}
            {jobId && <p className="text-xs text-muted-foreground">{t("studio.renderSnapshot")}</p>}
            {videoOutdated && (
              <p role="status" className="text-sm text-amber-600">
                {t("studio.renderOutdated")}
              </p>
            )}
            {status.data?.status && (
              <p role="status" className="text-sm">
                {t(
                  `studio.render${status.data.status.charAt(0).toUpperCase()}${status.data.status.slice(1)}`,
                )}
              </p>
            )}
            {status.error && (
              <div role="alert" className="text-sm text-destructive">
                {status.error.message}{" "}
                <button type="button" className="underline" onClick={() => status.refetch()}>
                  {t("studio.renderRetry")}
                </button>
              </div>
            )}
            {createVideo.error && (
              <p role="alert" className="text-sm text-destructive">
                {createVideo.error.message}
              </p>
            )}
            {download.error && (
              <p role="alert" className="text-sm text-destructive">
                {download.error.message}
              </p>
            )}
            {status.data?.status === "completed" && (
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => {
                  if (!videoOutdated || window.confirm(t("studio.renderDownloadOutdated")))
                    download.mutate();
                }}
              >
                {download.isPending ? t("studio.renderDownloading") : t("studio.renderDownload")}
              </button>
            )}
          </div>
          {saved && (
            <p role="status" className="text-sm text-emerald-600">
              {t("studio.saved")} {t("studio.created")}
            </p>
          )}
          {save.error && (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message || t("studio.failed")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
