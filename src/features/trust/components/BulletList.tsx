import { CheckCircle2, Sparkles, XCircle } from "lucide-react";

interface BulletListProps {
  title: string;
  items: string[];
  tone: "good" | "bad" | "neutral";
}

export function BulletList({ title, items, tone }: BulletListProps) {
  if (!items?.length) return null;
  const color =
    tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : "text-muted-foreground";
  const Icon = tone === "good" ? CheckCircle2 : tone === "bad" ? XCircle : Sparkles;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <Icon className={`mt-0.5 size-3.5 shrink-0 ${color}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
