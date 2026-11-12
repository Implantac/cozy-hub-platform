import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/features/shell/components/QueryErrorState";
import { useAuth } from "@/lib/auth/use-auth";
import { updateMyProfile } from "@/lib/api/notifications.functions";
import type { getMyProfile } from "@/lib/api/workspaces.functions";
import { useMyProfile } from "@/lib/profile/use-my-profile";
import { displayNameSchema, DISPLAY_NAME_MAX_LENGTH, profileQueryKey } from "@/lib/profile/profile";
import { errorMessage } from "@/lib/json";

type Profile = NonNullable<Awaited<ReturnType<typeof getMyProfile>>>;

export function ProfileTab() {
  const auth = useAuth();
  const query = useMyProfile(auth.user?.id);

  return (
    <div className="space-y-4">
      {query.isError && (
        <QueryErrorState onRetry={() => void query.refetch()} pending={query.isFetching} />
      )}
      {query.data && auth.user ? (
        <ProfileForm key={auth.user.id} profile={query.data} email={auth.user.email} />
      ) : query.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : !query.isError ? (
        <QueryErrorState onRetry={() => void query.refetch()} pending={query.isFetching} />
      ) : null}
    </div>
  );
}

function ProfileForm({ profile, email }: { profile: Profile; email?: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const updateProfile = useServerFn(updateMyProfile);
  // A null draft follows loaded data. Once the user types, background refreshes
  // must never replace their input. No effect or imperative cache read is needed.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const currentName = profile.display_name ?? "";
  const displayName = draft ?? currentName;
  const validation = displayNameSchema.safeParse(displayName);
  const dirty = displayName.trim() !== currentName;
  const invalid = draft !== null && !validation.success;
  const canSave = validation.success && dirty && !saving;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave || !validation.success) return;
    setSaving(true);
    try {
      const result = await updateProfile({ data: { display_name: validation.data } });
      qc.setQueryData(profileQueryKey(profile.id), result.profile);
      setDraft(null);
      void qc.invalidateQueries({ queryKey: profileQueryKey(profile.id) });
      void qc.invalidateQueries({ queryKey: ["ws-detail"] });
      toast.success(t("settings.saved"));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="section-card p-4 sm:p-6" aria-labelledby="profile-heading">
      <h2
        id="profile-heading"
        className="text-sm font-bold uppercase tracking-widest text-muted-foreground"
      >
        {t("settings.profile.title")}
      </h2>
      <p className="mt-1 break-words text-xs text-muted-foreground">{email}</p>
      <p className="mt-3 text-sm text-muted-foreground">{t("settings.profile.help")}</p>
      <form
        onSubmit={(event) => void save(event)}
        className="mt-4 max-w-md space-y-4"
        aria-busy={saving}
      >
        <div className="space-y-1.5">
          <Label htmlFor="profile-display-name">{t("settings.profile.displayName")}</Label>
          <Input
            id="profile-display-name"
            name="displayName"
            autoComplete="nickname"
            value={displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            disabled={saving}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={invalid}
            aria-describedby="profile-name-help profile-name-error"
          />
          <p id="profile-name-help" className="text-xs text-muted-foreground">
            {t("settings.profile.nameLimit", { max: DISPLAY_NAME_MAX_LENGTH })}
          </p>
          <p id="profile-name-error" className="text-sm text-destructive" aria-live="polite">
            {invalid
              ? t(displayName.trim() ? "settings.profile.tooLong" : "settings.profile.required", {
                  max: DISPLAY_NAME_MAX_LENGTH,
                })
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={!canSave} size="sm" className="min-h-11">
            {saving ? t("common.loading") : t("settings.save")}
          </Button>
          <p className="text-xs text-muted-foreground" role="status">
            {t(dirty ? "settings.profile.unsaved" : "settings.profile.noChanges")}
          </p>
        </div>
      </form>
    </section>
  );
}
