import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Brain, Target } from "lucide-react";
import { Empty, LinkAction, Panel, RecIcon, SeverityPill, StatusPill } from "../components/atoms";

type Props = { topRecs: any[]; priorityMissions: any[] };

export function CoachMissionsSection({ topRecs, priorityMissions }: Props) {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <Panel
        className="lg:col-span-2"
        title="Próximos passos do Coach"
        icon={Brain}
        action={<LinkAction to="/app/coach" label="Abrir Coach" />}
      >
        {topRecs.length === 0 ? (
          <Empty text="Sem recomendações ativas. Clique em Atualizar GPS para gerar." />
        ) : (
          <ul className="space-y-2">
            {topRecs.map((r: any) => (
              <li
                key={r.id}
                className="rounded-xl sm:rounded-2xl border border-border/50 bg-background/30 p-4 sm:p-5 transition-all duration-300 hover:border-primary/40 hover:bg-background/50 hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <RecIcon kind={r.kind} />
                    <div>
                      <div className="font-bold tracking-tight text-foreground">{r.title}</div>
                      {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                    </div>
                  </div>
                  <SeverityPill severity={r.severity} />
                </div>
                {r.cta?.href && (
                  <Link
                    to={r.cta.href}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {r.cta.label ?? "Abrir"} <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Missões prioritárias"
        icon={Target}
        action={<LinkAction to="/app/missions" label="Gerenciar" />}
      >
        {priorityMissions.length === 0 ? (
          <Empty text="Nenhuma missão pendente." />
        ) : (
          <ul className="space-y-2">
            {priorityMissions.map((m: any) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-border/50 bg-background/30 p-4 transition-all hover:border-primary/30"
              >
                <span className="truncate text-sm">{m.title}</span>
                <StatusPill status={m.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}
