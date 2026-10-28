import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { PageTransition, fadeUp } from "@/components/app/Motion";
import { NavigatorService } from "@/lib/services";
import { toast } from "sonner";
import { NavigatorHeader } from "@/features/navigator/components/atoms";
import { ProfileSummary } from "@/features/navigator/components/ProfileSummary";
import { DiagnosticSteps } from "@/features/navigator/components/DiagnosticSteps";
import type { NavigatorForm } from "@/features/navigator/constants";

export const Route = createFileRoute("/_authenticated/app/navigator")({
  component: NavigatorPage,
});

function NavigatorPage() {
  const getProfile = useServerFn(NavigatorService.getDigitalProfile);
  const saveProfile = useServerFn(NavigatorService.saveDigitalProfile);
  const q = useQuery({ queryKey: ["digital-profile"], queryFn: () => getProfile() });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<NavigatorForm>({
    experience_level: "beginner",
    business_path: null,
    goals: [],
    time_budget_hours_week: 5,
    money_budget_monthly: 0,
    preferred_channels: [],
    content_preferences: [],
  });

  const mut = useMutation({
    mutationFn: () => saveProfile({ data: form }),
    onSuccess: () => {
      toast.success("Plano gerado!");
      q.refetch();
      setStep(6);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: "goals" | "preferred_channels" | "content_preferences", v: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }));

  if (q.data && step === 0) {
    return (
      <PageTransition>
        <ProfileSummary profile={q.data} onRetake={() => setStep(1)} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-8">
        <NavigatorHeader />
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition ${n <= step ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>

        <motion.div
          key={step}
          variants={fadeUp}
          initial="initial"
          animate="animate"
          className="section-card p-8"
        >
          <DiagnosticSteps step={step} form={form} setForm={setForm} toggle={toggle} />
        </motion.div>

        {step >= 1 && step <= 5 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30"
            >
              ← Voltar
            </button>
            {step < 5 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated"
              >
                Continuar →
              </button>
            ) : (
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60"
              >
                {mut.isPending ? "Gerando plano..." : "Gerar meu plano"}
              </button>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
