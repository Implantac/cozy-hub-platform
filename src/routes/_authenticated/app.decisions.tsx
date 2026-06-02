import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Lightbulb, AlertTriangle, Loader2, Sparkles, TrendingUp, Shield,
  CheckCircle2, XCircle, AlertCircle, ArrowRight, Target,
} from "lucide-react";
import { DecisionOSService } from "@/lib/services";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { PageHeader } from "@/components/app/PageHeader";

import { EmptyState } from "@/components/app/EmptyState";
import { PageTransition } from "@/components/app/Motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/decisions")({
  component: DecisionOSPage,
});

function DecisionOSPage() {
  return (
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Decision OS"
        subtitle="Valide ideias, faça reality checks e decida com clareza antes de executar."
        icon={Target}
      />
      <Tabs defaultValue="validator" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="validator" className="gap-2">
            <Lightbulb className="size-4" /> Validador
          </TabsTrigger>
          <TabsTrigger value="reality" className="gap-2">
            <AlertTriangle className="size-4" /> Reality Check
          </TabsTrigger>
        </TabsList>
        <TabsContent value="validator" className="space-y-4">
          <BusinessValidatorTab />
        </TabsContent>
        <TabsContent value="reality" className="space-y-4">
          <RealityCheckTab />
        </TabsContent>
      </Tabs>
    </div>
    </PageTransition>
  );
}

/* ============================================================
 * Business Validator
 * ============================================================ */
function BusinessValidatorTab() {
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
      onSuccess: () => { setIdea(""); setModel(""); setAudience(""); },
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
              id="idea" rows={4}
              placeholder="Ex: Curso online para freelancers de design aprenderem a precificar projetos..."
              value={idea} onChange={(e) => setIdea(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">Modelo de negócio (opcional)</Label>
              <Input id="model" placeholder="Ex: assinatura mensal, produto digital..."
                value={model} onChange={(e) => setModel(e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audience">Público-alvo (opcional)</Label>
              <Input id="audience" placeholder="Ex: freelancers, pequenos lojistas..."
                value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={300} />
            </div>
          </div>

          <Button
            disabled={idea.length < 20 || validate.isPending}
            onClick={() => validate.mutate()}
            className="gap-2"
          >
            {validate.isPending
              ? <><Loader2 className="size-4 animate-spin" /> Analisando com IA...</>
              : <><Sparkles className="size-4" /> Validar com IA</>}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Validações anteriores</h3>
        {!list.data || list.data.length === 0
          ? <EmptyState variant="dashed" icon={Lightbulb} title="Nenhuma validação ainda" text="Use o formulário acima para validar sua primeira ideia com IA." />
          : list.data.map((v: any) => <ValidationCard key={v.id} v={v} />)}
      </div>
    </div>
  );
}

function ValidationCard({ v }: { v: any }) {
  const verdictMap: Record<string, { label: string; tone: string }> = {
    strong: { label: "Forte", tone: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    promising: { label: "Promissora", tone: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
    challenging: { label: "Desafiadora", tone: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    weak: { label: "Fraca", tone: "bg-red-500/15 text-red-600 border-red-500/30" },
  };
  const verdict = verdictMap[v.verdict] ?? verdictMap.challenging;

  return (
    <div className="section-card p-5 space-y-4 animate-rise-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium line-clamp-2">{v.idea}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(v.created_at).toLocaleString("pt-BR")} · {v.model_used}
          </p>
        </div>
        <Badge className={`shrink-0 border ${verdict.tone}`}>{verdict.label}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ScorePill label="Oportunidade" value={v.opportunity_score} tone="primary" />
        <ScorePill label="Demanda" value={v.market_demand_score} tone="emerald" />
        <ScorePill label="Concorrência" value={v.competition_score} tone="amber" invert />
        <ScorePill label="Complexidade" value={v.complexity_score} tone="rose" invert />
      </div>

      {v.ai_analysis?.summary && (
        <p className="text-sm leading-relaxed border-l-2 border-primary/40 pl-3">{v.ai_analysis.summary}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ListBlock icon={CheckCircle2} title="Forças" tone="text-emerald-600" items={v.strengths ?? []} />
        <ListBlock icon={AlertCircle} title="Riscos" tone="text-amber-600" items={v.risks ?? []} />
      </div>

      {v.next_steps?.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Próximos passos</span>
          </div>
          <ol className="space-y-1.5 text-sm">
            {v.next_steps.map((s: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary font-semibold">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, value, tone, invert }: { label: string; value: number; tone: string; invert?: boolean }) {
  const effective = invert ? 100 - value : value;
  const colorClass =
    effective >= 70 ? "text-emerald-600"
    : effective >= 40 ? "text-amber-600"
    : "text-rose-600";
  return (
    <div className="rounded-lg border border-border bg-card/40 p-2.5">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function ListBlock({ icon: Icon, title, tone, items }: { icon: any; title: string; tone: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2 ${tone}`}>
        <Icon className="size-3.5" /> {title}
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{it}</span></li>)}
      </ul>
    </div>
  );
}

/* ============================================================
 * Reality Check
 * ============================================================ */
function RealityCheckTab() {
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
      onSuccess: () => { setCurrentState(""); setProposed(""); },
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
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Textarea id="cur" rows={3}
              placeholder="O que está acontecendo hoje? Quais resultados você está vendo?"
              value={currentState} onChange={(e) => setCurrentState(e.target.value)} maxLength={2000} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prop">Mudança proposta</Label>
            <Textarea id="prop" rows={3}
              placeholder="O que você está pensando em mudar? Por quê?"
              value={proposed} onChange={(e) => setProposed(e.target.value)} maxLength={2000} />
          </div>

          <Button
            disabled={currentState.length < 20 || proposed.length < 20 || run.isPending}
            onClick={() => run.mutate()}
            className="gap-2"
          >
            {run.isPending
              ? <><Loader2 className="size-4 animate-spin" /> Analisando...</>
              : <><Sparkles className="size-4" /> Fazer reality check</>}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico</h3>
        {!list.data || list.data.length === 0
          ? <EmptyState variant="dashed" icon={Shield} title="Nenhum reality check ainda" text="Submeta um plano acima para receber uma análise crítica de riscos e premissas." />
          : list.data.map((r: any) => <RealityCard key={r.id} r={r} />)}
      </div>
    </div>
  );
}

function RealityCard({ r }: { r: any }) {
  const cautionMap: Record<string, { label: string; icon: any; ringClass: string; chipClass: string; barClass: string }> = {
    green: { label: "Siga em frente", icon: CheckCircle2, ringClass: "ring-emerald-500/40", chipClass: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", barClass: "bg-emerald-500" },
    yellow: { label: "Cuidado", icon: AlertTriangle, ringClass: "ring-amber-500/40", chipClass: "bg-amber-500/15 text-amber-600 border-amber-500/30", barClass: "bg-amber-500" },
    red: { label: "Não recomendado", icon: XCircle, ringClass: "ring-rose-500/40", chipClass: "bg-rose-500/15 text-rose-600 border-rose-500/30", barClass: "bg-rose-500" },
  };
  const cau = cautionMap[r.caution_level] ?? cautionMap.yellow;
  const CauIcon = cau.icon;

  return (
    <div className={`section-card p-5 space-y-4 ring-1 ${cau.ringClass} animate-rise-in`}>
      <div className={`h-1 -m-5 mb-2 ${cau.barClass}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Badge variant="outline" className="mb-2">{r.change_type}</Badge>
          <p className="text-sm font-medium">{r.proposed_change}</p>
          <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("pt-BR")}</p>
        </div>
        <Badge className={`shrink-0 border gap-1 ${cau.chipClass}`}>
          <CauIcon className="size-3" /> {cau.label}
        </Badge>
      </div>

      {r.summary && <p className="text-sm leading-relaxed border-l-2 border-primary/40 pl-3">{r.summary}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <ListBlock icon={TrendingUp} title="Indicadores positivos" tone="text-emerald-600" items={r.indicators_positive ?? []} />
        <ListBlock icon={AlertCircle} title="Sinais de alerta" tone="text-amber-600" items={r.indicators_warning ?? []} />
      </div>

      {r.questions_to_answer?.length > 0 && (
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide mb-2">Perguntas a responder antes de decidir</div>
          <ul className="space-y-1.5 text-sm">
            {r.questions_to_answer.map((q: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="text-primary">?</span><span>{q}</span></li>
            ))}
          </ul>
        </div>
      )}

      {r.recommendations?.length > 0 && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowRight className="size-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide">Recomendações</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {r.recommendations.map((s: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="text-primary">→</span><span>{s}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
