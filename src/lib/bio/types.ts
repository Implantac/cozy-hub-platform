/**
 * Shared bio types.
 *
 * Split out of `public.server.ts` so client components can type their props
 * without importing a module that constructs the service-role Supabase client.
 * Type-only imports are usually erased, but `PublicBioView` also imported
 * `themeFor` from the same file, which defeated the erasure and pulled the server
 * module into the browser bundle.
 */
export interface PublicBioLink {
  id: string;
  label: string;
  url: string;
  kind: string;
  icon: string | null;
}

export interface PublicBioPage {
  slug: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  theme: string;
  seoTitle: string | null;
  seoDescription: string | null;
  workspaceName: string;
  links: PublicBioLink[];
}
