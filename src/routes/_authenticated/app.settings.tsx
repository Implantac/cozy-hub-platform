import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { Settings as SettingsIcon, User, Users, Globe, Building2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getWorkspace } from "@/lib/api/workspaces.functions";
import { updateMyProfile } from "@/lib/api/notifications.functions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const qc = useQueryClient();
  const fetchWs = useServerFn(getWorkspace);
  const updateProfile = useServerFn(updateMyProfile);

  const q = useWorkspaceQuery(
    (wsId) => ["ws-detail", wsId],
    ({ workspaceId }) => fetchWs({ data: { id: workspaceId } }),
  );

  const profile = qc.getQueryData(["my-profile"]) as { display_name?: string | null } | undefined;
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ data: { display_name: displayName.trim() } });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t("settings.saved", "Salvo"));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={SettingsIcon}
        title={t("settings.title", "Configurações")}
        subtitle={t("settings.subtitle", "Perfil, workspace e equipe.")}
      />

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile"><User className="mr-2 size-3.5" />{t("settings.tabs.profile", "Perfil")}</TabsTrigger>
          <TabsTrigger value="workspace"><Building2 className="mr-2 size-3.5" />{t("settings.tabs.workspace", "Workspace")}</TabsTrigger>
          <TabsTrigger value="team"><Users className="mr-2 size-3.5" />{t("settings.tabs.team", "Equipe")}</TabsTrigger>
          <TabsTrigger value="appearance"><Globe className="mr-2 size-3.5" />{t("settings.tabs.appearance", "Idioma")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <h3 className="text-sm font-semibold">{t("settings.profile.title", "Seu perfil")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{auth.user?.email}</p>
            <div className="mt-4 space-y-3 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="dn">{t("settings.profile.displayName", "Nome de exibição")}</Label>
                <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <Button onClick={saveProfile} disabled={saving} size="sm">
                {saving ? t("common.loading") : t("settings.save", "Salvar alterações")}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="workspace">
          {q.data && (
            <div className="rounded-2xl border border-border bg-card/60 p-6">
              <h3 className="text-sm font-semibold">{q.data.workspace.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                /{q.data.workspace.slug} · {t("settings.plan", "plano")}: <Badge variant="secondary" className="ml-1">{q.data.workspace.plan}</Badge>
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="team">
          {q.data && (
            <div className="rounded-2xl border border-border bg-card/60 p-6">
              <h3 className="mb-4 text-sm font-semibold">
                {t("settings.team.title", "Membros")} ({q.data.members.length})
              </h3>
              <ul className="space-y-2">
                {q.data.members.map((m) => {
                  const member = m as unknown as {
                    user_id: string;
                    role: string;
                    profile?: { display_name?: string | null; avatar_url?: string | null } | null;
                  };
                  return (
                    <li key={member.user_id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand text-xs font-bold text-primary-foreground">
                          {(member.profile?.display_name ?? "U").slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm">
                          {member.profile?.display_name ?? member.user_id.slice(0, 8)}
                        </span>
                      </div>
                      <Badge variant="secondary" className="capitalize">{member.role}</Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </TabsContent>

        <TabsContent value="appearance">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <h3 className="mb-3 text-sm font-semibold">{t("settings.appearance.title", "Idioma da interface")}</h3>
            <div className="max-w-xs">
              <LanguageSwitcher />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
