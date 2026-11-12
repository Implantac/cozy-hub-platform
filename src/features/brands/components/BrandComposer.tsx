import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

type Props = {
  name: string;
  description: string;
  isPending: boolean;
  disabled?: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSubmit: () => void;
};

export function BrandComposer({
  name,
  description,
  isPending,
  disabled = false,
  onNameChange,
  onDescriptionChange,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="section-card p-5 sm:p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length >= 2 && !isPending && !disabled) onSubmit();
        }}
        className="grid items-end gap-3 md:grid-cols-[1fr_2fr_auto]"
      >
        <div className="space-y-1.5">
          <label htmlFor="brand-name" className="text-sm font-medium">
            {t("brands.name")}
          </label>
          <input
            disabled={disabled || isPending}
            id="brand-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={t("brands.name")}
            required
            minLength={2}
            maxLength={80}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="brand-description" className="text-sm font-medium">
            {t("brands.description")}
          </label>
          <input
            disabled={disabled || isPending}
            id="brand-description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={t("brands.description")}
            maxLength={2000}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || isPending || name.trim().length < 2}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          <Plus aria-hidden="true" className="size-4" />{" "}
          {t(isPending ? "brands.creating" : "brands.create")}
        </button>
      </form>
    </div>
  );
}
