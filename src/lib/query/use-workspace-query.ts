import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";

/**
 * Reusable wrapper for workspace-scoped queries.
 *
 * Encapsulates two pieces of repeated boilerplate:
 *  - `enabled: !!wsId` (only run when a workspace is selected)
 *  - automatic `workspaceId` injection into the query function
 *
 * The returned object exposes `wsId` so callers can compose mutation keys.
 */
export function useWorkspaceQuery<TData>(
  key: (wsId: string) => QueryKey,
  fn: (args: { workspaceId: string }) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, "queryKey" | "queryFn" | "enabled">,
) {
  const [wsId] = useCurrentWorkspaceId();
  const query = useQuery<TData>({
    queryKey: wsId ? key(wsId) : ["__ws_pending__"],
    queryFn: () => fn({ workspaceId: wsId! }),
    enabled: !!wsId,
    ...options,
  });
  return { ...query, wsId };
}

interface WorkspaceMutationOptions<TVars, TData> {
  invalidate?: QueryKey | QueryKey[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onSuccess?: UseMutationOptions<TData, Error, TVars>["onSuccess"];
}

/**
 * Reusable wrapper for workspace mutations.
 *
 * Handles the common pattern of `invalidateQueries` + `toast.success/error`
 * so individual screens don't redeclare it.
 */
export function useWorkspaceMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  opts: WorkspaceMutationOptions<TVars, TData> = {},
) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data, vars, ctx) => {
      const keys = Array.isArray(opts.invalidate?.[0])
        ? (opts.invalidate as QueryKey[])
        : opts.invalidate
        ? [opts.invalidate as QueryKey]
        : [];
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));

      if (opts.successMessage) {
        const msg = typeof opts.successMessage === "function"
          ? opts.successMessage(data)
          : opts.successMessage;
        toast.success(msg);
      }

      opts.onSuccess?.(data, vars, ctx);
    },
    onError: (err) => {
      toast.error(opts.errorMessage ?? err.message);
    },
  });
}
