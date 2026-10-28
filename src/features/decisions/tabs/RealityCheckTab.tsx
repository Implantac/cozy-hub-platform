import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Shield, Sparkles } from "lucide-react";
import { DecisionOSService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RealityCard } from "../components/RealityCard";

export function RealityCheckTab() {
  const [changeType, setChangeType] = useState<string>("pivot");
  const [currentState, setCurrentState] = useState("");
  const [proposed, setProposed] = useState("");

  const runFn = useServerFn(DecisionOSService.runRealityCheck);
  const listFn = useServerFn(DecisionOSService.listRealityChecks);

  const list = useWorkspaceQuery(
    (wsId) => ["reality-checks", wsId],
    ({ workspaceId }) => listFn({ data: { workspaceId } }),
  );
  const wsId = list.wsId;

  const run = useWorkspaceMutation(
    () =>
      runFn({
        data: {
          workspaceId: wsId!,
          change_type: changeType as any,
          current_state: currentState,
          proposed_change: proposed,
        },
      }),
    {
      invalidate: wsId ? ["reality-checks", wsId] : ["reality-checks"],
      successMessage: "Reality check concluído",
      onSuccess: () => {
        setCurrentState("");
        setProposed("");
      },
    },
  );

  return (
    <div className="space-y-6">
      <div className="section-card p-5 animate-rise-in">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-brand">
              <Shield className="size-4 text-primary-foreground" />
            </div>
            <h3 className="font-semibold">Antes de mudar, faça um reality check</h3>
          </div>

          <div className="space-y-2">
            <Label>Tipo de mudança</Label>
            <Select value={changeType} onValueChange={setChangeType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pivot">Pivô / mudar de direção</SelectItem>
                <SelectItem value="new_channel">Abrir novo canal</SelectItem>
                <SelectItem value="new_offer">Lançar nova oferta</SelectItem>
                <SelectItem value="scale_up">Escalar / aumentar investimento</SelectItem>
                <SelectItem value="stop">Parar / desistir de algo</SelectItem>
                <SelectItem value="investment">Investir dinheiro/tempo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cur">Estado atual</Label>
            <Textarea
              id="cur"
              rows={3}
              placeholder="O que está acontecendo hoje? Quais resultados você está vendo?"
              value={currentState}
              onChange={(e) => setCurrentState(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prop">Mudança proposta</Label>
            <Textarea
              id="prop"
              rows={3}
              placeholder="O que você está pensando em mudar? Por quê?"
              value={proposed}
              onChange={(e) => setProposed(e.target.value)}
              maxLength={2000}
            />
          </div>

          <Button
            disabled={currentState.length < 20 || proposed.length < 20 || run.isPending}
            onClick={() => run.mutate()}
            className="gap-2"
          >
            {run.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Analisando...
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Fazer reality check
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Histórico
        </h3>
        {!list.data || list.data.length === 0 ? (
          <EmptyState
            variant="dashed"
            icon={Shield}
            title="Nenhum reality check ainda"
            text="Submeta um plano acima para receber uma análise crítica de riscos e premissas."
          />
        ) : (
          list.data.map((r: any) => <RealityCard key={r.id} r={r} />)
        )}
      </div>
    </div>
  );
}
