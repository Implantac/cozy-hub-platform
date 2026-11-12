import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth/use-auth";
import { listMyWorkspaces } from "@/lib/api/workspaces.functions";
import { useCurrentWorkspaceId } from "./use-workspace";
import { workspacePermissions } from "./permissions";

/** Reuse the shell's user-keyed membership cache; do not infer access from a stored ID. */
export function useWorkspaceAccess() {
  const { user } = useAuth();
  const [workspaceId] = useCurrentWorkspaceId();
  const list = useServerFn(listMyWorkspaces);
  const query = useQuery({
    queryKey: ["my-workspaces", user?.id],
    queryFn: () => list(),
    enabled: !!user,
  });
  const role = query.isError
    ? null
    : query.data?.find((workspace) => workspace.id === workspaceId)?.role;
  return {
    ...workspacePermissions(role),
    role,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    retry: () => void query.refetch(),
  };
}
