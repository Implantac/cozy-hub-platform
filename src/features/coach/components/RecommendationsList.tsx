import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { fadeUp } from "@/components/app/Motion";
import { KIND_META } from "../constants";

type Props = {
  recs: any[];
  onAct: (v: { id: string; action: "dismiss" | "complete" }) => void;
};

export function RecommendationsList({ recs, onAct }: Props) {
  return (
    <>
      {recs.map((r: any) => {
        const meta = KIND_META[r.kind] ?? KIND_META.suggestion;
        const Icon = meta.icon;
        return (
          <motion.div key={r.id} variants={fadeUp}
            className="section-card hover-lift group flex items-start gap-4 p-5">
            <div className={`grid size-10 shrink-0 place-items-center rounded-xl bg-background/60 ${meta.color}`}>
              <Icon className="size-5"/>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
                {r.severity && r.severity !== "info" && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{r.severity}</span>
                )}
              </div>
              <h3 className="mt-1 font-medium">{r.title}</h3>
              {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
              {r.cta?.href && r.cta?.label && (
                <Link to={r.cta.href}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90">
                  {r.cta.label} →
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => onAct({ id: r.id, action: "complete" })}
                className="grid size-8 place-items-center rounded-lg text-success transition hover:bg-success/15" title="Marcar feito">
                <Check className="size-4"/>
              </button>
              <button onClick={() => onAct({ id: r.id, action: "dismiss" })}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary" title="Dispensar">
                <X className="size-4"/>
              </button>
            </div>
          </motion.div>
        );
      })}
    </>
  );
}
