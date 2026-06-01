import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ContentType = z.enum(["post", "reel", "story", "short", "video", "article", "carousel"]);

export const listContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      status: z.enum(["draft", "scheduled", "publishing", "published", "failed", "archived"]).optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("content").select("*, brand:brands(name)").eq("workspace_id", data.workspaceId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      brandId: z.string().uuid().optional(),
      type: ContentType.default("post"),
      title: z.string().min(1).max(200).optional(),
      body: z.string().max(20000).optional(),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase.from("content").insert({
      workspace_id: data.workspaceId,
      brand_id: data.brandId ?? null,
      type: data.type,
      title: data.title ?? null,
      body: data.body ?? null,
      status: "draft",
      created_by: userId,
    }).select().single();
    if (error) throw new Error(error.message);
    await supabase.from("domain_events").insert({
      workspace_id: data.workspaceId, event_type: "ContentCreated",
      payload: { content_id: row.id, type: row.type },
    });
    return row;
  });

export const updateContentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: z.string().uuid(),
      id: z.string().uuid(),
      status: z.enum(["draft", "scheduled", "published", "archived"]),
    }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("content")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
