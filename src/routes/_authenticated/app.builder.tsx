import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Rocket, CheckCircle2, Circle, Layers, ArrowRight, Sparkles, Target, Users, DollarSign, MessageSquare,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";

export const Route = createFileRoute("/_authenticated/app/builder")({
  component: BusinessBuilderPage,
});

type BlockId =
  | "problem" | "audience" | "promise" | "offer" | "price"
  | "channels" | "content" | "funnel" | "metrics" | "differentiator";

type Block = {
  id: BlockId;
  label: string;
  question: string;
  icon: typeof Target;
  category: "essência" | "oferta" | "distribuição" | "operação";
};

const BLOCKS: Block[] = [
  { id: "problem",        label: "Problema",        question: "Qual dor real você resolve?",                       icon: Target,         category: "essência" },
  { id: "audience",       label: "Público",         question: "Para quem exatamente — em uma frase?",              icon: Users,          category: "essência" },
  { id: "promise",        label: "Promessa",        question: "O que entrega que ninguém entrega?",                icon: Sparkles,       category: "essência" },
  { id: "differentiator", label: "Diferencial",     question: "Por que escolheriam você e não o concorrente?",     icon: Layers,         category: "essência" },
  { id: "offer",          label: "Oferta principal",question: "O que vende, com nome e formato claros?",           icon: Rocket,         category: "oferta" },
  { id: "price",          label: "Preço",           question: "Quanto custa e por quê esse valor?",                icon: DollarSign,     category: "oferta" },
  { id: "channels",       label: "Canais",          question: "Onde seu público realmente está?",                  icon: MessageSquare,  category: "distribuição" },
  { id: "content",        label: "Pilares de conteúdo", question: "Quais 3 temas você sustenta com autoridade?",  icon: Layers,         category: "distribuição" },
  { id: "funnel",         label: "Funil",           question: "Como alguém vai de descobrir → comprar?",           icon: ArrowRight,     category: "distribuição" },
  { id: "metrics",        label: "Métrica-norte",   question: "Que número, se subir, prova que está dando certo?", icon: Target,         category: "operação" },
];

const CATEGORIES: Array<Block["category"]> = ["essência", "oferta", "distribuição", "operação"];

const DEFAULTS: Record<BlockId, string> = {
  problem: "Pequenos negócios locais perdem clientes porque a marca parece amadora.",
  audience: "Donos de negócio local com faturamento R$ 10-50k/mês que querem parecer profissionais sem complicação.",
  promise: "",
  differentiator: "",
  offer: "",
  price: "",
  channels: "Instagram + Google Business como bases.",
  content: "",
  funnel: "",
  metrics: "",
};

function BusinessBuilderPage() {
  const [answers, setAnswers] = useState<Record<BlockId, string>>(DEFAULTS);
  const [active, setActive] = useState<BlockId>("problem");

  const filled = Object.values(answers).filter((v) => v.trim().length > 0).length;
  const total = BLOCKS.length;
  const progress = Math.round((filled / total) * 100);

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <Rocket className="size-3 text-accent" /> Builder · construa o modelo
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Business Builder</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              10 blocos. 10 decisões. Um modelo de negócio que cabe em uma página.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Completo</div>
            <div className="text-2xl font-bold tabular-nums">{filled}/{total}</div>
          </div>
        </motion.header>

        <motion.div variants={fadeUp} className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${progress}%` }} />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
          {/* Blocks list */}
          <motion.section variants={stagger} className="space-y-5">
            {CATEGORIES.map((cat) => {
              const items = BLOCKS.filter((b) => b.category === cat);
              return (
                <motion.div key={cat} variants={fadeUp}>
                  <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    {cat}
                  </div>
                  <div className="space-y-1.5">
                    {items.map((b) => {
                      const done = answers[b.id].trim().length > 0;
                      const isActive = active === b.id;
                      return (
                        <button key={b.id} onClick={() => setActive(b.id)}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                            isActive ? "border-primary/40 bg-primary/5 shadow-soft"
                                     : "border-border bg-card/40 hover:border-border hover:bg-card/60"
                          }`}>
                          {done
                            ? <CheckCircle2 className="size-4 shrink-0 text-success" />
                            : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                          <span className="flex-1 truncate text-sm font-medium">{b.label}</span>
                          {isActive && <ArrowRight className="size-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </motion.section>

          {/* Editor */}
          <motion.section variants={fadeUp}>
            <BlockEditor
              block={BLOCKS.find((b) => b.id === active)!}
              value={answers[active]}
              onChange={(v) => setAnswers((a) => ({ ...a, [active]: v }))}
            />

            {/* One-pager preview */}
            <div className="mt-6 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Resumo · one-pager</div>
                <button className="text-xs text-primary hover:underline">Exportar</button>
              </div>
              <div className="grid gap-3 text-sm">
                {BLOCKS.map((b) => (
                  <div key={b.id} className="grid grid-cols-[120px,1fr] gap-3 border-b border-border/40 py-2 last:border-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{b.label}</div>
                    <div className={answers[b.id] ? "" : "text-muted-foreground italic"}>
                      {answers[b.id] || "— ainda em branco —"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </PageTransition>
  );
}

function BlockEditor({ block, value, onChange }: {
  block: Block; value: string; onChange: (v: string) => void;
}) {
  const Icon = block.icon;
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{block.category}</div>
          <div className="text-lg font-semibold">{block.label}</div>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{block.question}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Escreva em uma ou duas frases. Clareza vence completude."
        className="mt-3 w-full resize-none rounded-xl border border-border bg-background/60 p-4 text-sm leading-relaxed outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>{value.length} caracteres</span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="size-3 text-accent" /> Dica: comece pelo problema, o resto deriva dele.
        </span>
      </div>
    </div>
  );
}
