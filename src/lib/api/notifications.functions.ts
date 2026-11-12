import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { profileUpdateSchema } from "@/lib/profile/profile";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertMember(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("forbidden");
  return data.role as string;
}

export const listRecentEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({ workspaceId: z.string().uuid(), limit: z.number().min(1).max(100).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertMember(supabase, data.workspaceId, userId);
    const { data: rows, error } = await supabase
      .from("domain_events")
      .select("id, event_type, payload, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 30);
    throwIfError(error);
    return rows ?? [];
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId)
      .select("*")
      .single();
    throwIfError(error);
    // A request which changed no visible row must not be presented as "saved".
    if (!profile) throw new Error("Profile update was not confirmed");
    return { ok: true, profile };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", userId);
    throwIfError(error);
    return { ok: true };
  });
