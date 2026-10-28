/**
 * VELT — Bio page management (authenticated).
 *
 * Every mutation here is workspace-scoped and RLS-backed. Two rules are enforced
 * server-side even though the UI already validates them, because the UI is not a
 * security boundary:
 *   - slug must pass `validateSlug` (no reserved words, no numeric-only)
 *   - link destinations must pass `validateLinkUrl` (no javascript:, no
 *     credentials-in-URL, no protocol-relative)
 */
import { createServerFn } from "@tanstack/react-start";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError, unwrap } from "./_supabase";
import { buildHref, checkContentSafety, validateSlug, type LinkKind } from "@/lib/bio/validate";

const SlugInput = z.string().min(3).max(40);
const KindInput = z.enum(["link", "whatsapp", "email", "phone", "product"]);

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export const getBioPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: page, error } = await supabase
      .from("bio_pages")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    throwIfError(error);

    if (!page) return { page: null, links: [], slugAvailable: true };

    const { data: links, error: lErr } = await supabase
      .from("bio_links")
      .select("*")
      .eq("page_id", page.id)
      .order("position", { ascending: true });
    throwIfError(lErr);

    return { page, links: links ?? [], slugAvailable: true };
  });

/** Checks slug availability before the user commits to a name. */
export const checkSlugAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: SlugInput }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const validation = validateSlug(data.slug);
    if (!validation.ok) return { available: false, slug: validation.slug, error: validation.error };

    const { data: existing, error } = await supabase
      .from("bio_pages")
      .select("workspace_id")
      .eq("slug", validation.slug)
      .maybeSingle();
    throwIfError(error);

    // The unique index is authoritative; this is a courtesy check. A null result
    // from an RLS-scoped read can also mean "taken by someone else", which the
    // insert will then reject — handled as a 23505 in the create handler.
    if (existing) {
      return { available: false, slug: validation.slug, error: "Este link já está em uso." };
    }
    return { available: true, slug: validation.slug };
  });

/* ------------------------------------------------------------------ */
/* Create / update                                                     */
/* ------------------------------------------------------------------ */

export const upsertBioPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        slug: SlugInput,
        headline: z.string().max(80).nullish(),
        bio: z.string().max(500).nullish(),
        avatarUrl: z.string().url().max(500).nullish(),
        theme: z.enum(["aurora", "minimal", "sunset"]).default("aurora"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const slugValidation = validateSlug(data.slug);
    if (!slugValidation.ok) throw new Error(slugValidation.error);

    const safety = checkContentSafety({ headline: data.headline, bio: data.bio });
    if (!safety.ok) {
      throw new Error(
        `Conteúdo bloqueado: ${safety.flags[0].reason}. Reescreva antes de publicar.`,
      );
    }

    const payload = {
      workspace_id: data.workspaceId,
      slug: slugValidation.slug,
      headline: data.headline ?? null,
      bio: data.bio ?? null,
      avatar_url: data.avatarUrl ?? null,
      theme: data.theme,
    };

    // Upsert on workspace_id: one page per workspace. A slug collision with
    // ANOTHER workspace surfaces as a unique-violation and is translated into a
    // message the user can act on.
    const { data: row, error } = await supabase
      .from("bio_pages")
      .upsert(payload, { onConflict: "workspace_id" })
      .select()
      .single();

    if (error) {
      if (error.code === "23505" || /duplicate key/i.test(error.message)) {
        throw new Error("Este link já está em uso por outra conta. Escolha outro.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const setBioPagePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ workspaceId: z.string().uuid(), published: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    if (data.published) {
      // Publishing is the moment content becomes anonymous — re-run safety here,
      // not only at save time, so content written before a rule was added is
      // still checked.
      const { data: page } = await supabase
        .from("bio_pages")
        .select("headline, bio, slug")
        .eq("workspace_id", data.workspaceId)
        .maybeSingle();
      if (!page) throw new Error("Crie a página antes de publicar.");

      const safety = checkContentSafety({ headline: page.headline, bio: page.bio });
      if (!safety.ok) {
        throw new Error(`Publicação bloqueada: ${safety.flags[0].reason}.`);
      }
    }

    const { data: row, error } = await supabase
      .from("bio_pages")
      .update({ is_published: data.published })
      .eq("workspace_id", data.workspaceId)
      .select()
      .single();
    throwIfError(error);
    return row;
  });

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export const addBioLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        label: z.string().min(1).max(60),
        kind: KindInput.default("link"),
        raw: z.string().min(1).max(2000),
        message: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: page, error: pErr } = await supabase
      .from("bio_pages")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    throwIfError(pErr);
    if (!page) throw new Error("Crie a página antes de adicionar links.");

    const href = buildHref(data.kind as LinkKind, data.raw, { message: data.message });
    if (!href.ok) throw new Error(href.error);

    const safety = checkContentSafety({ label: data.label });
    if (!safety.ok) throw new Error(`Rótulo bloqueado: ${safety.flags[0].reason}.`);

    // Position = end of the list. Reading max+1 in SQL avoids a race that would
    // give two links the same position and an unstable order.
    const { data: last } = await supabase
      .from("bio_links")
      .select("position")
      .eq("page_id", page.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = unwrap(
      await supabase
        .from("bio_links")
        .insert({
          page_id: page.id,
          label: data.label,
          url: href.href,
          kind: data.kind,
          position: (last?.position ?? -1) + 1,
        })
        .select()
        .single(),
    );
    return row;
  });

export const updateBioLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        label: z.string().min(1).max(60).optional(),
        raw: z.string().min(1).max(2000).optional(),
        kind: KindInput.optional(),
        isActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Ownership check through the join, since bio_links has no workspace_id.
    const { data: owned, error } = await supabase
      .from("bio_links")
      .select("id, kind, page_id, bio_pages!inner(workspace_id)")
      .eq("id", data.id)
      .eq("bio_pages.workspace_id", data.workspaceId)
      .maybeSingle();
    throwIfError(error);
    if (!owned) throw new Error("Link não encontrado neste workspace.");

    // Typed against the generated Row so a mistyped column fails here, at
    // compile time, instead of silently at runtime inside PostgREST.
    const patch: Partial<Database["public"]["Tables"]["bio_links"]["Update"]> = {};
    if (data.label !== undefined) {
      const safety = checkContentSafety({ label: data.label });
      if (!safety.ok) throw new Error(`Rótulo bloqueado: ${safety.flags[0].reason}.`);
      patch.label = data.label;
    }
    if (data.raw !== undefined) {
      const href = buildHref((data.kind ?? owned.kind) as LinkKind, data.raw);
      if (!href.ok) throw new Error(href.error);
      patch.url = href.href;
    }
    if (data.kind !== undefined) patch.kind = data.kind;
    if (data.isActive !== undefined) patch.is_active = data.isActive;

    if (Object.keys(patch).length === 0) return { ok: true };

    const { error: upErr } = await supabase.from("bio_links").update(patch).eq("id", data.id);
    throwIfError(upErr);
    return { ok: true };
  });

export const deleteBioLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ workspaceId: z.string().uuid(), id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: owned } = await supabase
      .from("bio_links")
      .select("id, bio_pages!inner(workspace_id)")
      .eq("id", data.id)
      .eq("bio_pages.workspace_id", data.workspaceId)
      .maybeSingle();
    if (!owned) throw new Error("Link não encontrado neste workspace.");

    const { error } = await supabase.from("bio_links").delete().eq("id", data.id);
    throwIfError(error);
    return { ok: true };
  });

/** Reorders links. Receives the full ordered id list to stay idempotent. */
export const reorderBioLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        orderedIds: z.array(z.string().uuid()).min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: page } = await supabase
      .from("bio_pages")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!page) throw new Error("Página não encontrada.");

    // Sequential updates: the list is tiny and correctness beats throughput.
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabase
        .from("bio_links")
        .update({ position: i })
        .eq("id", data.orderedIds[i])
        .eq("page_id", page.id);
      if (error) throw new Error(`Falha ao reordenar: ${error.message}`);
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export const getBioPageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ workspaceId: z.string().uuid(), days: z.number().int().min(1).max(90).default(30) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: page } = await supabase
      .from("bio_pages")
      .select("id, view_count, is_published, slug")
      .eq("workspace_id", data.workspaceId)
      .maybeSingle();
    if (!page) return { page: null, clicksByDay: [], clicksByLink: [], deviceSplit: [] };

    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const { data: clicks, error } = await supabase
      .from("bio_link_clicks")
      .select("link_id, clicked_at, device")
      .eq("page_id", page.id)
      .gte("clicked_at", since);
    throwIfError(error);

    const { data: links } = await supabase
      .from("bio_links")
      .select("id, label, click_count")
      .eq("page_id", page.id);
    throwIfError(error);

    const byDay = new Map<string, number>();
    const byDevice = new Map<string, number>();
    for (const c of clicks ?? []) {
      const day = String(c.clicked_at).slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const device = c.device ?? "other";
      byDevice.set(device, (byDevice.get(device) ?? 0) + 1);
    }

    return {
      page,
      clicksByDay: Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
      clicksByLink: (links ?? []).sort((a, b) => b.click_count - a.click_count),
      deviceSplit: Array.from(byDevice.entries()).map(([device, count]) => ({ device, count })),
    };
  });
