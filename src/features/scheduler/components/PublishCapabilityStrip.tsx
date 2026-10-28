import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FlaskConical, XCircle } from "lucide-react";
import { GrowthService } from "@/lib/services";
import { PLATFORM_RULES, type PlatformId } from "@/lib/growth/platform-rules";

interface Capability {
  platform: string;
  implemented: boolean;
  credentialsReady: boolean;
  missingEnv: string[];
}

/**
 * Capability strip: which platforms can actually publish right now.
 *
 * Deliberately visible on the scheduler page. A queue that silently accepts
 * jobs it cannot execute is worse than a queue that says "not yet" — the user
 * would only find out hours later, from a dead-letter entry.
 */
export function PublishCapabilityStrip() {
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

  if (q.isLoading || q.isError || !q.data) return null;
  const { platforms, simulated } = q.data;

  const ready = platforms.filter((p) => p.implemented && p.credentialsReady);
  const needsCreds = platforms.filter((p) => p.implemented && !p.credentialsReady);
  const notImplemented = platforms.filter((p) => !p.implemented);

  return (
    <div className="section-card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-xs">
      <span className="font-medium text-muted-foreground">Publicação automática:</span>

      {simulated && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-500">
          <FlaskConical className="size-3" /> modo simulado — nada é publicado de fato
        </span>
      )}

      {ready.map((p) => (
        <span key={p.platform} className="inline-flex items-center gap-1.5 text-emerald-500">
          <CheckCircle2 className="size-3" />
          {PLATFORM_RULES[p.platform as PlatformId]?.label ?? p.platform}
        </span>
      ))}

      {needsCreds.map((p) => (
        <span
          key={p.platform}
          className="inline-flex items-center gap-1.5 text-amber-500"
          title={`Faltam variáveis de ambiente: ${p.missingEnv.join(", ")}`}
        >
          <AlertTriangle className="size-3" />
          {PLATFORM_RULES[p.platform as PlatformId]?.label ?? p.platform}
          <span className="text-[10px] opacity-70">(sem credenciais)</span>
        </span>
      ))}

      {notImplemented.map((p) => (
        <span
          key={p.platform}
          className="inline-flex items-center gap-1.5 text-muted-foreground/70"
        >
          <XCircle className="size-3" />
          {PLATFORM_RULES[p.platform as PlatformId]?.label ?? p.platform}
        </span>
      ))}
    </div>
  );
}
