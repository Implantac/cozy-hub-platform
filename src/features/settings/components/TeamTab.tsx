import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";

type Member = {
  user_id: string;
  role: string;
  profile?: { display_name?: string | null; avatar_url?: string | null } | null;
};

const ROLE_KEYS: Record<string, string> = {
  owner: "settings.roles.owner",
  admin: "settings.roles.admin",
  editor: "settings.roles.editor",
  viewer: "settings.roles.viewer",
};

export function TeamTab({ members }: { members: unknown[] }) {
  const { t } = useTranslation();
  return (
    <section className="section-card p-4 sm:p-6" aria-labelledby="team-heading">
      <h2
        id="team-heading"
        className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        {t("settings.team.title")} ({members.length})
      </h2>
      <p className="mb-4 mt-2 text-sm text-muted-foreground">{t("settings.team.readOnly")}</p>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("settings.team.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {(members as Member[]).map((member) => (
            <li
              key={member.user_id}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground"
                >
                  {(member.profile?.display_name ?? "U").slice(0, 1).toUpperCase()}
                </div>
                <span className="min-w-0 break-words text-sm">
                  {member.profile?.display_name ??
                    t("settings.team.memberFallback", { id: member.user_id.slice(0, 8) })}
                </span>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {ROLE_KEYS[member.role] ? t(ROLE_KEYS[member.role]) : member.role}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {t("settings.team.visibilityNote")}
      </p>
    </section>
  );
}
