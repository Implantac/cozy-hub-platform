import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import {
  Rocket, CheckCircle2, Circle, Layers, ArrowRight, Sparkles, Target, Users, DollarSign, MessageSquare,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";
import { BuilderService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/builder")({
  component: BusinessBuilderPage,
});

type BlockId =
  | "problem" | "audience" | "promise" | "differentiator"
  | "offer" | "price" | "channels" | "content_pillars" | "funnel" | "metric";

type Block = {
  id: BlockId; label: string; question: string;
  icon: typeof Target; category: "essência" | "oferta" | "distribuição" | "operação";
};

const BLOCKS: Block[] = [
  { id: "problem",        label: "Problema",            question: "Qual dor real você resolve?",                       icon: Target,        category: "essência" },
  { id: "audience",       label: "Público",             question: "Para quem exatamente — em uma frase?",              icon: Users,         category: "essência" },
  { id: "promise",        label: "Promessa",            question: "O que entrega que ninguém entrega?",                icon: Sparkles,      category: "essência" },
  { id: "differentiator", label: "Diferencial",         question: "Por que escolheriam você e não o concorrente?",     icon: Layers,        category: "essência" },
  { id: "offer",          label: "Oferta principal",    question: "O que vende, com nome e formato claros?",           icon: Rocket,        category: "oferta" },
  { id: "price",          label: "Preço",               question: "Quanto custa e por quê esse valor?",                icon: DollarSign,    category: "oferta" },
  { id: "channels",       label: "Canais",              question: "Onde seu público realmente está?",                  icon: MessageSquare, category: "distribuição" },
  { id: "content_pillars",label: "Pilares de conteúdo",question: "Quais 3 temas você sustenta com autoridade?",      icon: Layers,        category: "distribuição" },
  { id: "funnel",         label: "Funil",               question: "Como alguém vai de descobrir → comprar?",           icon: ArrowRight,    category: "distribuição" },
  { id: "metric",         label: "Métrica-norte",       question: "Que número, se subir, prova que está dando certo?", icon: Target,        category: "operação" },
];

const CATEGORIES: Array<Block["category"]> = ["essência", "oferta", "distribuição", "operação"];

type Blueprint = Partial<Record<BlockId, string | null>>;

function BusinessBuilderPage() {
  const [wsId] = useCurrentWorkspaceId();
  const qc = useQueryClient();
  const get = useServerFn(BuilderService.getBlueprint);
  const update = useServerFn(BuilderService.updateBlueprintBlock);

  const q = useQuery({
    queryKey: ["blueprint", wsId],
    queryFn: () => get({ data: { workspaceId: wsId! } }) as Promise<Blueprint | null>,
    enabled: !!wsId,
  });

  const [active, setActive] = useState<BlockId>("problem");
  const [draft, setDraft] = useState("");

  // Sync draft when active changes or data loads
  useEffect(() => { setDraft((q.data?.[active] ?? "") as string); }, [active, q.data]);

  const mut = useMutation({
    mutationFn: (p: { field: BlockId; value: string }) =>
      update({ data: { workspaceId: wsId!, field: p.field, value: p.value } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["blueprint", wsId] }); toast.success("Bloco salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = q.data ?? {};
  const filled = BLOCKS.filter((b) => ((data[b.id] ?? "") as string).trim().length > 0).length;
  const total = BLOCKS.length;
  const progress = Math.round((filled / total) * 100);
  const dirty = draft !== ((data[active] ?? "") as string);

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
          <motion.section variants={stagger} className="space-y-5">
            {CATEGORIES.map((cat) => (
              <motion.div key={cat} variants={fadeUp}>
                <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{cat}</div>
                <div className="space-y-1.5">
                  {BLOCKS.filter((b) => b.category === cat).map((b) => {
                    const done = ((data[b.id] ?? "") as string).trim().length > 0;
                    const isActive = active === b.id;
                    return (
                      <button key={b.id} onClick={() => setActive(b.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          isActive ? "border-primary/40 bg-primary/5 shadow-soft"
                                   : "border-border bg-card/40 hover:border-border hover:bg-card/60"
                        }`}>
                        {done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                        <span className="flex-1 truncate text-sm font-medium">{b.label}</span>
                        {isActive && <ArrowRight className="size-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </motion.section>

          <motion.section variants={fadeUp}>
            <BlockEditor
              block={BLOCKS.find((b) => b.id === active)!}
              value={draft}
              onChange={setDraft}
              dirty={dirty}
              saving={mut.isPending}
              onSave={() => mut.mutate({ field: active, value: draft })}
            />

            <div className="mt-6 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              <div className="mb-4 text-[11px] uppercase tracking-wider text-muted-foreground">Resumo · one-pager</div>
              <div className="grid gap-3 text-sm">
                {BLOCKS.map((b) => (
                  <div key={b.id} className="grid grid-cols-[140px,1fr] gap-3 border-b border-border/40 py-2 last:border-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{b.label}</div>
                    <div className={((data[b.id] ?? "") as string) ? "" : "text-muted-foreground italic"}>
                      {((data[b.id] ?? "") as string) || "— ainda em branco —"}
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

function BlockEditor({ block, value, onChange, dirty, saving, onSave }: {
  block: Block; value: string; onChange: (v: string) => void; dirty: boolean; saving: boolean; onSave: () => void;
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
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Sparkles className="size-3 text-accent" /> Dica: comece pelo problema.
        </span>
        <button onClick={onSave} disabled={!dirty || saving}
          className="rounded-lg bg-gradient-brand px-4 py-2 text-xs font-medium text-primary-foreground shadow-glow transition disabled:opacity-50">
          {saving ? "Salvando…" : dirty ? "Salvar bloco" : "Salvo"}
        </button>
      </div>
    </div>
  );
}
