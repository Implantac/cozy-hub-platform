import { useTranslation } from "react-i18next";

export function QueryErrorState({
  onRetry,
  pending = false,
}: {
  onRetry: () => void;
  pending?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <section role="alert" className="section-card space-y-3 p-6">
      <h2 className="text-lg font-semibold">{t("errors.dataUnavailable")}</h2>
      <p className="text-sm text-muted-foreground">{t("errors.retryHint")}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={pending}
        className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {t(pending ? "common.loading" : "common.tryAgain")}
      </button>
    </section>
  );
}
