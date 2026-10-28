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
import { ResultPanel } from "./ResultPanel";
import type { BuyChecks, TrustResult } from "../types";

export function BeforeYouBuyTab() {
  const [workspaceId] = useCurrentWorkspaceId(null);
  const [product_name, setProductName] = useState("");
  const [seller, setSeller] = useState("");
  const [price_brl, setPrice] = useState<number>(0);
  const [promise, setPromise] = useState("");
  const [source_url, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");

  const run = useServerFn(TrustOSService.runBeforeYouBuy);
  const mutation = useWorkspaceMutation(
    () =>
      run({
        data: {
          workspaceId: workspaceId!,
          product_name,
          seller,
          price_brl,
          promise,
          source_url: source_url || undefined,
          notes: notes || undefined,
        },
      }),
    { successMessage: "Avaliação concluída." },
  );

  const result = mutation.data as TrustResult<BuyChecks> | undefined;
  const checks = result?.checks ?? {};

  const disabled =
    mutation.isPending ||
    !workspaceId ||
    product_name.length < 2 ||
    seller.length < 2 ||
    promise.length < 20;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="section-card p-5">
        <h3 className="mb-4 text-base font-semibold">Antes de comprar</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Produto/Serviço</Label>
              <Input
                value={product_name}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Curso X, Mentoria Y..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Input
                value={seller}
                onChange={(e) => setSeller(e.target.value)}
                placeholder="@guru ou empresa"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                value={price_brl || ""}
                onChange={(e) => setPrice(Number(e.target.value))}
                placeholder="1997"
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL (opcional)</Label>
              <Input
                value={source_url}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Promessa principal</Label>
            <Textarea
              rows={4}
              value={promise}
              onChange={(e) => setPromise(e.target.value)}
              placeholder="O que o vendedor promete? Resultado, prazo, garantia..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Suas notas (opcional)</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto, dúvidas, o que te atraiu..."
            />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={disabled} className="w-full">
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Avaliando...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" /> Avaliar com IA
              </>
            )}
          </Button>
        </div>
      </section>

      <section className="section-card p-5">
        <h3 className="mb-4 text-base font-semibold">Veredito</h3>
        {!result ? (
          <EmptyState text="Sem avaliação ainda. Descreva a compra e rode a IA antes de pagar." />
        ) : (
          <ResultPanel
            risk_score={result.risk_score}
            verdict={result.verdict}
            summary={result.summary ?? ""}
            recommendation={checks.final_recommendation}
            extraScores={[
              { label: "Custo-benefício", value: checks.value_for_money ?? 0 },
              { label: "Realismo da promessa", value: checks.promise_realism ?? 0 },
            ]}
            sections={[
              { title: "Pontos positivos", items: checks.green_flags ?? [], tone: "good" },
              { title: "Pontos de alerta", items: checks.red_flags ?? [], tone: "bad" },
              { title: "Custos escondidos", items: checks.hidden_costs ?? [], tone: "bad" },
              {
                title: "Alternativas",
                items: checks.comparison_alternatives ?? [],
                tone: "neutral",
              },
              {
                title: "Perguntas para o vendedor",
                items: checks.questions_for_seller ?? [],
                tone: "neutral",
              },
            ]}
          />
        )}
      </section>
    </div>
  );
}
