import { mediaUrlsSchema } from "@/lib/content/media";
import { manualContentStatusSchema } from "@/lib/content/status";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { confirmMutationRows, throwIfError, unwrap } from "./_supabase";
import { assertBrandInWorkspace, requireWorkspaceRole } from "./_workspace";
import { WORKSPACE_EDIT_ROLES } from "@/lib/workspace/permissions";

const ContentType = z.enum(["post", "reel", "story", "short", "video", "article", "carousel"]);
const ContentStatus = z.enum([
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "archived",
]);

export const listContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        status: ContentStatus.optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("content")
      .select("*, brand:brands(name)")
      .eq("workspace_id", data.workspaceId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q
      .order("created_at", { ascending: false })
      .limit(data.limit);
    throwIfError(error);
    return rows ?? [];
  });

export const createContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        brandId: z.string().uuid().optional(),
        type: ContentType.default("post"),
        title: z.string().trim().min(1).max(200).optional(),
        body: z.string().max(20000).optional(),
        mediaUrls: mediaUrlsSchema.optional(),
      })
      .refine((value) => Boolean(value.title || value.body?.trim()), {
        message: "Informe um título ou texto para o rascunho.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_EDIT_ROLES);
    await assertBrandInWorkspace(supabase, data.workspaceId, data.brandId);
    const row = unwrap(
      await supabase
        .from("content")
        .insert({
          workspace_id: data.workspaceId,
          brand_id: data.brandId ?? null,
          type: data.type,
          title: data.title ?? null,
          body: data.body ?? null,
          media: data.mediaUrls ?? [],
          status: "draft",
          created_by: userId,
        })
        .select()
        .single(),
    );
    await supabase.from("domain_events").insert({
      workspace_id: data.workspaceId,
      event_type: "ContentCreated",
      payload: { content_id: row.id, type: row.type },
    });
    return row;
  });

export const updateContentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        status: manualContentStatusSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_EDIT_ROLES);
    const { data: row, error } = await supabase
      .from("content")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId)
      .select("id")
      .maybeSingle();
    throwIfError(error);
    if (!row)
      throw new Error("Conteúdo não encontrado neste workspace ou alteração não permitida.");
    return { ok: true, id: row.id };
  });

/** Bulk update content status — used by the multi-select actions UI. */
export const bulkUpdateContentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        ids: z
          .array(z.string().uuid())
          .min(1)
          .max(200)
          .transform((ids) => [...new Set(ids)]),
        status: manualContentStatusSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_EDIT_ROLES);
    const result = await supabase
      .from("content")
      .update({ status: data.status })
      .in("id", data.ids)
      .eq("workspace_id", data.workspaceId)
      .select("id");
    return confirmMutationRows(result, data.ids);
  });

/** Bulk delete content. */
export const bulkDeleteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        ids: z
          .array(z.string().uuid())
          .min(1)
          .max(200)
          .transform((ids) => [...new Set(ids)]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_EDIT_ROLES);
    const result = await supabase
      .from("content")
      .delete()
      .in("id", data.ids)
      .eq("workspace_id", data.workspaceId)
      .select("id");
    return confirmMutationRows(result, data.ids);
  });

/** Save draft text/media. The database rejects edits while a delivery is active. */
export const updateContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        body: z.string().max(20000),
        mediaUrls: mediaUrlsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireWorkspaceRole(supabase, data.workspaceId, userId, WORKSPACE_EDIT_ROLES);
    const { data: row, error } = await supabase
      .from("content")
      .update({ title: data.title, body: data.body, media: data.mediaUrls })
      .eq("workspace_id", data.workspaceId)
      .eq("id", data.id)
      .select()
      .maybeSingle();
    throwIfError(error);
    if (!row)
      throw new Error("Conteúdo não encontrado neste workspace ou alteração não permitida.");
    return row;
  });
