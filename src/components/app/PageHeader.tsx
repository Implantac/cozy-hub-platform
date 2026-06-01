import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}

export function PageHeader({ icon: Icon, title, subtitle }: PageHeaderProps) {
  return (
    <header className="flex items-center gap-3">
      <div className="grid size-10 place-items-center rounded-xl bg-gradient-brand shadow-glow">
        <Icon className="size-5 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
    </header>
  );
}
