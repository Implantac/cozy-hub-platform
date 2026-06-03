import { Link2 } from "lucide-react";
import { PLATFORMS } from "@/components/app/PlatformIcon";

type Props = {
  disabled: boolean;
  onConnect: (oauthProvider: string) => void;
};

export function ConnectPlatformGrid({ disabled, onConnect }: Props) {
  return (
    <div className="section-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Connect a platform</h3>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => onConnect(p.oauth)}
            disabled={disabled}
            className="group hover-lift flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            <div className="grid size-10 place-items-center rounded-lg bg-secondary group-hover:bg-primary/10">
              <p.Icon className="size-5" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{p.label}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="size-3" /> Connect
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
