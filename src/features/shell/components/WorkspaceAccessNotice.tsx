import { useTranslation } from "react-i18next";
import type { useWorkspaceAccess } from "@/lib/workspace/use-workspace-access";
import { QueryErrorState } from "./QueryErrorState";

export function WorkspaceAccessNotice({
  access,
  manage = false,
}: {
  access: ReturnType<typeof useWorkspaceAccess>;
  manage?: boolean;
}) {
  const { t } = useTranslation();
  if (access.isError) return <QueryErrorState onRetry={access.retry} pending={access.isFetching} />;
  if (manage ? access.canManage : access.canEdit) return null;
  return (
    <p
      role="status"
      className="rounded-lg border border-border bg-secondary/30 p-3 text-sm text-muted-foreground"
    >
      {t(access.isPending ? "access.checking" : manage ? "access.manageOnly" : "access.readOnly")}
    </p>
  );
}
