import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/use-auth";
import { updateMyProfile } from "@/lib/api/notifications.functions";
import { errorMessage } from "@/lib/json";

export function ProfileTab() {
  const { t } = useTranslation();
  const auth = useAuth();
  const qc = useQueryClient();
  const updateProfile = useServerFn(updateMyProfile);
  const profile = qc.getQueryData(["my-profile"]) as { display_name?: string | null } | undefined;
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ data: { display_name: displayName.trim() } });
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t("settings.saved", "Salvo"));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section-card p-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {t("settings.profile.title", "Seu perfil")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{auth.user?.email}</p>
      <div className="mt-4 space-y-3 max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="dn">{t("settings.profile.displayName", "Nome de exibição")}</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? t("common.loading") : t("settings.save", "Salvar alterações")}
        </Button>
      </div>
    </div>
  );
}
