-- Tighten read access on integrations: config jsonb may contain secrets
DROP POLICY IF EXISTS integrations_read ON public.integrations;

CREATE POLICY integrations_read ON public.integrations
  FOR SELECT
  TO authenticated
  USING (has_workspace_role(workspace_id, ARRAY['owner'::app_role, 'admin'::app_role]));