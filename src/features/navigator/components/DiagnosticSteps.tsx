import { Clock, DollarSign, Check } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { BUSINESS_PATHS, CHANNELS, CONTENT_TYPES, GOALS, type NavigatorForm } from "../constants";
import { ChoiceCard, Chip, Title } from "./atoms";

type Props = {
  step: number;
  form: NavigatorForm;
  setForm: React.Dispatch<React.SetStateAction<NavigatorForm>>;
  toggle: (key: "goals" | "preferred_channels" | "content_preferences", v: string) => void;
};

export function DiagnosticSteps({ step, form, setForm, toggle }: Props) {
  const navigate = useNavigate();

  return (
    <>
      {step <= 1 && (
        <>
          <Title>Qual seu nível de experiência?</Title>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["beginner", "intermediate", "advanced"] as const).map((l) => (
              <ChoiceCard
                key={l}
                active={form.experience_level === l}
                onClick={() => setForm((f) => ({ ...f, experience_level: l }))}
                label={
                  l === "beginner"
                    ? "Iniciante"
                    : l === "intermediate"
                      ? "Intermediário"
                      : "Avançado"
                }
                desc={
                  l === "beginner"
                    ? "Começando agora"
                    : l === "intermediate"
                      ? "Já tenho presença"
                      : "Operação madura"
                }
              />
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <Title>Que tipo de negócio você opera?</Title>
          <div className="grid gap-3 sm:grid-cols-2">
            {BUSINESS_PATHS.map((b) => (
              <ChoiceCard
                key={b.id}
                active={form.business_path === b.id}
                onClick={() => setForm((f) => ({ ...f, business_path: b.id }))}
                label={b.label}
                desc={b.desc}
              />
            ))}
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <Title>
            Quais são seus objetivos?{" "}
            <span className="text-xs font-normal text-muted-foreground">(selecione vários)</span>
          </Title>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip key={g} active={form.goals.includes(g)} onClick={() => toggle("goals", g)}>
                {g}
              </Chip>
            ))}
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <Title>Tempo e orçamento disponíveis</Title>
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-accent" /> Horas / semana
                </span>
                <span className="font-mono text-primary">{form.time_budget_hours_week}h</span>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={form.time_budget_hours_week}
                onChange={(e) =>
                  setForm((f) => ({ ...f, time_budget_hours_week: Number(e.target.value) }))
                }
                className="w-full accent-primary"
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <DollarSign className="size-4 text-accent" /> Orçamento mensal (R$)
                </span>
                <span className="font-mono text-primary">R$ {form.money_budget_monthly}</span>
              </div>
              <input
                type="range"
                min={0}
                max={10000}
                step={100}
                value={form.money_budget_monthly}
                onChange={(e) =>
                  setForm((f) => ({ ...f, money_budget_monthly: Number(e.target.value) }))
                }
                className="w-full accent-primary"
              />
            </div>
          </div>
        </>
      )}
      {step === 5 && (
        <>
          <Title>Canais e formatos preferidos</Title>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Canais
              </div>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <Chip
                    key={c}
                    active={form.preferred_channels.includes(c)}
                    onClick={() => toggle("preferred_channels", c)}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
                Formatos de conteúdo
              </div>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPES.map((c) => (
                  <Chip
                    key={c}
                    active={form.content_preferences.includes(c)}
                    onClick={() => toggle("content_preferences", c)}
                  >
                    {c}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {step === 6 && (
        <div className="text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
            <Check className="size-8 text-primary-foreground" />
          </div>
          <Title>Seu plano está pronto!</Title>
          <p className="mb-6 text-sm text-muted-foreground">
            Acesse o Dashboard para ver suas próximas ações e começar a operar.
          </p>
          <button
            onClick={() => navigate({ to: "/app" })}
            className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated"
          >
            Ir para o Dashboard
          </button>
        </div>
      )}
    </>
  );
}
