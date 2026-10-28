import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Building2, Palette, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createBrand } from "@/lib/api/brands.functions";
import { completeOnboarding, updateMyProfile } from "@/lib/api/notifications.functions";
import { toast } from "sonner";

export function OnboardingWizard({
  open,
  onClose,
  workspaceName,
  workspaceId,
  userName,
}: {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  workspaceId: string;
  userName?: string;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(userName ?? "");
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  const updateProfile = useServerFn(updateMyProfile);
  const createBrandFn = useServerFn(createBrand);
  const finishOnboarding = useServerFn(completeOnboarding);

  const steps = [
    {
      icon: Sparkles,
      title: t("onboarding.s1.title", "Bem-vindo ao VELT"),
      desc: t("onboarding.s1.desc", "Seu sistema operacional para crescimento digital."),
    },
    {
      icon: Building2,
      title: t("onboarding.s2.title", "Seu perfil"),
      desc: t("onboarding.s2.desc", "Como devemos te chamar?"),
    },
    {
      icon: Palette,
      title: t("onboarding.s3.title", "Primeira marca"),
      desc: t("onboarding.s3.desc", "Crie sua primeira marca para começar."),
    },
    {
      icon: CheckCircle2,
      title: t("onboarding.s4.title", "Pronto!"),
      desc: t("onboarding.s4.desc", "Tudo configurado. Vamos operar."),
    },
  ];

  const next = async () => {
    setLoading(true);
    try {
      if (step === 1 && displayName.trim()) {
        await updateProfile({ data: { display_name: displayName.trim() } });
      }
      if (step === 2 && brandName.trim()) {
        await createBrandFn({ data: { workspaceId, name: brandName.trim() } });
        qc.invalidateQueries({ queryKey: ["brands"] });
      }
      if (step === steps.length - 1) {
        await finishOnboarding({});
        qc.invalidateQueries({ queryKey: ["my-profile"] });
        toast.success(t("onboarding.done", "Bem-vindo a bordo!"));
        onClose();
        return;
      }
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const skip = async () => {
    await finishOnboarding({});
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    onClose();
  };

  const Current = steps[step];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) skip();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-3 grid size-12 place-items-center rounded-xl bg-gradient-brand shadow-glow">
            <Current.icon className="size-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-2xl">{Current.title}</DialogTitle>
          <DialogDescription>{Current.desc}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 py-2"
          >
            {step === 0 && (
              <div className="rounded-lg border border-border/50 bg-card/50 p-4 text-sm text-muted-foreground">
                <p>
                  {t("onboarding.welcome.line1", "Workspace ativo:")}{" "}
                  <strong className="text-foreground">{workspaceName}</strong>
                </p>
                <p className="mt-2">
                  {t(
                    "onboarding.welcome.line2",
                    "Em 3 passos rápidos você estará operando como um Diretor Digital.",
                  )}
                </p>
              </div>
            )}
            {step === 1 && (
              <div className="space-y-2">
                <Label htmlFor="dn">{t("onboarding.s2.label", "Nome de exibição")}</Label>
                <Input
                  id="dn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Maria Silva"
                />
              </div>
            )}
            {step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="bn">{t("onboarding.s3.label", "Nome da marca")}</Label>
                <Input
                  id="bn"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="Ex: Minha Marca"
                />
              </div>
            )}
            {step === 3 && (
              <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
                <p className="text-success-foreground">
                  {t(
                    "onboarding.s4.body",
                    "Você está pronto para conectar canais, criar conteúdo e deixar o Brain trabalhar pra você.",
                  )}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-8 rounded-full transition ${i <= step ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step < steps.length - 1 && (
              <Button variant="ghost" size="sm" onClick={skip}>
                {t("onboarding.skip", "Pular")}
              </Button>
            )}
            <Button onClick={next} disabled={loading || (step === 2 && !brandName.trim())}>
              {step === steps.length - 1
                ? t("onboarding.finish", "Concluir")
                : t("onboarding.next", "Continuar")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
