import { motion } from "framer-motion";
import type { ElementType } from "react";
import { fadeUp } from "@/components/app/Motion";

type Props = {
  label: string;
  value: string | number;
  icon: ElementType;
  small?: boolean;
};

export function SkillStat({ label, value, icon: Icon, small }: Props) {
  return (
    <motion.div variants={fadeUp} className="section-card hover-lift p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3 text-accent" /> {label}
      </div>
      <div className={`mt-2 ${small ? "text-base font-medium" : "text-3xl font-bold tabular-nums"}`}>
        {value}
      </div>
    </motion.div>
  );
}
