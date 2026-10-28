GRANT SELECT, INSERT, UPDATE, DELETE ON public.bio_pages, public.bio_links TO authenticated;
GRANT SELECT ON public.bio_link_clicks TO authenticated;
GRANT ALL ON public.bio_pages, public.bio_links, public.bio_link_clicks TO service_role;
REVOKE EXECUTE ON FUNCTION public.bio_register_click(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bio_register_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bio_register_click(uuid, text, text, text), public.bio_register_view(text) TO service_role;