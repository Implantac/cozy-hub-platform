import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarRange, Download, FileSpreadsheet, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";

/** Authenticated downloads only; no email scheduling is implied by this card. */
export function WeeklyReportCard({ workspaceId }: { workspaceId: string | null | undefined }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  async function download(format: "pdf" | "csv") {
    if (!workspaceId || busy) return;
    setBusy(format);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error(t("analytics.reportSessionExpired"));
        return;
      }
      const response = await fetch(
        `/api/reports/weekly?workspaceId=${encodeURIComponent(workspaceId)}&format=${format}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: AbortSignal.timeout(30_000),
        },
      );
      const expectedType = format === "pdf" ? "application/pdf" : "text/csv";
      if (!response.ok || !response.headers.get("content-type")?.includes(expectedType)) {
        toast.error(
          t(response.status === 401 ? "analytics.reportSessionExpired" : "analytics.reportFailed"),
        );
        return;
      }
      const blob = await response.blob();
      if (!blob.size) {
        toast.error(t("analytics.reportFailed"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t("analytics.reportGenerated"));
    } catch {
      toast.error(t("analytics.reportNetworkError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      title={t("analytics.weeklyTitle")}
      description={t("analytics.weeklyDescription")}
      icon={CalendarRange}
    >
      <div className="space-y-3" aria-busy={busy !== null}>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("analytics.weeklyContents")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-11 gap-2"
            onClick={() => void download("pdf")}
            disabled={!workspaceId || busy !== null}
          >
            {busy === "pdf" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-4" />
            )}
            {t("analytics.downloadPdf")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 gap-2"
            onClick={() => void download("csv")}
            disabled={!workspaceId || busy !== null}
          >
            {busy === "csv" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet aria-hidden="true" className="size-4" />
            )}
            {t("analytics.downloadCsv")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("analytics.reportLanguage")}</p>
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <Mail aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t("analytics.emailUnavailable")}
        </p>
      </div>
    </SectionCard>
  );
}
