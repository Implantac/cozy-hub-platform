import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useAuth } from "@/lib/auth/use-auth";

export function useWorkspaceBootstrap() {
  const auth = useAuth();
  const { t } = useTranslation();

  const fetchWs = useServerFn(listMyWorkspaces);
  const fetchProfile = useServerFn(getMyProfile);
  const createWs = useServerFn(createWorkspace);
  const setDefaultWs = useServerFn(setDefaultWorkspace);

  const wsQuery = useQuery({
    queryKey: ["my-workspaces"],
    queryFn: () => fetchWs(),
    enabled: !!auth.user,
  });
  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!auth.user,
  });

  const [currentWsId, setCurrentWsId] = useCurrentWorkspaceId(
    profileQuery.data?.default_workspace_id ?? null,
  );
  const workspaces = wsQuery.data ?? [];
  const currentWs = workspaces.find((w) => w.id === currentWsId) ?? workspaces[0];

  useEffect(() => {
    if (!currentWsId && currentWs?.id) setCurrentWsId(currentWs.id);
  }, [currentWsId, currentWs?.id, setCurrentWsId]);

  const bootstrappingRef = useRef(false);
  useEffect(() => {
    if (!wsQuery.isSuccess || workspaces.length !== 0 || !auth.user || bootstrappingRef.current)
      return;
    bootstrappingRef.current = true;
    const name = (auth.user.user_metadata?.full_name as string) ?? t("workspace.mine");
    createWs({ data: { name: `${name}` } })
      .then((ws) => {
        setCurrentWsId(ws.id);
        wsQuery.refetch();
        toast.success(t("workspace.created"));
      })
      .catch((e) => {
        bootstrappingRef.current = false;
        toast.error(e.message);
      });
  }, [wsQuery.isSuccess, workspaces.length, auth.user, createWs, setCurrentWsId, wsQuery, t]);

  const handleSelectWs = async (id: string) => {
    setCurrentWsId(id);
    await setDefaultWs({ data: { workspaceId: id } });
  };
  const handleCreateWs = async (name: string) => {
    const ws = await createWs({ data: { name } });
    setCurrentWsId(ws.id);
    await wsQuery.refetch();
    toast.success(t("workspace.created"));
  };

  return {
    auth,
    wsQuery,
    profileQuery,
    workspaces,
    currentWs,
    handleSelectWs,
    handleCreateWs,
  };
}
