import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GrowthService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";

export interface CoachSuggestion {
  body: string;
  rationale: string;
  addresses: string;
  score: number;
  fixed: string[];
}

export interface CoachResult {
  source: "ai" | "unavailable";
  suggestions: CoachSuggestion[];
  issueIds: string[];
  skippedReason?: "no_key" | "model_failed" | "all_rejected";
  retryInSeconds?: number;
  model?: string;
}

/**
 * The AI coach is a *mutation*, not a query.
 *
 * Every other preflight call in this screen is a pure function of the text and
 * runs on a debounce for free. This one costs a model call, so it must fire on an
 * explicit user action and never as a side effect of typing. Modelled as a
 * mutation, that contract is enforced by the type system: there is no way to
 * make it run by accident.
 */
export function useCoach(body: string, title: string, mediaCount = 0) {
  const [wsId] = useCurrentWorkspaceId();
  const run = useServerFn(GrowthService.coachDraftWithAI);

  const mutation = useMutation<CoachResult>({
    mutationFn: async () => {
      const result = await run({
        data: {
          workspaceId: wsId!,
          body,
          title: title || null,
          mediaCount,
          platform: "instagram",
        },
      });
      return result as unknown as CoachResult;
    },
    // The panel must survive an AI failure: the deterministic advice above it is
    // still valid and is what the user came for.
    retry: false,
  });

  return {
    request: () => mutation.mutate(),
    reset: () => mutation.reset(),
    pending: mutation.isPending,
    result: mutation.data,
    error: mutation.error,
    canRun: Boolean(wsId) && body.trim().length >= 20,
  };
}
