import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WorkspaceRole } from "@/lib/workspace/permissions";
import { throwIfError } from "./_supabase";

/** Role checks give an actionable error before RLS can turn a denied write into zero rows. */
export async function requireWorkspaceRole(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
  roles?: readonly WorkspaceRole[],
) {
  const { data: member, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  if (!member || (roles && !roles.includes(member.role))) {
    throw new Error("forbidden: você não tem permissão para esta operação no workspace.");
  }
  return member.role;
}

/** The FK also enforces this in Postgres, including writes outside these handlers. */
export async function assertBrandInWorkspace(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  brandId: string | undefined,
) {
  if (!brandId) return;
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  throwIfError(error);
  if (!brand) throw new Error("Marca não encontrada neste workspace.");
}
