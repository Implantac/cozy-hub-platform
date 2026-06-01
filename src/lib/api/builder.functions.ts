/**
 * Builder & Competitor Radar server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";
import { emitMemoryEvent } from "./_memory";

const wsInput = z.object({ workspaceId: z.string().uuid() });

/* ============== Competitors ============== */
const competitorInput = z.object({
  workspaceId: z.string().uuid(),
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  handle: z.string().max(80).optional().nullable(),
  url: z.string().url().max(500).optional().nullable(),
  followers: z.number().int().min(0).max(1_000_000_000).optional(),
  engagement: z.number().min(0).max(100).optional(),
  trend: z.enum(["up", "down", "flat"]).optional(),
  threat: z.enum(["high", "medium", "low"]).optional(),
  positioning: z.string().max(500).optional().nullable(),
  recent_move: z.string().max(500).optional().nullable(),
  gap: z.string().max(500).optional().nullable(),
  tags: z.array(z.string().max(40)).max(20).optional(),
});

export const listCompetitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("competitors")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    throwIfError(error);
    return rows ?? [];
  });

export const upsertCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => competitorInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { workspaceId, id, ...rest } = data;
    const payload = {
      ...rest,
      followers: rest.followers ?? 0,
      engagement: rest.engagement ?? 0,
      trend: rest.trend ?? "flat",
      threat: rest.threat ?? "medium",
      tags: rest.tags ?? [],
    };
    if (id) {
      const { data: row, error } = await supabase
        .from("competitors")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
      throwIfError(error);
      if (payload.threat === "high") {
        await emitMemoryEvent(supabase, {
          workspaceId, userId,
          kind: "signal",
          subject: `Concorrente "${rest.name}" marcado como alta ameaça`,
          payload: { competitorId: id, trend: payload.trend, gap: rest.gap ?? null },
          sentiment: "negative",
        });
      }
      return row;
    }
    const { data: row, error } = await supabase
      .from("competitors")
      .insert({ workspace_id: workspaceId, created_by: userId, ...payload })
      .select()
      .single();
    throwIfError(error);
    await emitMemoryEvent(supabase, {
      workspaceId, userId,
      kind: "signal",
      subject: `Novo concorrente no radar: ${rest.name}`,
      payload: { threat: payload.threat, trend: payload.trend, handle: rest.handle ?? null },
      sentiment: payload.threat === "high" ? "negative" : "neutral",
    });
    return row;
  });

export const deleteCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ workspaceId: z.string().uuid(), id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("competitors")
      .delete()
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    throwIfError(error);
    return { ok: true };
  });

/* ============== Business Blueprint (10 blocks) ============== */
const BLOCK_FIELDS = [
  "problem", "audience", "promise", "differentiator",
  "offer", "price", "channels", "content_pillars", "funnel", "metric",
] as const;
type BlockField = (typeof BLOCK_FIELDS)[number];

const blueprintInput = z.object({
  workspaceId: z.string().uuid(),
  field: z.enum(BLOCK_FIELDS),
  value: z.string().max(2000),
});

export const getBlueprint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("business_blueprints")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    throwIfError(error);
    return row;
  });

export const updateBlueprintBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => blueprintInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { workspaceId, field, value } = data;
    const { data: existing } = await supabase
      .from("business_blueprints")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (existing) {
      const patch = {
        [field]: value,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      };
      const { data: row, error } = await supabase
        .from("business_blueprints")
        .update(patch as never)
        .eq("id", existing.id)
        .select()
        .single();
      throwIfError(error);
      await emitMemoryEvent(supabase, {
        workspaceId, userId,
        kind: "decision",
        subject: `Blueprint atualizado: ${field}`,
        payload: { field, preview: value.slice(0, 160) },
        sentiment: "positive",
      });
      return row;
    }
    const insertRow = {
      workspace_id: workspaceId,
      updated_by: userId,
      [field]: value,
    };
    const { data: row, error } = await supabase
      .from("business_blueprints")
      .insert(insertRow as never)
      .select()
      .single();
    throwIfError(error);
    await emitMemoryEvent(supabase, {
      workspaceId, userId,
      kind: "decision",
      subject: `Blueprint iniciado pelo bloco: ${field}`,
      payload: { field, preview: value.slice(0, 160) },
      sentiment: "positive",
    });
    return row;
  });
