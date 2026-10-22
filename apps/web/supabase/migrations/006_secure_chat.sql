-- =============================================
-- BairePorbo Schema Migration: 006_secure_chat
-- Restrict RLS on chat tables for security
-- =============================================

DROP POLICY IF EXISTS "allow_all_sessions" ON chat_sessions;
DROP POLICY IF EXISTS "allow_all_messages" ON chat_messages;

-- Only logged-in users can access their own sessions directly via RLS
CREATE POLICY "user_own_sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Only logged-in users can access messages for their own sessions
CREATE POLICY "user_own_messages" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE id = chat_messages.session_id AND user_id = auth.uid()
    )
  );

-- Note: Anonymous users (using anon_key) will access chat via the backend
-- API, which uses the Service Role key to safely bypass these RLS policies.
