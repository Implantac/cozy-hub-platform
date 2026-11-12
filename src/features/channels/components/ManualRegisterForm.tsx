import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PLATFORMS, type PlatformId } from "@/components/app/platform-meta";

type Props = {
  platform: PlatformId;
  setPlatform: (p: PlatformId) => void;
  handle: string;
  setHandle: (h: string) => void;
  onSubmit: () => void;
  isPending: boolean;
  disabled?: boolean;
};

export function ManualRegisterForm({
  platform,
  setPlatform,
  handle,
  setHandle,
  onSubmit,
  isPending,
  disabled = false,
}: Props) {
  const { t } = useTranslation();
  return (
    <section className="section-card p-5 sm:p-6" aria-labelledby="manual-channel-heading">
      <h2 id="manual-channel-heading" className="text-base font-semibold">
        {t("channels.manualTitle")}
      </h2>
      <p
        id="manual-channel-hint"
        className="mb-4 mt-2 text-sm leading-relaxed text-muted-foreground"
      >
        {t("channels.manualHint")}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (handle.trim() && !isPending && !disabled) onSubmit();
        }}
        className="grid items-end gap-3 md:grid-cols-[auto_1fr_auto]"
        aria-describedby="manual-channel-hint"
      >
        <div className="space-y-1.5">
          <label htmlFor="manual-channel-platform" className="text-sm font-medium">
            {t("channels.platform")}
          </label>
          <select
            disabled={disabled || isPending}
            id="manual-channel-platform"
            value={platform}
            onChange={(event) => setPlatform(event.target.value as PlatformId)}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {PLATFORMS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="manual-channel-handle" className="text-sm font-medium">
            {t("channels.handle")}
          </label>
          <input
            disabled={disabled || isPending}
            id="manual-channel-handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            placeholder={t("channels.handlePlaceholder")}
            required
            maxLength={80}
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || isPending || !handle.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="size-4" />{" "}
          {t(isPending ? "channels.registering" : "channels.register")}
        </button>
      </form>
    </section>
  );
}
