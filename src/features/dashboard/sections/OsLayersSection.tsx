import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Brain, Compass, Rocket, Shield, type LucideIcon } from "lucide-react";
import { fadeUp, stagger } from "@/components/app/Motion";

interface OsLayersSectionProps {
  blueprint: Record<string, string | null> | null | undefined;
  competitors: any[] | undefined;
  skills: any[] | undefined;
  journey: any;
}

const BP_FIELDS = ["problem","audience","promise","differentiator","offer","price","channels","content_pillars","funnel","metric"];

export function OsLayersSection({ blueprint, competitors, skills, journey }: OsLayersSectionProps) {
  const bp = blueprint ?? {};
  const bpFilled = BP_FIELDS.filter((f) => ((bp[f] ?? "") as string).trim().length > 0).length;
  const bpPct = Math.round((bpFilled / BP_FIELDS.length) * 100);

  const comps = competitors ?? [];
  const compHigh = comps.filter((c: any) => c.threat === "high").length;

  const sk = skills ?? [];
  const skMastered = sk.filter((s: any) => (s.level ?? s.score ?? 0) >= 80).length;
  const skAvg = sk.length > 0 ? Math.round(sk.reduce((a: number, s: any) => a + (s.level ?? s.score ?? 0), 0) / sk.length) : 0;

  const periods = journey?.periods ?? [];
  const current = [...periods].reverse().find((p: any) => p.events_count > 0 || p.decisions_count > 0) ?? periods[periods.length - 1];

  const cards: { to: string; icon: LucideIcon; label: string; value: string; hint: string; pct: number | null }[] = [
    { to: "/app/builder",     icon: Rocket,   label: "Modelo de negócio", value: `${bpFilled}/10`,        hint: `${bpPct}% completo`, pct: bpPct },
    { to: "/app/journey",     icon: Compass,  label: "Sua jornada",        value: current?.key ?? "—",     hint: current ? `${current.events_count} eventos` : "comece a registrar", pct: null },
    { to: "/app/competitors", icon: Shield,   label: "Radar competitivo",  value: String(comps.length),    hint: compHigh > 0 ? `${compHigh} alta ameaça` : "sem ameaças altas", pct: null },
    { to: "/app/skill-map",   icon: Brain,    label: "Skill Map",          value: `${skMastered} domínios`, hint: sk.length > 0 ? `média ${skAvg}` : "calibre suas skills", pct: skAvg || null },
  ];

  return (
    <motion.section variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <motion.div key={c.to} variants={fadeUp}>
          <Link to={c.to} className="stat-tile group block">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><c.icon className="size-3 text-accent" /> {c.label}</span>
              <ArrowUpRight className="size-3 text-muted-foreground transition group-hover:text-primary" />
            </div>
            <div className="mt-2 text-xl font-semibold tabular-nums tracking-tight">{c.value}</div>
            <div className="text-[11px] text-muted-foreground">{c.hint}</div>
            {c.pct !== null && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${c.pct}%` }} />
              </div>
            )}
          </Link>
        </motion.div>
      ))}
    </motion.section>
  );
}
