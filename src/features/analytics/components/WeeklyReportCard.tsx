import { useState } from "react";
import { CalendarRange, Download, FileSpreadsheet, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/app/SectionCard";
import { Button } from "@/components/ui/button";

/**
 * Weekly report download.
 *
 * The file comes from an authenticated route, so the request needs the user's
 * access token. `getSession()` is preferred over `getUser()` here: it reads the
 * cached session instead of making a network round trip, and the server is the
 * one that validates the token anyway.
 *
 * Deliberately no "schedule an email" toggle: the product has no transactional
 * email pipeline yet, and a switch that silently does nothing is worse than no
 * switch. The copy says what exists.
 */
export function WeeklyReportCard({ workspaceId }: { workspaceId: string | null | undefined }) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);

  async function download(format: "pdf" | "csv") {
    if (!workspaceId) return;
    setBusy(format);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Entre novamente para baixar o relatório.");
        return;
      }

      const res = await fetch(
        `/api/reports/weekly?workspaceId=${encodeURIComponent(workspaceId)}&format=${format}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "erro desconhecido" }));
        toast.error(body.error ?? "Não foi possível gerar o relatório.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        format === "pdf"
          ? `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.pdf`
          : `relatorio-semanal-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success("Relatório gerado.");
    } catch {
      toast.error("Falha de rede ao gerar o relatório.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SectionCard
      title="Relatório semanal"
      description="Sete dias comparados com os sete anteriores."
      icon={CalendarRange}
    >
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          PDF de uma página com publicações, impressões, engajamento por canal e os três melhores
          posts. O CSV traz os mesmos números para conferência.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-2"
            onClick={() => void download("pdf")}
            disabled={!workspaceId || busy !== null}
          >
            {busy === "pdf" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            Baixar PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => void download("csv")}
            disabled={!workspaceId || busy !== null}
          >
            {busy === "csv" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            CSV
          </Button>
        </div>

        <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
          <Mail className="mt-0.5 size-3 shrink-0" />O envio automático por e-mail depende de um
          provedor transacional, que ainda não está configurado.
        </p>
      </div>
    </SectionCard>
  );
}
