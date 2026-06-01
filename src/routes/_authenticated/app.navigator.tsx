import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, ChevronRight, Sparkles, Clock, DollarSign, Check } from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { NavigatorService } from "@/lib/services";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/navigator")({
  component: NavigatorPage,
});

const BUSINESS_PATHS = [
  { id: "local_business", label: "Negócio Local", desc: "Loja, restaurante, serviço presencial" },
  { id: "content_creator", label: "Criador de Conteúdo", desc: "Audiência + monetização" },
  { id: "affiliate", label: "Afiliado", desc: "Vender produtos de terceiros" },
  { id: "digital_services", label: "Serviços Digitais", desc: "Consultoria, design, dev" },
  { id: "saas_builder", label: "SaaS / Produto", desc: "Software com receita recorrente" },
  { id: "agency", label: "Agência", desc: "Serviços para outras empresas" },
  { id: "freelancer", label: "Freelancer", desc: "Projetos sob demanda" },
  { id: "ecommerce", label: "E-commerce", desc: "Loja online de produtos físicos" },
] as const;

const GOALS = [
  "Primeiros clientes", "Construir audiência", "Lançar produto",
  "Aumentar vendas", "Crescer presença", "Automatizar processos",
  "Validar ideia", "Reduzir custos",
];

const CHANNELS = [
  "Instagram", "Facebook", "TikTok", "YouTube", "LinkedIn",
  "WhatsApp", "Google Business", "X / Twitter", "Email",
];

const CONTENT_TYPES = ["Posts", "Reels", "Vídeos longos", "Carrosséis", "Stories", "Lives", "Newsletter"];

function NavigatorPage() {
  const navigate = useNavigate();
  const getProfile = useServerFn(NavigatorService.getDigitalProfile);
  const saveProfile = useServerFn(NavigatorService.saveDigitalProfile);
  const q = useQuery({ queryKey: ["digital-profile"], queryFn: () => getProfile() });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    experience_level: "beginner" as "beginner"|"intermediate"|"advanced",
    business_path: null as null | typeof BUSINESS_PATHS[number]["id"],
    goals: [] as string[],
    time_budget_hours_week: 5,
    money_budget_monthly: 0,
    preferred_channels: [] as string[],
    content_preferences: [] as string[],
  });

  const mut = useMutation({
    mutationFn: () => saveProfile({ data: form }),
    onSuccess: () => { toast.success("Plano gerado!"); q.refetch(); setStep(6); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: "goals"|"preferred_channels"|"content_preferences", v: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v] }));

  // Already has profile: show summary
  if (q.data && step === 0) {
    const p = q.data;
    return (
      <PageTransition>
        <div className="space-y-6">
          <Header />
          <motion.div variants={stagger} initial="initial" animate="animate" className="grid gap-4 md:grid-cols-3">
            <Stat label="Nível" value={p.experience_level === "beginner" ? "Iniciante" : p.experience_level === "intermediate" ? "Intermediário" : "Avançado"} />
            <Stat label="Caminho" value={BUSINESS_PATHS.find(b => b.id === p.business_path)?.label ?? "—"} />
            <Stat label="Maturidade" value={String(p.maturity_level).toUpperCase()} />
          </motion.div>

          <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" /> Suas próximas ações
            </div>
            <ul className="space-y-2">
              {(p.recommended_actions as Array<{title:string;href?:string}> | null ?? []).map((a, i) => (
                <li key={i} className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-4 transition hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <div className="grid size-8 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">{i+1}</div>
                    <span className="text-sm font-medium">{a.title}</span>
                  </div>
                  {a.href && (
                    <button onClick={() => navigate({ to: a.href! })}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90">
                      Ir <ChevronRight className="size-3" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <button onClick={() => setStep(1)} className="text-sm text-primary hover:underline">Refazer diagnóstico →</button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-8">
        <Header />
        <div className="flex items-center gap-1.5">
          {[1,2,3,4,5,6].map(n => (
            <div key={n} className={`h-1 flex-1 rounded-full transition ${n <= step ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>

        <motion.div key={step} variants={fadeUp} initial="initial" animate="animate"
          className="rounded-2xl border border-border bg-card/60 p-8 backdrop-blur">
          {step <= 1 && (
            <>
              <Title>Qual seu nível de experiência?</Title>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["beginner","intermediate","advanced"] as const).map(l => (
                  <ChoiceCard key={l} active={form.experience_level === l}
                    onClick={() => setForm(f => ({...f, experience_level: l}))}
                    label={l === "beginner" ? "Iniciante" : l === "intermediate" ? "Intermediário" : "Avançado"}
                    desc={l === "beginner" ? "Começando agora" : l === "intermediate" ? "Já tenho presença" : "Operação madura"} />
                ))}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <Title>Que tipo de negócio você opera?</Title>
              <div className="grid gap-3 sm:grid-cols-2">
                {BUSINESS_PATHS.map(b => (
                  <ChoiceCard key={b.id} active={form.business_path === b.id}
                    onClick={() => setForm(f => ({...f, business_path: b.id}))}
                    label={b.label} desc={b.desc} />
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <Title>Quais são seus objetivos? <span className="text-xs font-normal text-muted-foreground">(selecione vários)</span></Title>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <Chip key={g} active={form.goals.includes(g)} onClick={() => toggle("goals", g)}>{g}</Chip>
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
                    <span className="flex items-center gap-2"><Clock className="size-4 text-accent"/> Horas / semana</span>
                    <span className="font-mono text-primary">{form.time_budget_hours_week}h</span>
                  </div>
                  <input type="range" min={0} max={40} step={1} value={form.time_budget_hours_week}
                    onChange={e => setForm(f => ({...f, time_budget_hours_week: Number(e.target.value)}))}
                    className="w-full accent-primary"/>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><DollarSign className="size-4 text-accent"/> Orçamento mensal (R$)</span>
                    <span className="font-mono text-primary">R$ {form.money_budget_monthly}</span>
                  </div>
                  <input type="range" min={0} max={10000} step={100} value={form.money_budget_monthly}
                    onChange={e => setForm(f => ({...f, money_budget_monthly: Number(e.target.value)}))}
                    className="w-full accent-primary"/>
                </div>
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <Title>Canais e formatos preferidos</Title>
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Canais</div>
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map(c => (
                      <Chip key={c} active={form.preferred_channels.includes(c)} onClick={() => toggle("preferred_channels", c)}>{c}</Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Formatos de conteúdo</div>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_TYPES.map(c => (
                      <Chip key={c} active={form.content_preferences.includes(c)} onClick={() => toggle("content_preferences", c)}>{c}</Chip>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
          {step === 6 && (
            <div className="text-center">
              <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
                <Check className="size-8 text-primary-foreground"/>
              </div>
              <Title>Seu plano está pronto!</Title>
              <p className="mb-6 text-sm text-muted-foreground">Acesse o Dashboard para ver suas próximas ações e começar a operar.</p>
              <button onClick={() => navigate({ to: "/app" })}
                className="rounded-xl bg-gradient-brand px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated">
                Ir para o Dashboard
              </button>
            </div>
          )}
        </motion.div>

        {step >= 1 && step <= 5 && (
          <div className="flex items-center justify-between">
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-30">← Voltar</button>
            {step < 5 ? (
              <button onClick={() => setStep(s => s + 1)}
                className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated">
                Continuar →
              </button>
            ) : (
              <button onClick={() => mut.mutate()} disabled={mut.isPending}
                className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated disabled:opacity-60">
                {mut.isPending ? "Gerando plano..." : "Gerar meu plano"}
              </button>
            )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}

function Header() {
  return (
    <header>
      <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
        <Compass className="size-3 text-accent" /> Digital Navigator
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Seu caminho de crescimento</h1>
      <p className="mt-1 text-sm text-muted-foreground">Diagnóstico inteligente para gerar seu plano de ação personalizado.</p>
    </header>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-6 text-xl font-medium">{children}</h2>;
}

function ChoiceCard({ active, onClick, label, desc }: { active: boolean; onClick: () => void; label: string; desc: string }) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${
        active ? "border-primary bg-primary/10 shadow-glow" : "border-border bg-background/40 hover:border-primary/40"
      }`}>
      <div className="font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/40 text-foreground hover:border-primary/40"
      }`}>{children}</button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </motion.div>
  );
}
