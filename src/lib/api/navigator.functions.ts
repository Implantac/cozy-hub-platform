import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { throwIfError } from "./_supabase";

const profileInput = z.object({
  experience_level: z.enum(["beginner", "intermediate", "advanced"]),
  business_path: z.enum([
    "local_business", "content_creator", "affiliate",
    "digital_services", "saas_builder", "agency", "freelancer", "ecommerce",
  ]).nullable().optional(),
  goals: z.array(z.string().min(1).max(80)).max(12).default([]),
  time_budget_hours_week: z.number().int().min(0).max(168).default(5),
  money_budget_monthly: z.number().min(0).max(1_000_000).default(0),
  preferred_channels: z.array(z.string().min(1).max(40)).max(20).default([]),
  content_preferences: z.array(z.string().min(1).max(40)).max(20).default([]),
});

function deriveMaturity(input: z.infer<typeof profileInput>): "seed"|"sprout"|"growth"|"established"|"scaling" {
  if (input.experience_level === "advanced" && input.money_budget_monthly > 1000) return "scaling";
  if (input.experience_level === "advanced") return "established";
  if (input.experience_level === "intermediate") return "growth";
  if (input.goals.length >= 2) return "sprout";
  return "seed";
}

function deriveActions(input: z.infer<typeof profileInput>) {
  const a: Array<{ title: string; cta?: string; href?: string }> = [];
  if (!input.preferred_channels.length) {
    a.push({ title: "Conectar seu primeiro canal", href: "/app/channels" });
  } else {
    a.push({ title: "Configurar canais selecionados", href: "/app/channels" });
  }
  a.push({ title: "Criar sua marca digital", href: "/app/brands" });
  a.push({ title: "Publicar seu primeiro conteúdo", href: "/app/content" });
  if (input.experience_level === "beginner") {
    a.push({ title: "Iniciar trilha 'Começar a Criar Conteúdo'", href: "/app/learning" });
  }
  return a;
}

export const getDigitalProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_profile_digital").select("*").eq("user_id", userId).maybeSingle();
    throwIfError(error);
    return data;
  });

export const saveDigitalProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const maturity = deriveMaturity(data);
    const actions = deriveActions(data);
    const payload = {
      user_id: userId,
      experience_level: data.experience_level,
      business_path: data.business_path ?? null,
      goals: data.goals,
      time_budget_hours_week: data.time_budget_hours_week,
      money_budget_monthly: data.money_budget_monthly,
      preferred_channels: data.preferred_channels,
      content_preferences: data.content_preferences,
      maturity_level: maturity,
      recommended_actions: actions,
      completed_at: new Date().toISOString(),
    };
    const { data: row, error } = await supabase
      .from("user_profile_digital").upsert(payload, { onConflict: "user_id" }).select().single();
    throwIfError(error);
    await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
    return row;
  });
