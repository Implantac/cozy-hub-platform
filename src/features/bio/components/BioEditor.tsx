import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/components/app/SectionCard";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useBioPage, type BioLinkRow } from "../hooks/useBioPage";
import { LINK_KINDS, type LinkKind } from "@/lib/bio/validate";
import { themeFor } from "@/lib/bio/theme";
import { BioPhonePreview } from "./BioPhonePreview";

/**
 * Bio page editor.
 *
 * Layout rationale: editing on the left, a live phone preview on the right. A
 * link-in-bio page is judged on a 390px screen, and every competitor's editor
 * that hides the result behind a "preview" tab gets the same complaint — the
 * owner can't see that their headline wraps into four lines. The preview is
 * sticky so the cause and the effect stay on screen together.
 */
export function BioEditor() {
  const {
    q,
    page,
    links,
    draft,
    setDraft,
    slugPreview,
    slugErrors,
    slugState,
    stats,
    saveMut,
    publishMut,
    addLinkMut,
    updateLinkMut,
    removeLinkMut,
    move,
    copyLink,
  } = useBioPage();

  const [newLabel, setNewLabel] = useState("");
  const [newRaw, setNewRaw] = useState("");
  const [newKind, setNewKind] = useState<LinkKind>("link");

  const isPublished = page?.is_published ?? false;
  const publicUrl = page ? `/bio/${page.slug}` : null;
  const slugBlocked = Boolean(slugErrors) || slugState.available === false;

  function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newRaw.trim()) return;
    addLinkMut.mutate(
      { label: newLabel.trim(), kind: newKind, raw: newRaw.trim() },
      {
        onSuccess: () => {
          setNewLabel("");
          setNewRaw("");
        },
      },
    );
  }

  if (q.isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <Skeleton className="h-[520px] w-full" />
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorState
        error={q.error as Error}
        onRetry={() => {
          void q.refetch();
        }}
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {/* ---------------- Identification ---------------- */}
        <SectionCard title="Endereço da página" icon={Globe} description="Um por workspace.">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio-slug">Link</Label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  /bio/
                </span>
                <Input
                  id="bio-slug"
                  value={draft.slug}
                  placeholder="seu-negocio"
                  maxLength={32}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                  aria-invalid={slugBlocked}
                />
              </div>
              <SlugFeedback
                raw={draft.slug}
                preview={slugPreview}
                error={slugErrors}
                state={slugState}
                currentSlug={page?.slug ?? null}
              />
            </div>

            {publicUrl && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyLink()}
                  className="gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar link
                </Button>
                {isPublished ? (
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir página
                    </a>
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Publique para liberar o link público.
                  </span>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        {/* ---------------- Content ---------------- */}
        <SectionCard title="Conteúdo" icon={Eye}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio-headline">Título</Label>
              <Input
                id="bio-headline"
                value={draft.headline}
                maxLength={80}
                placeholder="Ex.: Padaria Vila Nova"
                onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">{draft.headline.length}/80</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio-text">Descrição</Label>
              <textarea
                id="bio-text"
                value={draft.bio}
                maxLength={500}
                rows={3}
                placeholder="Uma frase que diz o que você faz e para quem."
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <p className="text-xs text-muted-foreground">{draft.bio.length}/500</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio-avatar">URL da foto</Label>
              <Input
                id="bio-avatar"
                value={draft.avatarUrl}
                placeholder="https://..."
                onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Tema</Label>
              <Select
                value={draft.theme}
                onValueChange={(v) => setDraft({ ...draft, theme: v as typeof draft.theme })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aurora">Aurora (escuro)</SelectItem>
                  <SelectItem value="minimal">Minimal (claro)</SelectItem>
                  <SelectItem value="sunset">Sunset (quente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || slugBlocked || !draft.slug}
              >
                {saveMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {page ? "Salvar alterações" : "Criar página"}
              </Button>

              {page && (
                <Button
                  variant={isPublished ? "outline" : "default"}
                  onClick={() => publishMut.mutate(!isPublished)}
                  disabled={publishMut.isPending}
                >
                  {publishMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPublished ? "Despublicar" : "Publicar"}
                </Button>
              )}

              {page && (
                <Badge variant={isPublished ? "default" : "secondary"} className="self-center">
                  {isPublished ? "No ar" : "Rascunho"}
                </Badge>
              )}
            </div>
          </div>
        </SectionCard>

        {/* ---------------- Links ---------------- */}
        <SectionCard
          title="Links"
          description="Cada link passa por /bio/click para contar cliques."
          icon={ExternalLink}
        >
          {!page ? (
            <p className="text-sm text-muted-foreground">Crie a página para adicionar links.</p>
          ) : (
            <div className="space-y-4">
              <ul className="space-y-2">
                {links.map((link, i) => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    first={i === 0}
                    last={i === links.length - 1}
                    onMove={move}
                    onToggle={(isActive) => updateLinkMut.mutate({ id: link.id, isActive })}
                    onRemove={() => removeLinkMut.mutate(link.id)}
                  />
                ))}
                {links.length === 0 && (
                  <li className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Nenhum link ainda. Adicione o primeiro abaixo.
                  </li>
                )}
              </ul>

              <form onSubmit={submitLink} className="space-y-3 rounded-lg border p-3">
                <div className="grid gap-2 sm:grid-cols-[110px_1fr]">
                  <Select value={newKind} onValueChange={(v) => setNewKind(v as LinkKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LINK_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Rótulo (ex.: Fale no WhatsApp)"
                    maxLength={60}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newRaw}
                    onChange={(e) => setNewRaw(e.target.value)}
                    placeholder={kindPlaceholder(newKind)}
                  />
                  <Button
                    type="submit"
                    disabled={addLinkMut.isPending || !newLabel.trim() || !newRaw.trim()}
                  >
                    {addLinkMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{kindHint(newKind)}</p>
              </form>
            </div>
          )}
        </SectionCard>

        {/* ---------------- Stats ---------------- */}
        {stats?.page && (
          <SectionCard title="Últimos 30 dias" description="Sem cookies, sem dado pessoal.">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatBox label="Visitas" value={stats.page.view_count} />
              <StatBox
                label="Cliques"
                value={stats.clicksByLink.reduce((a, b) => a + b.click_count, 0)}
              />
              <StatBox
                label="Taxa de clique"
                value={
                  stats.page.view_count > 0
                    ? `${Math.round(
                        (stats.clicksByLink.reduce((a, b) => a + b.click_count, 0) /
                          stats.page.view_count) *
                          100,
                      )}%`
                    : "—"
                }
              />
            </div>
            {stats.clicksByLink.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {stats.clicksByLink.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted-foreground">{l.label}</span>
                    <span className="font-medium tabular-nums">{l.click_count}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>

      {/* ---------------- Preview ---------------- */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <BioPhonePreview
          headline={draft.headline || (page ? "Sua página" : "Prévia")}
          bio={draft.bio}
          avatarUrl={draft.avatarUrl}
          theme={draft.theme}
          links={links}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SlugFeedback({
  raw,
  preview,
  error,
  state,
  currentSlug,
}: {
  raw: string;
  preview: string;
  error: string | null | undefined;
  state: { checking: boolean; available: boolean | null; message: string | null };
  currentSlug: string | null;
}) {
  if (!raw) return null;

  if (error) return <p className="text-xs text-destructive">{error}</p>;

  if (state.checking)
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Verificando disponibilidade…
      </p>
    );

  if (state.available === false)
    return <p className="text-xs text-destructive">{state.message ?? "Indisponível."}</p>;

  const isCurrent = currentSlug && preview === currentSlug;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Check className="h-3 w-3 text-emerald-500" />
      velt.app/bio/<span className="font-medium text-foreground">{preview}</span>
      {isCurrent && <span className="ml-1">(atual)</span>}
    </p>
  );
}

function LinkRow({
  link,
  first,
  last,
  onMove,
  onToggle,
  onRemove,
}: {
  link: BioLinkRow;
  first: boolean;
  last: boolean;
  onMove: (id: string, dir: -1 | 1) => void;
  onToggle: (isActive: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border bg-card/60 px-2 py-2">
      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => onMove(link.id, -1)}
          disabled={first}
          className="text-muted-foreground transition hover:text-foreground disabled:opacity-30"
          aria-label="Mover para cima"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(link.id, 1)}
          disabled={last}
          className="text-muted-foreground transition hover:text-foreground disabled:opacity-30"
          aria-label="Mover para baixo"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={
              link.is_active
                ? "truncate text-sm font-medium"
                : "truncate text-sm font-medium line-through opacity-50"
            }
          >
            {link.label}
          </span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {link.kind}
          </Badge>
        </div>
        <p className="truncate text-xs text-muted-foreground">{link.url}</p>
      </div>

      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {link.click_count} cliques
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onToggle(!link.is_active)}
        title={link.is_active ? "Ocultar da página" : "Mostrar na página"}
      >
        <Eye className={link.is_active ? "h-3.5 w-3.5" : "h-3.5 w-3.5 opacity-40"} />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
        onClick={onRemove}
        title="Remover"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function kindPlaceholder(kind: LinkKind): string {
  switch (kind) {
    case "whatsapp":
      return "11 99999-9999";
    case "email":
      return "contato@seunegocio.com";
    case "phone":
      return "11 3333-4444";
    default:
      return "https://...";
  }
}

function kindHint(kind: LinkKind): string {
  switch (kind) {
    case "whatsapp":
      return "Digite só o número com DDD. O link de wa.me é montado automaticamente.";
    case "email":
      return "Abre o app de e-mail do visitante.";
    case "phone":
      return "Abre o discador no celular.";
    case "product":
      return "Link para produto, catálogo ou checkout.";
    default:
      return "Apenas http ou https.";
  }
}
