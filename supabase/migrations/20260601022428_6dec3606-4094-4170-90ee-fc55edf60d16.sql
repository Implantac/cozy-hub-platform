
-- ENUMS
CREATE TYPE public.experience_level AS ENUM ('beginner','intermediate','advanced');
CREATE TYPE public.business_path AS ENUM ('local_business','content_creator','affiliate','digital_services','saas_builder','agency','freelancer','ecommerce');
CREATE TYPE public.maturity_level AS ENUM ('seed','sprout','growth','established','scaling');
CREATE TYPE public.opportunity_status AS ENUM ('exploding','growing','stable','saturated','declining');
CREATE TYPE public.opportunity_level AS ENUM ('low','medium','high');
CREATE TYPE public.health_category AS ENUM ('marketing','content','brand','channel','growth');
CREATE TYPE public.coach_kind AS ENUM ('insight','warning','suggestion','next_action');
CREATE TYPE public.coach_severity AS ENUM ('info','low','medium','high','critical');

-- 1. user_profile_digital
CREATE TABLE public.user_profile_digital (
  user_id UUID PRIMARY KEY,
  experience_level experience_level NOT NULL DEFAULT 'beginner',
  business_path business_path,
  goals TEXT[] NOT NULL DEFAULT '{}',
  time_budget_hours_week INT NOT NULL DEFAULT 5,
  money_budget_monthly NUMERIC(12,2) NOT NULL DEFAULT 0,
  preferred_channels TEXT[] NOT NULL DEFAULT '{}',
  content_preferences TEXT[] NOT NULL DEFAULT '{}',
  maturity_level maturity_level NOT NULL DEFAULT 'seed',
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile_digital TO authenticated;
GRANT ALL ON public.user_profile_digital TO service_role;
ALTER TABLE public.user_profile_digital ENABLE ROW LEVEL SECURITY;
CREATE POLICY upd_select_own ON public.user_profile_digital FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY upd_insert_own ON public.user_profile_digital FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY upd_update_own ON public.user_profile_digital FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY upd_delete_own ON public.user_profile_digital FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_upd_touch BEFORE UPDATE ON public.user_profile_digital FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. digital_scores
CREATE TABLE public.digital_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  overall INT NOT NULL DEFAULT 0,
  presence INT NOT NULL DEFAULT 0,
  branding INT NOT NULL DEFAULT 0,
  content INT NOT NULL DEFAULT 0,
  consistency INT NOT NULL DEFAULT 0,
  growth INT NOT NULL DEFAULT 0,
  channel_setup INT NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_digital_scores_ws ON public.digital_scores(workspace_id, computed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.digital_scores TO authenticated;
GRANT ALL ON public.digital_scores TO service_role;
ALTER TABLE public.digital_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY ds_read ON public.digital_scores FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY ds_write ON public.digital_scores FOR INSERT TO authenticated WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY ds_update ON public.digital_scores FOR UPDATE TO authenticated USING (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[])) WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));

-- 3. opportunities
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  niche TEXT,
  status opportunity_status NOT NULL DEFAULT 'growing',
  difficulty opportunity_level NOT NULL DEFAULT 'medium',
  competition opportunity_level NOT NULL DEFAULT 'medium',
  growth_potential opportunity_level NOT NULL DEFAULT 'medium',
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_opp_ws ON public.opportunities(workspace_id);
CREATE INDEX idx_opp_status ON public.opportunities(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY opp_read ON public.opportunities FOR SELECT TO authenticated USING (workspace_id IS NULL OR is_workspace_member(workspace_id));
CREATE POLICY opp_write ON public.opportunities FOR INSERT TO authenticated WITH CHECK (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY opp_update ON public.opportunities FOR UPDATE TO authenticated USING (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[])) WITH CHECK (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY opp_delete ON public.opportunities FOR DELETE TO authenticated USING (workspace_id IS NOT NULL AND has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));

-- 4. learning_paths (public catalog)
CREATE TABLE public.learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  difficulty experience_level NOT NULL DEFAULT 'beginner',
  estimated_hours INT NOT NULL DEFAULT 1,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_for business_path[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.learning_paths TO authenticated;
GRANT ALL ON public.learning_paths TO service_role;
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY lp_read_all ON public.learning_paths FOR SELECT TO authenticated USING (true);

-- 5. learning_path_progress
CREATE TABLE public.learning_path_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID,
  path_id UUID NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  completed_milestones TEXT[] NOT NULL DEFAULT '{}',
  progress_pct INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, path_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_path_progress TO authenticated;
GRANT ALL ON public.learning_path_progress TO service_role;
ALTER TABLE public.learning_path_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY lpp_select_own ON public.learning_path_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY lpp_insert_own ON public.learning_path_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY lpp_update_own ON public.learning_path_progress FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY lpp_delete_own ON public.learning_path_progress FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_lpp_touch BEFORE UPDATE ON public.learning_path_progress FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. health_metrics
CREATE TABLE public.health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  category health_category NOT NULL,
  score INT NOT NULL DEFAULT 0,
  strengths TEXT[] NOT NULL DEFAULT '{}',
  weaknesses TEXT[] NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_health_ws_cat ON public.health_metrics(workspace_id, category, computed_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_metrics TO authenticated;
GRANT ALL ON public.health_metrics TO service_role;
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY hm_read ON public.health_metrics FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY hm_write ON public.health_metrics FOR INSERT TO authenticated WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY hm_update ON public.health_metrics FOR UPDATE TO authenticated USING (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[])) WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));

-- 7. coach_recommendations
CREATE TABLE public.coach_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID,
  kind coach_kind NOT NULL DEFAULT 'suggestion',
  severity coach_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  cta JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC NOT NULL DEFAULT 0,
  dismissed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coach_ws ON public.coach_recommendations(workspace_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_recommendations TO authenticated;
GRANT ALL ON public.coach_recommendations TO service_role;
ALTER TABLE public.coach_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY cr_read ON public.coach_recommendations FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY cr_write ON public.coach_recommendations FOR INSERT TO authenticated WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY cr_update ON public.coach_recommendations FOR UPDATE TO authenticated USING (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[])) WITH CHECK (has_workspace_role(workspace_id, ARRAY['owner','admin','editor']::app_role[]));
CREATE POLICY cr_delete ON public.coach_recommendations FOR DELETE TO authenticated USING (has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[]));
CREATE TRIGGER trg_cr_touch BEFORE UPDATE ON public.coach_recommendations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.coach_recommendations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_scores;

-- Seed learning paths
INSERT INTO public.learning_paths(slug,title,description,category,difficulty,estimated_hours,milestones,recommended_for) VALUES
('first-clients','Conseguir os Primeiros Clientes','Da definição de oferta ao fechamento do primeiro cliente.','growth','beginner',6,
 '[{"id":"offer","title":"Definir oferta clara"},{"id":"audience","title":"Identificar audiência"},{"id":"channels","title":"Escolher 2 canais"},{"id":"outreach","title":"Fazer 20 contatos"},{"id":"first-sale","title":"Fechar 1ª venda"}]'::jsonb,
 ARRAY['freelancer','digital_services','agency']::business_path[]),
('build-audience','Construir uma Audiência','Crescer de 0 para 1.000 seguidores engajados.','growth','beginner',12,
 '[{"id":"niche","title":"Definir nicho"},{"id":"bio","title":"Otimizar bio"},{"id":"content-pillars","title":"Definir pilares de conteúdo"},{"id":"posting","title":"Postar 30 dias seguidos"},{"id":"engagement","title":"Engajar 50 contas/dia"}]'::jsonb,
 ARRAY['content_creator','affiliate']::business_path[]),
('launch-service','Lançar um Serviço Digital','Empacotar e vender seu primeiro serviço.','sales','intermediate',8,
 '[{"id":"package","title":"Empacotar serviço"},{"id":"price","title":"Definir preço"},{"id":"sales-page","title":"Criar página de vendas"},{"id":"traffic","title":"Gerar tráfego"},{"id":"convert","title":"Fechar primeiras vendas"}]'::jsonb,
 ARRAY['digital_services','agency','saas_builder']::business_path[]),
('start-content','Começar a Criar Conteúdo','Do zero ao primeiro post publicado consistentemente.','content','beginner',4,
 '[{"id":"setup","title":"Configurar perfis"},{"id":"first-post","title":"Publicar 1º post"},{"id":"first-reel","title":"Publicar 1º reel"},{"id":"first-week","title":"7 dias publicando"}]'::jsonb,
 ARRAY['content_creator','local_business','affiliate']::business_path[]),
('grow-local','Crescer um Negócio Local','Atrair clientes da sua região com presença digital.','local','beginner',10,
 '[{"id":"gbp","title":"Criar Google Business Profile"},{"id":"reviews","title":"Coletar 10 avaliações"},{"id":"local-content","title":"Postar conteúdo local"},{"id":"whatsapp","title":"WhatsApp Business ativo"},{"id":"local-ads","title":"Testar anúncio local"}]'::jsonb,
 ARRAY['local_business']::business_path[]);

-- Seed global opportunities
INSERT INTO public.opportunities(title,description,niche,status,difficulty,competition,growth_potential,tags,actions) VALUES
('IA aplicada a pequenos negócios','Automatizar tarefas de PMEs com agentes de IA. Demanda crescente, poucos players especializados.','ai',
 'exploding','medium','low','high',ARRAY['ai','automation','b2b'],
 '[{"label":"Criar oferta de auditoria de IA"},{"label":"Publicar 3 cases de automação"}]'::jsonb),
('Conteúdo educacional curto (TikTok/Reels)','Vídeos de 30-60s ensinando uma habilidade específica. Algoritmo ainda premia novos criadores.','content',
 'growing','low','high','high',ARRAY['video','education','short-form'],
 '[{"label":"Escolher 1 microhabilidade"},{"label":"Publicar 30 vídeos em 30 dias"}]'::jsonb),
('Serviços para criadores de conteúdo','Edição, thumbnail, roteiro, gestão de comunidade. Mercado em expansão.','services',
 'growing','low','medium','high',ARRAY['creator-economy','b2c'],
 '[{"label":"Empacotar serviço de edição"},{"label":"Prospectar 20 criadores"}]'::jsonb),
('SaaS micro-vertical','Software resolvendo 1 dor de 1 nicho específico. Bootstrap-friendly.','saas',
 'growing','high','medium','high',ARRAY['saas','niche','b2b'],
 '[{"label":"Entrevistar 10 potenciais clientes"},{"label":"Validar com landing page"}]'::jsonb),
('WhatsApp como canal de vendas','Catálogos, automações e atendimento via WhatsApp Business API.','channel',
 'exploding','low','medium','high',ARRAY['whatsapp','sales','local'],
 '[{"label":"Ativar WhatsApp Business"},{"label":"Configurar respostas rápidas"}]'::jsonb),
('Newsletter por nicho','Email continua com a maior taxa de conversão. Newsletters de nicho monetizam rápido.','content',
 'stable','low','medium','medium',ARRAY['email','newsletter'],
 '[{"label":"Escolher nicho"},{"label":"Publicar 4 edições"}]'::jsonb);
