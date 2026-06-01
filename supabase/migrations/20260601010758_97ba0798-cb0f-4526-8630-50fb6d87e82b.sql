
REVOKE EXECUTE ON FUNCTION public.claim_scheduler_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_scheduler_job(uuid, text)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_scheduler_job(uuid, text)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_analytics_snapshot(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_workspace_owner()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_workspace_seed()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at()        FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_workspace_role(uuid, app_role[], uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_workspace_role(uuid)               FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_publication(uuid, uuid[], timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_brain_memories(uuid, vector, integer)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_default_templates(uuid)               FROM anon;

DROP POLICY IF EXISTS wm_update_admin ON public.workspace_members;

CREATE POLICY wm_update_admin ON public.workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    user_id <> auth.uid()
    AND has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[])
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND has_workspace_role(workspace_id, ARRAY['owner','admin']::app_role[])
    AND (
      role <> 'owner'::app_role
      OR has_workspace_role(workspace_id, ARRAY['owner']::app_role[])
    )
  );

DELETE FROM public.domain_events WHERE workspace_id IS NULL;

ALTER TABLE public.domain_events
  ALTER COLUMN workspace_id SET NOT NULL;
