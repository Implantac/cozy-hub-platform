import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Loader2, Sparkles } from "lucide-react";
import { DecisionOSService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ValidationCard } from "../components/ValidationCard";

export function BusinessValidatorTab() {
  const [idea, setIdea] = useState("");
  const [model, setModel] = useState("");
  const [audience, setAudience] = useState("");

  const validateFn = useServerFn(DecisionOSService.validateBusinessIdea);
  const listFn = useServerFn(DecisionOSService.listBusinessValidations);

  const list = useWorkspaceQuery(
    (wsId) => ["business-validations", wsId],
    ({ workspaceId }) => listFn({ data: { workspaceId } }),
  );
  const wsId = list.wsId;

  const validate = useWorkspaceMutation(
    () =>
      validateFn({
        data: {
          workspaceId: wsId!,
          idea,
          business_model: model || undefined,
          target_audience: audience || undefined,
        },
      }),
    {
      invalidate: wsId ? ["business-validations", wsId] : ["business-validations"],
      successMessage: "Validação concluída",
      onSuccess: () => {
        setIdea("");
        setModel("");
        setAudience("");
      },
    },
  );

  return (
    <div className="space-y-6">
      <div className="section-card p-5 animate-rise-in">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand">
              <Lightbulb className="size-4 text-primary-foreground" />
            </div>
            <h3 className="font-semibold">Validar ideia de negócio</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="idea">Ideia (mínimo 20 caracteres)</Label>
            <Textarea
              id="idea"
              rows={4}
              placeholder="Ex: Curso online para freelancers de design aprenderem a precificar projetos..."
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo de negócio (opcional)</Label>
              <Input
                id="model"
                placeholder="Ex: assinatura mensal, produto digital..."
                value={model}
                onChange={(e) => setModel(e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Público-alvo (opcional)</Label>
              <Input
                id="audience"
                placeholder="Ex: freelancers, pequenos lojistas..."
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                maxLength={300}
              />
            </div>
          </div>

          <Button
            disabled={idea.length < 20 || validate.isPending}
            onClick={() => validate.mutate()}
            className="gap-2"
          >
            {validate.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analisando com IA...
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Validar com IA
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Validações anteriores
        </h3>
        {!list.data || list.data.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={Lightbulb}
            title="Nenhuma validação ainda"
            text="Use o formulário acima para validar sua primeira ideia com IA."
          />
        ) : (
          list.data.map((v: any) => <ValidationCard key={v.id} v={v} />)
        )}
      </div>
    </div>
  );
}
