import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { TrustOSService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { useWorkspaceMutation } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResultPanel } from "./ResultPanel";
import type { TargetType, TrustChecks, TrustResult } from "../types";

export function TrustAnalyzerTab() {
  const [workspaceId] = useCurrentWorkspaceId(null);
  const [target_name, setTargetName] = useState("");
  const [target_type, setTargetType] = useState<TargetType>("instagram");
  const [source_url, setSourceUrl] = useState("");
  const [observations, setObservations] = useState("");

  const run = useServerFn(TrustOSService.runTrustAnalyzer);
  const mutation = useWorkspaceMutation(
    () =>
      run({
        data: {
          workspaceId: workspaceId!,
          target_name,
          target_type,
          source_url: source_url || undefined,
          observations,
        },
      }),
    { successMessage: "Análise de confiança concluída." },
  );

  const result = mutation.data as TrustResult<TrustChecks> | undefined;
  const checks = result?.checks ?? {};

  const disabled =
    mutation.isPending ||
    !workspaceId ||
    target_name.length < 2 ||
    observations.length < 20;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="section-card p-5">
        <h3 className="mb-4 text-base font-semibold">Analisar alvo</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={target_type} onValueChange={(v) => setTargetType(v as TargetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="website">Site</SelectItem>
                  <SelectItem value="course">Curso / Mentoria</SelectItem>
                  <SelectItem value="supplier">Fornecedor</SelectItem>
                  <SelectItem value="person">Pessoa / Guru</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={target_name}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder="@perfil ou nome"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>URL (opcional)</Label>
            <Input
              value={source_url}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={6}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Descreva o que você viu: tipo de conteúdo, promessas, depoimentos, preços, sinais que te incomodaram..."
            />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={disabled} className="w-full">
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Analisando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> Analisar com IA
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="section-card p-5">
        <h3 className="mb-4 text-base font-semibold">Resultado</h3>
        {!result ? (
          <EmptyState text="Sem análise ainda. Preencha o formulário e rode a IA." />
        ) : (
          <ResultPanel
            risk_score={result.risk_score}
            verdict={result.verdict}
            summary={result.summary ?? ""}
            recommendation={checks.recommendation}
            sections={[
              { title: "Sinais de confiança", items: checks.trust_signals ?? [], tone: "good" },
              { title: "Sinais de alerta", items: checks.red_flags ?? [], tone: "bad" },
              { title: "Perguntas para fazer", items: checks.questions_to_ask ?? [], tone: "neutral" },
            ]}
          />
        )}
      </section>
    </div>
  );
}
