import type { Database } from "@/integrations/supabase/types";

export type WorkspaceRole = Database["public"]["Enums"]["app_role"];
export const WORKSPACE_EDIT_ROLES = ["owner", "admin", "editor"] as const;
export const WORKSPACE_MANAGE_ROLES = ["owner", "admin"] as const;

/** Unknown, loading and removed memberships fail closed. UI is not the boundary. */
export function workspacePermissions(role: string | null | undefined) {
  return {
    canEdit: WORKSPACE_EDIT_ROLES.some((allowed) => allowed === role),
    canManage: WORKSPACE_MANAGE_ROLES.some((allowed) => allowed === role),
  };
}
