import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  RadarIcon, TrendingUp, TrendingDown, Minus, Eye, AlertTriangle, Lightbulb, ArrowUpRight, Plus,
} from "lucide-react";
import { PageTransition, fadeUp, stagger } from "@/components/app/Motion";

export const Route = createFileRoute("/_authenticated/app/competitors")({
  component: CompetitorRadarPage,
});

type Trend = "up" | "down" | "flat";
type Threat = "high" | "medium" | "low";

type Competitor = {
  id: string;
  name: string;
  handle: string;
  followers: number;
  engagement: number;
  trend: Trend;
  threat: Threat;
  positioning: string;
  recentMove: string;
  gap: string;
};

const COMPETITORS: Competitor[] = [
  { id: "c1", name: "Estúdio Norte", handle: "@estudionorte", followers: 48000, engagement: 4.2, trend: "up", threat: "high",
    positioning: "Premium minimalista, ticket alto, poucos clientes.", recentMove: "Lançou curso de R$ 1.997 com 3 cases de sucesso.", gap: "Não atende projetos abaixo de R$ 5k — espaço claro pra você." },
  { id: "c2", name: "Marca Viva", handle: "@marcaviva.studio", followers: 22500, engagement: 6.8, trend: "up", threat: "medium",
    positioning: "Acessível, didático, foco em pequenos negócios.", recentMove: "Começou newsletter semanal com case real.", gap: "Conteúdo bom mas oferta confusa — clareza vence." },
  { id: "c3", name: "Branding Lab", handle: "@brandinglab", followers: 91200, engagement: 2.1, trend: "flat", threat: "medium",
    positioning: "Volume alto, conteúdo genérico, autoridade construída.", recentMove: "Reduziu frequência de posts em 40%.", gap: "Audiência cansada — espaço pra quem traz profundidade." },
  { id: "c4", name: "Casa Criativa", handle: "@casacriativa.co", followers: 15800, engagement: 8.4, trend: "up", threat: "high",
    positioning: "Comunidade engajada, voz autoral forte.", recentMove: "Abriu mentoria em grupo limitada a 12 pessoas.", gap: "Foco em B2C — você pode dominar B2B sem competir direto." },
  { id: "c5", name: "Studio Forma", handle: "@studioforma", followers: 67400, engagement: 3.0, trend: "down", threat: "low",
    positioning: "Veterano do mercado, processo lento.", recentMove: "Sem novidades em 60 dias.", gap: "Inércia clara — janela aberta pra agilidade." },
];

const INSIGHTS = [
  { kind: "opportunity", title: "Reels educacionais subexplorados", body: "3 dos 5 concorrentes não fazem vídeo curto educacional. Janela orgânica grande." },
  { kind: "warning", title: "Pressão de preço no mid-market", body: "Marca Viva e Casa Criativa estão capturando o ticket de R$ 2-5k. Diferenciação urgente." },
  { kind: "opportunity", title: "Ninguém escreve sobre processo", body: "Bastidores de cliente real é território vazio. Conteúdo de alta confiança." },
];

function CompetitorRadarPage() {
  const [view, setView] = useState<"list" | "matrix">("list");

  return (
    <PageTransition>
      <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
        <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <RadarIcon className="size-3 text-accent" /> Radar · inteligência competitiva
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Concorrentes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              O que estão fazendo, o que está funcionando, onde você pode ganhar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card/60 p-0.5">
              <button onClick={() => setView("list")}
                className={`rounded-md px-3 py-1.5 text-xs transition ${view === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Lista
              </button>
              <button onClick={() => setView("matrix")}
                className={`rounded-md px-3 py-1.5 text-xs transition ${view === "matrix" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                Matriz
              </button>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:shadow-elevated">
              <Plus className="size-4" /> Adicionar
            </button>
          </div>
        </motion.header>

        {/* Insights row */}
        <motion.section variants={stagger} className="grid gap-3 md:grid-cols-3">
          {INSIGHTS.map((ins, i) => (
            <motion.div key={i} variants={fadeUp}
              className={`rounded-2xl border p-4 backdrop-blur ${
                ins.kind === "opportunity" ? "border-accent/30 bg-accent/5" : "border-destructive/30 bg-destructive/5"
              }`}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
                {ins.kind === "opportunity"
                  ? <><Lightbulb className="size-3 text-accent" /><span className="text-accent">Oportunidade</span></>
                  : <><AlertTriangle className="size-3 text-destructive" /><span className="text-destructive">Alerta</span></>}
              </div>
              <div className="mt-2 text-sm font-semibold">{ins.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{ins.body}</p>
            </motion.div>
          ))}
        </motion.section>

        {/* Competitors */}
        {view === "list" ? (
          <motion.section variants={stagger} className="space-y-3">
            {COMPETITORS.map((c) => <CompetitorRow key={c.id} c={c} />)}
          </motion.section>
        ) : (
          <ThreatMatrix items={COMPETITORS} />
        )}
      </motion.div>
    </PageTransition>
  );
}

function CompetitorRow({ c }: { c: Competitor }) {
  const TIcon = c.trend === "up" ? TrendingUp : c.trend === "down" ? TrendingDown : Minus;
  const tTone = c.trend === "up" ? "text-success" : c.trend === "down" ? "text-destructive" : "text-muted-foreground";
  const threatTone =
    c.threat === "high" ? "bg-destructive/15 text-destructive"
    : c.threat === "medium" ? "bg-warning/15 text-warning"
    : "bg-secondary text-muted-foreground";

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition hover:border-primary/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{c.name}</span>
            <span className="text-xs text-muted-foreground">{c.handle}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{c.positioning}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${threatTone}`}>
            ameaça {c.threat}
          </span>
          <button className="grid size-8 place-items-center rounded-lg border border-border bg-background/40 text-muted-foreground transition hover:text-foreground">
            <Eye className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
        <Stat label="Seguidores" value={c.followers.toLocaleString("pt-BR")} />
        <Stat label="Engajamento" value={`${c.engagement}%`} />
        <Stat label="Tendência" value={
          <span className={`inline-flex items-center gap-1 ${tTone}`}>
            <TIcon className="size-3" /> {c.trend === "up" ? "Subindo" : c.trend === "down" ? "Caindo" : "Estável"}
          </span>
        } />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Block icon={Eye} label="Movimento recente" body={c.recentMove} />
        <Block icon={Lightbulb} label="Seu gap" body={c.gap} accent />
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

function Block({ icon: Icon, label, body, accent }: { icon: typeof Eye; label: string; body: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? "border-accent/30 bg-accent/5" : "border-border bg-background/40"}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`size-3 ${accent ? "text-accent" : ""}`} /> {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed">{body}</p>
    </div>
  );
}

function ThreatMatrix({ items }: { items: Competitor[] }) {
  // Plot by followers (x) and engagement (y). High threat = larger dot.
  const maxF = Math.max(...items.map((i) => i.followers));
  const maxE = Math.max(...items.map((i) => i.engagement));
  return (
    <motion.div variants={fadeUp}
      className="relative h-[420px] rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
      <div className="absolute left-3 top-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        ↑ Engajamento
      </div>
      <div className="absolute bottom-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        Audiência →
      </div>
      <div className="absolute inset-12">
        {/* axes */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
        <div className="absolute inset-y-0 left-0 w-px bg-border" />
        {/* dots */}
        {items.map((c) => {
          const x = (c.followers / maxF) * 100;
          const y = (c.engagement / maxE) * 100;
          const size = c.threat === "high" ? 56 : c.threat === "medium" ? 40 : 28;
          const tone = c.threat === "high" ? "bg-destructive/30 ring-destructive/60"
                     : c.threat === "medium" ? "bg-warning/30 ring-warning/60"
                     : "bg-muted ring-border";
          return (
            <div key={c.id}
              className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full ring-2 transition hover:scale-110 ${tone}`}
              style={{ left: `${x}%`, bottom: `${y}%`, width: size, height: size }}
              title={c.name}>
              <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium">
                {c.name}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
