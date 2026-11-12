import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  createWorkspace,
  getMyProfile,
  listMyWorkspaces,
  setDefaultWorkspace,
} from "@/lib/api/workspaces.functions";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { resolveWorkspaceId } from "@/lib/workspace/workspace-store";
import { useAuth } from "@/lib/auth/use-auth";
import { errorMessage } from "@/lib/json";

export function useWorkspaceBootstrap() {
  const auth = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const attemptedUser = useRef<string | null>(null);
  const fetchWs = useServerFn(listMyWorkspaces);
  const fetchProfile = useServerFn(getMyProfile);
  const createWs = useServerFn(createWorkspace);
  const setDefaultWs = useServerFn(setDefaultWorkspace);

  const wsQuery = useQuery({
    queryKey: ["my-workspaces", auth.user?.id],
    queryFn: () => fetchWs(),
    enabled: !!auth.user,
  });
  const profileQuery = useQuery({
    queryKey: ["my-profile", auth.user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!auth.user,
  });

  const [currentWsId, setCurrentWsId] = useCurrentWorkspaceId();
  const workspaces = useMemo(() => wsQuery.data ?? [], [wsQuery.data]);
  const resolvedId = resolveWorkspaceId(
    workspaces,
    currentWsId,
    profileQuery.data?.default_workspace_id,
  );
  const currentWs = workspaces.find((w) => w.id === resolvedId);

  useEffect(() => {
    if (wsQuery.isSuccess && profileQuery.isSuccess && resolvedId !== currentWsId) {
      setCurrentWsId(resolvedId);
    }
  }, [wsQuery.isSuccess, profileQuery.isSuccess, resolvedId, currentWsId, setCurrentWsId]);

  useEffect(() => {
    if (
      !wsQuery.isSuccess ||
      !profileQuery.isSuccess ||
      workspaces.length !== 0 ||
      !auth.user ||
      attemptedUser.current === auth.user.id
    ) {
      return;
    }
    const userId = auth.user.id;
    attemptedUser.current = userId;
    const metadataName = String(auth.user.user_metadata?.full_name ?? "")
      .trim()
      .slice(0, 80);
    const name = metadataName.length >= 2 ? metadataName : t("workspace.mine");
    createWs({ data: { name } })
      .then(async (ws) => {
        // Publish membership and the shared selection together. Descendant queries
        // mount only after both agree, including in a completely new browser.
        qc.setQueryData(["my-workspaces", userId], [{ ...ws, role: "owner" }]);
        setCurrentWsId(ws.id);
        await qc.invalidateQueries({ queryKey: ["my-profile", userId] });
        toast.success(t("workspace.created"));
      })
      .catch((error) => {
        setBootstrapError(errorMessage(error));
      });
  }, [
    wsQuery.isSuccess,
    wsQuery.dataUpdatedAt,
    profileQuery.isSuccess,
    workspaces.length,
    auth.user,
    createWs,
    qc,
    setCurrentWsId,
    t,
  ]);

  const retryBootstrap = () => {
    attemptedUser.current = null;
    setBootstrapError(null);
    void wsQuery.refetch();
    void profileQuery.refetch();
  };

  const handleSelectWs = async (id: string) => {
    if (!workspaces.some((w) => w.id === id)) return;
    try {
      // Do not switch the UI to a workspace that the server has rejected.
      await setDefaultWs({ data: { workspaceId: id } });
      setCurrentWsId(id);
      await qc.invalidateQueries({ queryKey: ["my-profile", auth.user?.id] });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const handleCreateWs = async (name: string) => {
    const ws = await createWs({ data: { name: name.trim() } });
    await wsQuery.refetch();
    setCurrentWsId(ws.id);
    await qc.invalidateQueries({ queryKey: ["my-profile", auth.user?.id] });
    toast.success(t("workspace.created"));
  };

  return {
    auth,
    wsQuery,
    profileQuery,
    workspaces,
    currentWs,
    workspaceError: bootstrapError || wsQuery.error?.message || profileQuery.error?.message,
    isWorkspaceReady:
      wsQuery.isSuccess && profileQuery.isSuccess && !!currentWs && currentWsId === currentWs.id,
    retryBootstrap,
    handleSelectWs,
    handleCreateWs,
  };
}
