import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { fadeUp, stagger } from "@/components/app/motion-presets";
import { BLOCKS, CATEGORIES, type BlockId, type Blueprint } from "../constants";

type Props = {
  data: Blueprint;
  active: BlockId;
  setActive: (id: BlockId) => void;
};

export function BlockList({ data, active, setActive }: Props) {
  return (
    <motion.section variants={stagger} className="space-y-5">
      {CATEGORIES.map((cat) => (
        <motion.div key={cat} variants={fadeUp}>
          <div className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {cat}
          </div>
          <div className="space-y-1.5">
            {BLOCKS.filter((b) => b.category === cat).map((b) => {
              const done = ((data[b.id] ?? "") as string).trim().length > 0;
              const isActive = active === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setActive(b.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    isActive
                      ? "border-primary/40 bg-primary/5 shadow-soft"
                      : "border-border bg-card/40 hover:border-border hover:bg-card/60"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate text-sm font-medium">{b.label}</span>
                  {isActive && <ArrowRight className="size-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </motion.section>
  );
}

export function BlueprintSummary({ data }: { data: Blueprint }) {
  return (
    <div className="mt-6 section-card p-6">
      <div className="mb-4 text-[11px] uppercase tracking-wider text-muted-foreground">
        Resumo · one-pager
      </div>
      <div className="grid gap-3 text-sm">
        {BLOCKS.map((b) => (
          <div
            key={b.id}
            className="grid grid-cols-[140px,1fr] gap-3 border-b border-border/40 py-2 last:border-0"
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {b.label}
            </div>
            <div className={((data[b.id] ?? "") as string) ? "" : "text-muted-foreground italic"}>
              {((data[b.id] ?? "") as string) || "— ainda em branco —"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
