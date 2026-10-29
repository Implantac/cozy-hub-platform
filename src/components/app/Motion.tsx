import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

import { EASE } from "./motion-presets";

/**
 * Shared transition components. Presets (`EASE`, `fadeUp`, `stagger`) live in
 * `motion-presets.ts` so this file exports components only — see that module for
 * why fast refresh requires the split.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

type MotionDivProps = HTMLMotionProps<"div">;
export function MotionCard({ children, className, ...rest }: MotionDivProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: EASE }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
