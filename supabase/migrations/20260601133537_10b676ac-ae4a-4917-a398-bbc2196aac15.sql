-- Lock down Realtime: only allow subscriptions whose topic is "workspace:<uuid>"
-- and the user is a member of that workspace.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime_workspace_member" ON realtime.messages;

CREATE POLICY "realtime_workspace_member"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^workspace:[0-9a-fA-F-]{36}(:.*)?$'
  AND public.is_workspace_member(
    (split_part(realtime.topic(), ':', 2))::uuid
  )
);