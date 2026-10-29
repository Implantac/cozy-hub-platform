import { createFileRoute, notFound } from "@tanstack/react-router";
import { loadBio } from "@/lib/bio/public.functions";
import type { PublicBioPage } from "@/lib/bio/types";
import { themeFor } from "@/lib/bio/theme";
import { PublicBioView } from "@/features/bio/components/PublicBioView";

/**
 * Public bio page — the product's only anonymous surface.
 *
 * The loader runs on the server so the page is fully rendered: SEO matters here,
 * because the whole point is a link that gets shared in a social bio. It also
 * registers the view server-side, which a client-side beacon cannot do reliably
 * (ad blockers, JS disabled).
 */

/** Sentinel for "the database is down", distinct from "this page does not exist". */
type LoaderData = PublicBioPage | { unavailable: true };

export const Route = createFileRoute("/bio/$slug")({
  loader: async ({ params }): Promise<LoaderData> => {
    const result = await loadBio({ data: { slug: params.slug } });

    // Missing page, unpublished page and malformed slug are intentionally
    // indistinguishable: 404 with no hint about which slugs exist.
    if (result.status === "not_found") throw notFound();

    // A broken deployment is not a deleted page. It gets its own screen, and it
    // is marked noindex so a misconfigured environment never gets a real page
    // indexed by search engines.
    if (result.status === "unavailable") {
      // `setResponseStatus` from the loader is a no-op in the SSR handler, so the
      // HTTP status for this state is 200 by construction. The state is still
      // clearly marked: noindex, distinct copy, and a retry button. Returning a
      // real 503 would need a raw server route, which would mean giving up the
      // router's meta handling — not worth it for an infra-only edge case.
      return { unavailable: true };
    }

    return result.page;
  },

  head: ({ loaderData }) => {
    const data = loaderData as LoaderData | undefined;

    if (data && "unavailable" in data) {
      return {
        meta: [
          { title: "Temporariamente indisponível · VELT" },
          { name: "robots", content: "noindex,nofollow" },
        ],
      };
    }

    const page = data as PublicBioPage | undefined;
    const title = page?.seoTitle ?? page?.headline ?? page?.workspaceName ?? "VELT";
    const description =
      page?.seoDescription ?? page?.bio ?? "Links, contato e ofertas em um só lugar.";

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        ...(page?.avatarUrl ? [{ property: "og:image", content: page.avatarUrl }] : []),
        { name: "robots", content: "index,follow" },
        { name: "theme-color", content: "#0b1020" },
      ],
    };
  },

  component: BioPage,

  notFoundComponent: () => (
    <Shell title="Página não encontrada">
      <p className="text-sm text-muted-foreground">
        Este link não existe ou ainda não foi publicado.
      </p>
      <a href="/" className="inline-block text-sm text-primary underline-offset-4 hover:underline">
        Conhecer o VELT
      </a>
    </Shell>
  ),

  errorComponent: () => (
    <Shell title="Algo deu errado">
      <p className="text-sm text-muted-foreground">Tente novamente em instantes.</p>
    </Shell>
  ),
});

function BioPage() {
  const data = Route.useLoaderData() as LoaderData;

  if ("unavailable" in data) {
    return (
      <Shell title="Temporariamente indisponível">
        <p className="text-sm text-muted-foreground">
          Não conseguimos carregar esta página agora. Tente de novo em alguns instantes.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Tentar novamente
        </button>
      </Shell>
    );
  }

  return <PublicBioView page={data} theme={themeFor(data.theme)} />;
}

/** Shared frame for the three non-content states: 404, 503, and render errors. */
function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}
