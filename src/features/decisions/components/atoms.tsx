import type { LucideIcon } from "lucide-react";

export function ScorePill({ label, value, invert }: { label: string; value: number; tone?: string; invert?: boolean }) {
  const effective = invert ? 100 - value : value;
  const colorClass =
    effective >= 70 ? "text-emerald-600"
    : effective >= 40 ? "text-amber-600"
    : "text-rose-600";
  return (
    <div className="rounded-lg border border-border bg-card/40 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

export function ListBlock({ icon: Icon, title, tone, items }: { icon: LucideIcon; title: string; tone: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 ${tone}`}>
        <Icon className="size-3.5" /> {title}
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}
