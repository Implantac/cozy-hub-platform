import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
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

interface WorkspaceMutationOptions<TData> {
  invalidate?: QueryKey | QueryKey[];
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string;
  onSuccess?: (data: TData) => void;
}

/**
 * Reusable wrapper for workspace mutations.
 *
 * Handles the common pattern of `invalidateQueries` + `toast.success/error`
 * so individual screens don't redeclare it.
 */
export function useWorkspaceMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  opts: WorkspaceMutationOptions<TData> = {},
) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: fn,
    onSuccess: (data) => {
      const raw = opts.invalidate;
      const keys: QueryKey[] = !raw
        ? []
        : Array.isArray(raw) && Array.isArray(raw[0])
        ? (raw as QueryKey[])
        : [raw as QueryKey];
      keys.forEach((key) => qc.invalidateQueries({ queryKey: key }));

      if (opts.successMessage) {
        const msg = typeof opts.successMessage === "function"
          ? opts.successMessage(data)
          : opts.successMessage;
        toast.success(msg);
      }

      opts.onSuccess?.(data);
    },
    onError: (err) => {
      toast.error(opts.errorMessage ?? err.message);
    },
  });
}
