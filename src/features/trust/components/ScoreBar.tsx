interface ScoreBarProps {
  label: string;
  value: number;
  inverse?: boolean;
}

/** Normalised 0–100 bar. When `inverse` is true, low values are "good". */
export function ScoreBar({ label, value, inverse = false }: ScoreBarProps) {
  const v = Math.max(0, Math.min(100, value));
  const good = inverse ? v < 50 : v >= 50;
  const color = good ? "bg-emerald-500" : v >= 25 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{v}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full transition-all ${color}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
