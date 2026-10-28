import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

type Member = {
  user_id: string;
  role: string;
  profile?: { display_name?: string | null; avatar_url?: string | null } | null;
};

export function TeamTab({ members }: { members: unknown[] }) {
  const { t } = useTranslation();
  return (
    <div className="section-card p-6">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {t("settings.team.title", "Membros")} ({members.length})
      </h3>
      <ul className="space-y-2">
        {(members as Member[]).map((m) => (
          <li
            key={m.user_id}
            className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground">
                {(m.profile?.display_name ?? "U").slice(0, 1).toUpperCase()}
              </div>
              <span className="text-sm">{m.profile?.display_name ?? m.user_id.slice(0, 8)}</span>
            </div>
            <Badge variant="secondary" className="capitalize">
              {m.role}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
