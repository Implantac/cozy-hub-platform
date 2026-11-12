-- Explicit privileges for the bio tables and server-only SECURITY DEFINER RPCs.
-- Row access for authenticated users remains constrained by the RLS policies
-- created in 20261028140000_bio_pages.sql.

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.bio_pages, public.bio_links
  TO authenticated;

GRANT SELECT
  ON TABLE public.bio_link_clicks
  TO authenticated;

GRANT ALL PRIVILEGES
  ON TABLE public.bio_pages, public.bio_links, public.bio_link_clicks
  TO service_role;

-- PostgreSQL grants EXECUTE to PUBLIC by default for newly-created functions.
-- These SECURITY DEFINER functions are only for the trusted server client.
REVOKE EXECUTE
  ON FUNCTION public.bio_register_click(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE
  ON FUNCTION public.bio_register_view(text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.bio_register_click(uuid, text, text, text),
       public.bio_register_view(text)
  TO service_role;
