import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, FlaskConical, Loader2, XCircle } from "lucide-react";
import { GrowthService } from "@/lib/services";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";

interface Capability {
  platform: string;
  implemented: boolean;
  credentialsReady: boolean;
  missingEnv: string[];
}

/** Configuration readiness is not external-provider approval or homologation. */
export function PublishCapabilityStrip() {
  const { t } = useTranslation();
  const fetchCaps = useServerFn(GrowthService.getPublishCapabilities);
  const q = useQuery({
    queryKey: ["publish-caps"],
    queryFn: async () => {
      const r = await fetchCaps();
      return r as unknown as { platforms: Capability[]; simulated: boolean; readyCount: number };
    },
    staleTime: 10 * 60_000,
    retry: false,
  });

  if (q.isError)
    return (
      <p role="alert" className="text-sm text-muted-foreground">
        {t("scheduler.capabilityError")}{" "}
        <button type="button" onClick={() => void q.refetch()} className="underline">
          {t("common.tryAgain")}
        </button>
      </p>
    );
  if (q.isLoading || !q.data)
    return (
      <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {t("scheduler.capabilityLoading")}
      </p>
    );

  const { platforms, simulated } = q.data;
  const ready = platforms.filter((p) => p.implemented && p.credentialsReady);
  const needsCreds = platforms.filter((p) => p.implemented && !p.credentialsReady);
  const notImplemented = platforms.filter((p) => !p.implemented);

  return (
    <div className="section-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs">
      <span className="font-medium text-muted-foreground">{t("scheduler.capabilityLabel")}</span>
      {simulated && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-500">
          <FlaskConical className="size-3" aria-hidden="true" />
          {t("scheduler.simulatedWarning")}
        </span>
      )}
      {ready.map((p) => (
        <span key={p.platform} className="inline-flex items-center gap-1.5 text-emerald-500">
          <CheckCircle2 className="size-3" aria-hidden="true" />
          {PLATFORM_RULES[p.platform as PlatformId]?.label ?? p.platform}
        </span>
      ))}
      {needsCreds.map((p) => (
        <span
          key={p.platform}
          className="inline-flex items-center gap-1.5 text-amber-500"
          title={t("scheduler.missingEnvironment", { variables: p.missingEnv.join(", ") })}
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          {PLATFORM_RULES[p.platform as PlatformId]?.label ?? p.platform}
          <span className="text-xs">{t("scheduler.configurationPending")}</span>
        </span>
      ))}
      {notImplemented.map((p) => (
        <span key={p.platform} className="inline-flex items-center gap-1.5 text-muted-foreground">
          <XCircle className="size-3" aria-hidden="true" />
          {PLATFORM_RULES[p.platform as PlatformId]?.label ?? p.platform}
          <span className="text-xs">{t("scheduler.notImplemented")}</span>
        </span>
      ))}
    </div>
  );
}
