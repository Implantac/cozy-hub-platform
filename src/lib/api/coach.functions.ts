import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

const wsInput = z.object({ workspaceId: z.string().uuid() });

export const listRecommendations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("coach_recommendations")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .is("dismissed_at", null)
      .is("completed_at", null)
      .order("severity", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    throwIfError(error);
    return rows ?? [];
  });

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => wsInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const ws = data.workspaceId;
    const [channels, content, brands] = await Promise.all([
      supabase.from("channels").select("id, status, platform").eq("workspace_id", ws),
      supabase.from("content").select("id, created_at, status").eq("workspace_id", ws),
      supabase.from("brands").select("id, voice, palette, logo_url").eq("workspace_id", ws),
    ]);

    const recs: Array<{
      kind: "insight" | "warning" | "suggestion" | "next_action";
      severity: "info" | "low" | "medium" | "high" | "critical";
      title: string;
      body?: string;
      cta?: any;
      score?: number;
    }> = [];

    const channelRows = channels.data ?? [];
    const contentRows = content.data ?? [];
    const brandRows = brands.data ?? [];

    if (brandRows.length === 0) {
      recs.push({
        kind: "next_action",
        severity: "high",
        title: "Crie sua primeira marca digital",
        body: "Defina voz, paleta e logo para personalizar todo o conteúdo gerado.",
        cta: { label: "Criar marca", href: "/app/brands" },
        score: 95,
      });
    }
    if (channelRows.length < 2) {
      recs.push({
        kind: "next_action",
        severity: "high",
        title: "Conecte mais canais",
        body: "Negócios com 2+ canais crescem 3x mais rápido.",
        cta: { label: "Adicionar canal", href: "/app/channels" },
        score: 90,
      });
    }
    const disconnected = channelRows.filter((c: any) => c.status !== "connected").length;
    if (disconnected > 0) {
      recs.push({
        kind: "warning",
        severity: "medium",
        title: `${disconnected} canal(is) desconectado(s)`,
        body: "Reconecte para publicar automaticamente.",
        cta: { label: "Revisar canais", href: "/app/channels" },
        score: 80,
      });
    }
    const cutoff = Date.now() - 7 * 86400_000;
    const recent = contentRows.filter((c: any) => new Date(c.created_at).getTime() > cutoff).length;
    if (recent === 0 && contentRows.length > 0) {
      recs.push({
        kind: "warning",
        severity: "high",
        title: "Você não publica há mais de 7 dias",
        body: "Consistência é o maior fator de crescimento.",
        cta: { label: "Criar conteúdo", href: "/app/content" },
        score: 92,
      });
    }
    if (contentRows.length < 5) {
      recs.push({
        kind: "suggestion",
        severity: "medium",
        title: "Publique 5 conteúdos iniciais",
        body: "Volume inicial é essencial para o algoritmo aprender seu nicho.",
        cta: { label: "Novo conteúdo", href: "/app/content" },
        score: 70,
      });
    }
    if (brandRows.length > 0 && !brandRows.some((b: any) => b.logo_url)) {
      recs.push({
        kind: "suggestion",
        severity: "low",
        title: "Adicione logo à sua marca",
        body: "Marcas com logo recebem 60% mais reconhecimento.",
        cta: { label: "Editar marca", href: "/app/brands" },
        score: 50,
      });
    }

    if (recs.length === 0) {
      recs.push({
        kind: "insight",
        severity: "info",
        title: "Tudo em ordem por aqui",
        body: "Continue publicando consistentemente e monitore o Digital Score semanalmente.",
        score: 30,
      });
    }

    // Replace previous open recs to avoid duplicates
    await supabase
      .from("coach_recommendations")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("workspace_id", ws)
      .is("dismissed_at", null)
      .is("completed_at", null);

    const { data: rows, error } = await supabase
      .from("coach_recommendations")
      .insert(recs.map((r) => ({ ...r, workspace_id: ws })))
      .select();
    throwIfError(error);
    return { generated: rows?.length ?? 0, recommendations: rows ?? [] };
  });

export const updateRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        id: z.string().uuid(),
        action: z.enum(["dismiss", "complete"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Defence-in-depth: assert caller is a member of the workspace
    // owning this recommendation before mutating it.
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    throwIfError(memberError);
    if (!member) throw new Error("forbidden: not a workspace member");

    const patch =
      data.action === "dismiss"
        ? { dismissed_at: new Date().toISOString() }
        : { completed_at: new Date().toISOString() };
    const { error } = await supabase
      .from("coach_recommendations")
      .update(patch)
      .eq("id", data.id)
      .eq("workspace_id", data.workspaceId);
    throwIfError(error);
    return { ok: true };
  });
