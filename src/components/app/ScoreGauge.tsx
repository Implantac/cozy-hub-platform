import { motion } from "framer-motion";
import { EASE } from "./Motion";

/** Animated radial gauge for Digital Score (0-100). */
export function ScoreGauge({
  value, size = 200, label = "Digital Score",
}: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);
  const tier = v >= 80 ? "Excelente" : v >= 60 ? "Bom" : v >= 40 ? "Em evolução" : v >= 20 ? "Iniciante" : "Começando";
  const color = v >= 80 ? "hsl(var(--success))" : v >= 60 ? "hsl(var(--primary))"
              : v >= 40 ? "hsl(var(--accent))" : v >= 20 ? "hsl(38 92% 50%)" : "hsl(var(--destructive))";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={radius}
          stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size/2} cy={size/2} r={radius}
          stroke="url(#gauge-grad)" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5, ease: EASE }}
          className="text-5xl font-bold tracking-tight tabular-nums" style={{ color }}>
          {Math.round(v)}
        </motion.div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-xs font-medium" style={{ color }}>{tier}</div>
      </div>
    </div>
  );
}
