import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function Block({
  icon: Icon,
  label,
  body,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${accent ? "border-accent/30 bg-accent/5" : "border-border bg-background/40"}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`size-3 ${accent ? "text-accent" : ""}`} /> {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed">{body}</p>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
