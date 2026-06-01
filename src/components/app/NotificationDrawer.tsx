import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { Bell, Activity } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { listRecentEvents } from "@/lib/api/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

function formatEventType(type: string) {
  return type.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string, locale: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return locale.startsWith("pt") ? "agora" : "now";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  return `${days}d`;
}

export function NotificationDrawer({ workspaceId }: { workspaceId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const fetchEvents = useServerFn(listRecentEvents);
  const q = useQuery({
    queryKey: ["events", workspaceId],
    queryFn: () => fetchEvents({ data: { workspaceId: workspaceId!, limit: 30 } }),
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`events-${workspaceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "domain_events", filter: `workspace_id=eq.${workspaceId}` }, () => q.refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, q]);

  const events = q.data ?? [];
  const unread = events.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="relative grid size-9 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label={t("notifications.title", "Notificações")}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            {t("notifications.title", "Notificações")}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 100px)" }}>
          {events.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              {t("notifications.empty", "Nenhuma atividade ainda.")}
            </div>
          )}
          {events.map((e) => (
            <div key={e.id} className="rounded-lg border border-border/50 bg-card/40 p-3 transition hover:bg-card/70">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{formatEventType(e.event_type)}</p>
                  {e.payload && typeof e.payload === "object" && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {Object.entries(e.payload as Record<string, unknown>).slice(0, 2).map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`).join(" · ")}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{timeAgo(e.created_at, i18n.language)}</Badge>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
