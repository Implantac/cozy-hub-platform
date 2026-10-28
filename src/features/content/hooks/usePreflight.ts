import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { GrowthService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import {
  adReadiness,
  preflight,
  suggestHooks,
  type QualityCheck,
  type AdReadiness,
} from "@/lib/growth/post-quality";
import { PLATFORM_RULES } from "@/lib/growth/platform-rules";

/** Platform is a plain string at the UI boundary (server may return any enum). */
export type ChannelResult = Omit<QualityCheck, "platform"> & {
  platform: string;
  ad: AdReadiness;
};

export interface PreflightState {
  result: { channels: ChannelResult[]; canPublish: boolean } | undefined;
  loading: boolean;
  hooks: Array<{ id: string; label: string; text: string; rationale: string }> | undefined;
  platformLabel: (p: string) => string;
}

const DEBOUNCE_MS = 500;

/**
 * Live content preflight.
 *
 * Strategy: the engines are pure and run client-side for instant feedback, so
 * the composer never feels laggy. The server round-trip is used to reconcile
 * against the workspace's *actual* channels (which platforms will receive the
 * post) and to pick up server-side rules. If the server call fails — offline,
 * expired session, local dev without env — we degrade gracefully to the local
 * engine rather than showing an error: the checks are identical by design,
 * since both sides import the same pure module.
 */
export function usePreflight(body: string, title: string, mediaCount = 0): PreflightState {
  const [wsId] = useCurrentWorkspaceId();
  const run = useServerFn(GrowthService.preflightDraft);
  const suggest = useServerFn(GrowthService.suggestPostHooks);

  const [debounced, setDebounced] = useState(body);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(body), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [body]);

  const enabled = wsId && debounced.trim().length > 0;

  const q = useQuery({
    queryKey: ["preflight", wsId, debounced, title, mediaCount],
    queryFn: async () => {
      const r = await run({
        data: { workspaceId: wsId!, body: debounced, title: title || null, mediaCount },
      });
      return r as unknown as { channels: ChannelResult[]; canPublish: boolean };
    },
    enabled: !!enabled,
    staleTime: 30_000,
    retry: false,
  });

  const hq = useQuery({
    queryKey: ["post-hooks", wsId, debounced],
    queryFn: async () => {
      const r = await suggest({
        data: { workspaceId: wsId!, body: debounced, platform: "instagram" },
      });
      return r as unknown as Array<{ id: string; label: string; text: string; rationale: string }>;
    },
    enabled: !!enabled,
    staleTime: 60_000,
    retry: false,
  });

  // Local fallback — identical engines, no network.
  const localResult = useMemo(() => {
    if (!debounced.trim()) return undefined;
    const platforms = ["instagram"];
    const channels = platforms.map((platform) => {
      const check = preflight({ body: debounced, title: title || null, platform, mediaCount });
      return { ...check, platform, ad: adReadiness(debounced, platform) };
    });
    return { channels, canPublish: channels.every((c) => c.passed) };
  }, [debounced, title, mediaCount]);

  const result = q.data ?? (q.isError ? localResult : undefined);
  const hooks = hq.data ?? (hq.isError ? suggestHooks(debounced, "instagram") : undefined);

  return {
    result,
    loading: q.isFetching && !q.data,
    hooks,
    platformLabel: (p: string) => PLATFORM_RULES[p as keyof typeof PLATFORM_RULES]?.label ?? p,
  };
}
