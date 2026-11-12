-- Aplicada no Supabase VELT ycyizzvvmyooqspzyajv em 12/11/2026.
-- INSERT ... RETURNING é avaliado antes de o trigger AFTER INSERT criar
-- workspace_members. Permitir a leitura pelo próprio proprietário resolve o
-- bootstrap sem abrir o workspace a usuários sem vínculo.
ALTER POLICY "ws_select_member" ON public.workspaces
USING (owner_id = (SELECT auth.uid()) OR public.is_workspace_member(id));
COMMENT ON POLICY "ws_select_member" ON public.workspaces IS
  'Authenticated owners can read their own workspace (including INSERT RETURNING); all other users require workspace membership.';
