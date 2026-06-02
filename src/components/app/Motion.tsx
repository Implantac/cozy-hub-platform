import { motion, type HTMLMotionProps } from "framer-motion";
import { type ReactNode } from "react";

/** VELT — shared motion presets (Linear/Vercel-like easing). */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE },
};

export const stagger = {
  animate: { transition: { staggerChildren: 0.05 } },
};

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
