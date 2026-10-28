import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  addBioLink,
  checkSlugAvailability,
  deleteBioLink,
  getBioPage,
  getBioPageStats,
  reorderBioLinks,
  setBioPagePublished,
  updateBioLink,
  upsertBioPage,
} from "@/lib/api/bio.functions";
import { slugify, validateSlug, type LinkKind } from "@/lib/bio/validate";
import { useWorkspaceMutation, useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export interface BioPageRow {
  id: string;
  workspace_id: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  theme: string;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface BioLinkRow {
  id: string;
  page_id: string;
  label: string;
  url: string;
  kind: string;
  icon: string | null;
  position: number;
  is_active: boolean;
  click_count: number;
  created_at: string;
}

export interface BioDraft {
  slug: string;
  headline: string;
  bio: string;
  avatarUrl: string;
  theme: "aurora" | "minimal" | "sunset";
}

const EMPTY: BioDraft = { slug: "", headline: "", bio: "", avatarUrl: "", theme: "aurora" };

export function useBioPage() {
  const fetchPage = useServerFn(getBioPage);
  const savePage = useServerFn(upsertBioPage);
  const publish = useServerFn(setBioPagePublished);
  const add = useServerFn(addBioLink);
  const update = useServerFn(updateBioLink);
  const remove = useServerFn(deleteBioLink);
  const reorder = useServerFn(reorderBioLinks);
  const stats = useServerFn(getBioPageStats);
  const checkSlug = useServerFn(checkSlugAvailability);

  const q = useWorkspaceQuery<{ page: BioPageRow | null; links: BioLinkRow[] }>(
    (wsId) => ["bio", wsId],
    ({ workspaceId }) => fetchPage({ data: { workspaceId } }),
  );
  const invalidate = q.wsId ? ["bio", q.wsId] : ["bio"];

  const page = q.data?.page ?? null;
  // Memoised: `?? []` creates a new array on every render, which would make every
  // callback that depends on `links` re-create itself and defeat memoisation.
  const links = useMemo(() => q.data?.links ?? [], [q.data]);

  const [draft, setDraft] = useState<BioDraft>(EMPTY);
  const [slugState, setSlugState] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string | null;
  }>({ checking: false, available: null, message: null });

  // Hydrate the form once the row arrives, and re-hydrate after a save returns a
  // normalised slug (the server lowercases and strips accents).
  useEffect(() => {
    if (!page) return;
    setDraft({
      slug: page.slug,
      headline: page.headline ?? "",
      bio: page.bio ?? "",
      avatarUrl: page.avatar_url ?? "",
      theme: (page.theme as BioDraft["theme"]) ?? "aurora",
    });
  }, [page]);

  // Always fetched: the server short-circuits and returns empty series when the
  // workspace has no page yet, so there is nothing to save by skipping it.
  const statsQ = useWorkspaceQuery<Awaited<ReturnType<typeof stats>>>(
    (wsId) => ["bio-stats", wsId],
    ({ workspaceId }) => stats({ data: { workspaceId, days: 30 } }),
  );

  const slugPreview = useMemo(() => slugify(draft.slug), [draft.slug]);
  const slugErrors = useMemo(() => {
    if (!draft.slug) return null;
    const v = validateSlug(draft.slug);
    return v.ok ? null : v.error;
  }, [draft.slug]);

  /** Debounced availability check — one request per pause, not per keystroke. */
  const verifySlug = useCallback(
    async (raw: string) => {
      if (!raw) return;
      const v = validateSlug(raw);
      if (!v.ok) {
        // `error` is optional on the failure branch of the union.
        setSlugState({ checking: false, available: false, message: v.error ?? "Link inválido." });
        return;
      }
      // Unchanged slug on an existing page: no lookup needed.
      if (page && v.slug === page.slug) {
        setSlugState({ checking: false, available: true, message: null });
        return;
      }
      setSlugState({ checking: true, available: null, message: null });
      try {
        const res = await checkSlug({ data: { slug: raw } });
        setSlugState({
          checking: false,
          available: res.available,
          message: res.available ? null : (res.error ?? "Indisponível."),
        });
      } catch {
        setSlugState({ checking: false, available: null, message: "Não foi possível verificar." });
      }
    },
    [checkSlug, page],
  );

  useEffect(() => {
    if (!draft.slug || draft.slug.length < 3) return;
    const t = setTimeout(() => void verifySlug(draft.slug), 450);
    return () => clearTimeout(t);
  }, [draft.slug, verifySlug]);

  const saveMut = useWorkspaceMutation(
    () =>
      savePage({
        data: {
          workspaceId: q.wsId!,
          slug: draft.slug,
          headline: draft.headline || null,
          bio: draft.bio || null,
          avatarUrl: draft.avatarUrl || null,
          theme: draft.theme,
        },
      }),
    { invalidate, successMessage: "Página salva" },
  );

  const publishMut = useWorkspaceMutation(
    (published: boolean) => publish({ data: { workspaceId: q.wsId!, published } }),
    {
      invalidate,
      successMessage: (row) =>
        row.is_published ? "Página publicada — o link já está no ar" : "Página despublicada",
    },
  );

  const addLinkMut = useWorkspaceMutation(
    (input: { label: string; kind: LinkKind; raw: string; message?: string }) =>
      add({ data: { workspaceId: q.wsId!, ...input } }),
    { invalidate, successMessage: "Link adicionado" },
  );

  const updateLinkMut = useWorkspaceMutation(
    (input: { id: string; label?: string; raw?: string; kind?: LinkKind; isActive?: boolean }) =>
      update({ data: { workspaceId: q.wsId!, ...input } }),
    { invalidate },
  );

  const removeLinkMut = useWorkspaceMutation(
    (id: string) => remove({ data: { workspaceId: q.wsId!, id } }),
    { invalidate, successMessage: "Link removido" },
  );

  const reorderMut = useWorkspaceMutation(
    (orderedIds: string[]) => reorder({ data: { workspaceId: q.wsId!, orderedIds } }),
    { invalidate },
  );

  /** Moves a link one position up/down and persists the whole order. */
  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      const ids = links.map((l) => l.id);
      const i = ids.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      reorderMut.mutate(ids);
    },
    [links, reorderMut],
  );

  const copyLink = useCallback(async () => {
    if (!page) return;
    const url = `${window.location.origin}/bio/${page.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar — selecione manualmente: " + url);
    }
  }, [page]);

  return {
    q,
    page,
    links,
    draft,
    setDraft,
    slugPreview,
    slugErrors,
    slugState,
    stats: statsQ.data ?? null,
    saveMut,
    publishMut,
    addLinkMut,
    updateLinkMut,
    removeLinkMut,
    reorderMut,
    move,
    copyLink,
  };
}
