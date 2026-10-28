-- =========================================================
-- VELT — Google Business Profile como plataforma publicável
--
-- Benchmarks de 2026 são unânimes: entre Buffer, Later, Hootsuite e Metricool,
-- só o Metricool agenda no Google Business Profile. Para o público do VELT —
-- negócio local, `business_path = 'local_business'` — a "presença local" começa
-- no Google, não no Instagram. Esta migration abre o canal.
--
-- Nota de compatibilidade: o publisher usa a Business Profile API v4
-- (`mybusiness.googleapis.com/v4/.../localPosts`), escopo
-- `business.manage`, e exige que a conta tenha Location(s) verificada(s).
-- =========================================================

do $$
begin
  begin
    alter type public.social_platform add value if not exists 'google_business';
  exception
    when duplicate_object then null;
  end;
end
$$;

-- O nome do recurso do Google é longo (`accounts/123/locations/456`) e não cabe
-- confortavelmente em `external_id` quando somado a um handle. Metadados
-- adicionais ficam em `metadata`, que já é jsonb.

comment on column public.channels.metadata is
  'Config por canal. Para google_business guarda account_id, location_id, location_name e store_code.';
