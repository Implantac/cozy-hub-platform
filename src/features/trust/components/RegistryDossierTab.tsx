import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Globe,
  HelpCircle,
  Loader2,
  ShieldQuestion,
  XCircle,
} from "lucide-react";
import { TrustOSService } from "@/lib/services";
import { useCurrentWorkspaceId } from "@/lib/workspace/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseCnpj, parseDomain, type TrustSignal } from "@/lib/trust/signals";
import type { Dossier } from "@/lib/trust/dossier.server";

/**
 * Registry-backed due diligence.
 *
 * The layout is ordered by decreasing certainty: verdict → evidence → raw record
 * → your notes. Notes are last and visibly separated because they no longer
 * affect the score — a deliberate change from the previous version, where the
 * user's own paragraph was the only input and therefore the answer.
 *
 * Every signal renders its `evidence` line. A trust product that says "risky"
 * without showing the date it read is indistinguishable from a horoscope.
 */
export function RegistryDossierTab() {
  const [workspaceId] = useCurrentWorkspaceId(null);
  const [cnpj, setCnpj] = useState("");
  const [site, setSite] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");

  const run = useServerFn(TrustOSService.runRegistryDossier);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Dossier | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Client-side checksum gives instant feedback and blocks a pointless request.
  const cnpjCheck = cnpj.trim() ? parseCnpj(cnpj) : null;
  const domainCheck = site.trim() ? parseDomain(site) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setRejection(null);
    if (!workspaceId) return;
    setPending(true);
    try {
      const res = await run({
        data: {
          workspaceId,
          cnpj: cnpj.trim() || undefined,
          site: site.trim() || undefined,
          label: label.trim() || undefined,
          observations: notes.trim() || undefined,
        },
      });
      if (!res.ok) {
        setRejection(res.reason);
        setResult(null);
        return;
      }
      setResult(res.dossier as Dossier);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao consultar os registros.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form onSubmit={submit} className="section-card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="size-4 text-accent" />
          <h3 className="text-sm font-semibold">Consultar registros públicos</h3>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Consulta a Receita Federal (via BrasilAPI) e o registro de domínios (RDAP). O score vem
          dos fatos devolvidos, com a data ao lado — você pode refazer a mesma consulta.
        </p>

        <div className="space-y-2">
          <Label htmlFor="dossier-cnpj">CNPJ</Label>
          <Input
            id="dossier-cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
          />
          {cnpjCheck && !cnpjCheck.ok && (
            <p className="text-[11px] text-destructive">
              {cnpjCheck.reason === "checksum"
                ? "Os dígitos verificadores não fecham — há um erro de digitação aqui."
                : cnpjCheck.reason === "length"
                  ? "CNPJ tem 14 dígitos."
                  : "Número inválido."}
            </p>
          )}
          {cnpjCheck?.ok && (
            <p className="text-[11px] text-muted-foreground">
              CNPJ válido: <span className="font-mono">{cnpjCheck.formatted}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dossier-site">Site</Label>
          <Input
            id="dossier-site"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="loja.com.br"
          />
          {domainCheck && !domainCheck.ok && (
            <p className="text-[11px] text-muted-foreground">
              {domainCheck.reason === "free_host"
                ? "Plataforma gratuita não tem registro próprio — use o CNPJ."
                : domainCheck.reason === "ip"
                  ? "IP não tem registro público."
                  : "Site inválido."}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dossier-label">Nome (opcional)</Label>
          <Input
            id="dossier-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Quem é este alvo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dossier-notes">Suas anotações (opcional)</Label>
          <Textarea
            id="dossier-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="O que você observou. Fica salvo no relatório, mas não altera o score."
          />
          <p className="text-[11px] text-muted-foreground">
            O score vem só de registros públicos. Suas notas ficam registradas à parte.
          </p>
        </div>

        <Button
          type="submit"
          disabled={pending || (!cnpj.trim() && !site.trim())}
          className="w-full gap-2"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
          {pending ? "Consultando registros…" : "Gerar dossiê"}
        </Button>

        {rejection && <p className="text-xs text-destructive">{rejection}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      <div className="space-y-4">
        {!result && !pending && (
          <div className="section-card grid place-items-center p-10 text-center">
            <div className="max-w-sm space-y-2">
              <HelpCircle className="mx-auto size-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Nenhuma consulta ainda</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Informe um CNPJ ou o site. Se as fontes públicas estiverem fora do ar, o resultado
                dirá isso — não vai inventar um risco.
              </p>
            </div>
          </div>
        )}

        {result && <DossierView dossier={result} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const LEVEL_META = {
  high: { icon: CheckCircle2, className: "text-emerald-500", label: "Confiança alta" },
  moderate: { icon: AlertTriangle, className: "text-amber-500", label: "Atenção" },
  low: { icon: XCircle, className: "text-destructive", label: "Risco" },
  insufficient: { icon: HelpCircle, className: "text-muted-foreground", label: "Sem dados" },
} as const;

function DossierView({ dossier }: { dossier: Dossier }) {
  const v = dossier.verdict;
  const meta = LEVEL_META[v.level];
  const Icon = meta.icon;

  return (
    <>
      {/* Verdict */}
      <div className="section-card space-y-3 p-5">
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 size-6 shrink-0 ${meta.className}`} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{meta.label}</h3>
              {v.level !== "insufficient" && (
                <Badge variant="secondary" className="tabular-nums">
                  {v.score}/100
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{v.headline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            Lido em {new Date(dossier.fetchedAt).toLocaleString("pt-BR")}
          </span>
          {v.verifiedCount > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400">
              {v.verifiedCount} confirmação(ões)
            </span>
          )}
          {v.riskCount > 0 && (
            <span className="text-destructive">{v.riskCount} sinal(is) de risco</span>
          )}
        </div>

        {dossier.sources.notes.length > 0 && (
          <div className="space-y-1 rounded-lg border border-border bg-secondary/30 p-3">
            {dossier.sources.notes.map((n, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-muted-foreground">
                {n}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Evidence */}
      <div className="section-card space-y-2 p-5">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Sinais
        </h4>
        {v.signals.map((s) => (
          <SignalRow key={s.id} signal={s} />
        ))}
      </div>

      {/* Raw records */}
      {dossier.company && (
        <div className="section-card space-y-3 p-5">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Building2 className="size-3" /> Registro na Receita
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Field label="Razão social" value={dossier.company.razaoSocial} wide />
            <Field label="Situação" value={dossier.company.situacao} />
            <Field label="Porte" value={dossier.company.porte ?? "—"} />
            <Field label="Natureza" value={dossier.company.naturezaJuridica ?? "—"} />
            <Field label="Atividade" value={dossier.company.cnae ?? "—"} />
            <Field
              label="Cidade"
              value={
                dossier.company.municipio
                  ? `${dossier.company.municipio}/${dossier.company.uf ?? ""}`
                  : "—"
              }
            />
            <Field label="Sócios" value={String(dossier.company.socios)} />
          </dl>
          <a
            href={`https://brasilapi.com.br/api/cnpj/v1/${dossier.company.cnpj.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-4 hover:underline"
          >
            Refazer esta consulta <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {dossier.domain && (
        <div className="section-card space-y-3 p-5">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Globe className="size-3" /> Registro do domínio
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Field label="Domínio" value={dossier.domain.host} wide />
            <Field label="Registrado" value={fmt(dossier.domain.registeredAt)} />
            <Field label="Expira" value={fmt(dossier.domain.expiresAt)} />
          </dl>
        </div>
      )}
    </>
  );
}

function SignalRow({ signal }: { signal: TrustSignal }) {
  const tones = {
    verified: { icon: CheckCircle2, color: "text-emerald-500", border: "border-emerald-500/30" },
    attention: { icon: AlertTriangle, color: "text-amber-500", border: "border-amber-500/30" },
    risk: { icon: XCircle, color: "text-destructive", border: "border-destructive/30" },
    unknown: { icon: HelpCircle, color: "text-muted-foreground", border: "border-border" },
  } as const;
  const t = tones[signal.level];
  const Icon = t.icon;

  return (
    <div className={`rounded-lg border px-3 py-2 ${t.border}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-3.5 shrink-0 ${t.color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug">{signal.title}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {signal.detail}
          </p>
          {signal.evidence && (
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-foreground/60">
              {signal.evidence}
            </p>
          )}
        </div>
        {signal.weight !== 0 && (
          <span
            className={`shrink-0 text-[10px] tabular-nums ${signal.weight > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            {signal.weight > 0 ? "+" : ""}
            {signal.weight}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xs text-foreground">{value}</dd>
    </div>
  );
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
}
