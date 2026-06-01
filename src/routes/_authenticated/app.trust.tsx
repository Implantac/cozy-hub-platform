import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Shield, ShieldAlert, ShieldCheck, ShoppingCart, Loader2, AlertTriangle,
  CheckCircle2, XCircle, History, Sparkles, ExternalLink,
} from "lucide-react";
import { TrustOSService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { useWorkspaceQuery, useWorkspaceMutation } from "@/lib/query/use-workspace-query";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/trust")({
  component: TrustOSPage,
});

function TrustOSPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Trust OS"
        subtitle="Analise perfis, cursos, fornecedores e produtos antes de investir tempo ou dinheiro."
        icon={Shield}
      />
      <Tabs defaultValue="analyzer" className="space-y-4">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="analyzer" className="gap-2">
            <ShieldAlert className="size-4" /> Trust Analyzer
          </TabsTrigger>
          <TabsTrigger value="buy" className="gap-2">
            <ShoppingCart className="size-4" /> Before You Buy
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="analyzer" className="space-y-4">
          <TrustAnalyzerTab />
        </TabsContent>
        <TabsContent value="buy" className="space-y-4">
          <BeforeYouBuyTab />
        </TabsContent>
        <TabsContent value="history" className="space-y-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 * Verdict helpers
 * ============================================================ */
function trustVerdictTone(v: string): { color: string; bg: string; label: string; Icon: typeof ShieldCheck } {
  switch (v) {
    case "safe": return { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Seguro", Icon: ShieldCheck };
    case "caution": return { color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "Atenção", Icon: AlertTriangle };
    case "risky": return { color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30", label: "Arriscado", Icon: ShieldAlert };
    case "avoid": return { color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", label: "Evitar", Icon: XCircle };
    case "buy": return { color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30", label: "Pode comprar", Icon: CheckCircle2 };
    case "negotiate": return { color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30", label: "Negocie", Icon: Sparkles };
    case "wait": return { color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30", label: "Aguarde", Icon: AlertTriangle };
    case "skip": return { color: "text-red-500", bg: "bg-red-500/10 border-red-500/30", label: "Não compre", Icon: XCircle };
    default: return { color: "text-muted-foreground", bg: "bg-muted/10 border-border", label: v, Icon: Shield };
  }
}

function ScoreBar({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const v = Math.max(0, Math.min(100, value));
  const good = inverse ? v < 50 : v >= 50;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{v}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${good ? "bg-emerald-500" : v >= 25 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

function BulletList({ title, items, tone }: { title: string; items: string[]; tone: "good" | "bad" | "neutral" }) {
  if (!items?.length) return null;
  const color = tone === "good" ? "text-emerald-500" : tone === "bad" ? "text-red-500" : "text-muted-foreground";
  const Icon = tone === "good" ? CheckCircle2 : tone === "bad" ? XCircle : Sparkles;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <Icon className={`mt-0.5 size-3.5 shrink-0 ${color}`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
 * Trust Analyzer
 * ============================================================ */
function TrustAnalyzerTab() {
  const [workspaceId] = useCurrentWorkspaceId(null);
  const [target_name, setTargetName] = useState("");
  const [target_type, setTargetType] = useState<"instagram" | "youtube" | "tiktok" | "website" | "course" | "supplier" | "person" | "other">("instagram");
  const [source_url, setSourceUrl] = useState("");
  const [observations, setObservations] = useState("");

  const run = useServerFn(TrustOSService.runTrustAnalyzer);
  const mutation = useWorkspaceMutation(
    () => run({
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

  const result = mutation.data;
  const checks = (result?.checks ?? {}) as {
    trust_signals?: string[];
    red_flags?: string[];
    questions_to_ask?: string[];
    recommendation?: string;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 text-base font-semibold">Analisar alvo</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={target_type} onValueChange={(v) => setTargetType(v as typeof target_type)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input value={target_name} onChange={(e) => setTargetName(e.target.value)} placeholder="@perfil ou nome" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>URL (opcional)</Label>
            <Input value={source_url} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
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
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !workspaceId || target_name.length < 2 || observations.length < 20}
            className="w-full"
          >
            {mutation.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" /> Analisando...</> : <><Sparkles className="mr-2 size-4" /> Analisar com IA</>}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
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
      </Card>
    </div>
  );
}

/* ============================================================
 * Before You Buy
 * ============================================================ */
function BeforeYouBuyTab() {
  const [workspaceId] = useCurrentWorkspaceId(null);
  const [product_name, setProductName] = useState("");
  const [seller, setSeller] = useState("");
  const [price_brl, setPrice] = useState<number>(0);
  const [promise, setPromise] = useState("");
  const [source_url, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");

  const run = useServerFn(TrustOSService.runBeforeYouBuy);
  const mutation = useWorkspaceMutation(
    () => run({
      data: {
        workspaceId: workspaceId!,
        product_name, seller, price_brl, promise,
        source_url: source_url || undefined,
        notes: notes || undefined,
      },
    }),
    { successMessage: "Avaliação concluída." },
  );

  const result = mutation.data;
  const checks = (result?.checks ?? {}) as {
    value_for_money?: number;
    promise_realism?: number;
    hidden_costs?: string[];
    comparison_alternatives?: string[];
    questions_for_seller?: string[];
    red_flags?: string[];
    green_flags?: string[];
    final_recommendation?: string;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 text-base font-semibold">Antes de comprar</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Produto/Serviço</Label>
              <Input value={product_name} onChange={(e) => setProductName(e.target.value)} placeholder="Curso X, Mentoria Y..." />
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor</Label>
              <Input value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="@guru ou empresa" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$)</Label>
              <Input type="number" value={price_brl || ""} onChange={(e) => setPrice(Number(e.target.value))} placeholder="1997" />
            </div>
            <div className="space-y-1.5">
              <Label>URL (opcional)</Label>
              <Input value={source_url} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
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
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !workspaceId || product_name.length < 2 || seller.length < 2 || promise.length < 20}
            className="w-full"
          >
            {mutation.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" /> Avaliando...</> : <><Sparkles className="mr-2 size-4" /> Avaliar com IA</>}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
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
              { title: "Alternativas", items: checks.comparison_alternatives ?? [], tone: "neutral" },
              { title: "Perguntas para o vendedor", items: checks.questions_for_seller ?? [], tone: "neutral" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

/* ============================================================
 * Result Panel (shared)
 * ============================================================ */
function ResultPanel({
  risk_score, verdict, summary, recommendation, sections, extraScores,
}: {
  risk_score: number;
  verdict: string;
  summary: string;
  recommendation?: string;
  sections: Array<{ title: string; items: string[]; tone: "good" | "bad" | "neutral" }>;
  extraScores?: Array<{ label: string; value: number }>;
}) {
  const tone = trustVerdictTone(verdict);
  return (
    <div className="space-y-5">
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${tone.bg}`}>
        <tone.Icon className={`size-7 ${tone.color}`} />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Veredito</div>
          <div className={`text-lg font-bold ${tone.color}`}>{tone.label}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Risco</div>
          <div className="font-mono text-2xl font-bold">{risk_score}</div>
        </div>
      </div>

      {summary && <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>}

      {extraScores && (
        <div className="grid grid-cols-2 gap-4">
          {extraScores.map((s) => <ScoreBar key={s.label} label={s.label} value={s.value} />)}
        </div>
      )}

      {recommendation && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">Recomendação</div>
          {recommendation}
        </div>
      )}

      <div className="space-y-4">
        {sections.map((s) => <BulletList key={s.title} {...s} />)}
      </div>
    </div>
  );
}

/* ============================================================
 * History
 * ============================================================ */
function HistoryTab() {
  const [workspaceId] = useCurrentWorkspaceId(null);
  const list = useServerFn(TrustOSService.listTrustReports);
  const q = useQuery({
    queryKey: ["trust-reports", workspaceId],
    queryFn: () => list({ data: { workspaceId: workspaceId! } }),
    enabled: !!workspaceId,
  });

  if (q.isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando...</div>;
  const rows = q.data ?? [];
  if (rows.length === 0) return <EmptyState text="Sem análises. Rode no Trust Analyzer ou Before You Buy." />;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const tone = trustVerdictTone(r.verdict);
        const isBuy = r.target_type === "before_you_buy";
        const isTrust = r.target_type?.startsWith("trust:");
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className={`grid size-10 shrink-0 place-items-center rounded-lg border ${tone.bg}`}>
                <tone.Icon className={`size-5 ${tone.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.target_name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {isBuy ? "Before You Buy" : isTrust ? r.target_type.replace("trust:", "") : r.target_type}
                  </Badge>
                  <Badge className={`text-[10px] ${tone.color} ${tone.bg}`} variant="outline">
                    {tone.label} · {r.risk_score}
                  </Badge>
                </div>
                {r.summary && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.summary}</p>}
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                  {r.source_url && (
                    <a href={r.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      <ExternalLink className="size-3" /> Fonte
                    </a>
                  )}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
