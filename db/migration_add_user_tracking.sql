-- Migration: Add user identity tracking to sessions
-- This enables proper audit logging and user-specific authorization

-- Add user_identifier column to sessions table
-- This stores the identity of who created the session (email or username)
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS user_identifier TEXT;

-- Add user_role column for future role-based access control
ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'admin';

-- Add index for faster lookups by user_identifier
CREATE INDEX IF NOT EXISTS sessions_user_identifier_idx ON sessions(user_identifier);

-- Add audit_log table for tracking admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  user_identifier TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for audit log queries
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log(user_identifier);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);

-- Migration complete
-- Note: Existing sessions will have NULL user_identifier
-- They will be cleaned up on next expiry or can be manually cleaned
