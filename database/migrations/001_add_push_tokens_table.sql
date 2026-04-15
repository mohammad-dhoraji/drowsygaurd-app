-- Add user_push_tokens table for Expo push notifications
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  device_info TEXT,
  platform TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, expo_token)
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id_active ON user_push_tokens(user_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users manage own push tokens" ON user_push_tokens;
CREATE POLICY "Users manage own push tokens"
ON user_push_tokens FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Drivers insert notifications logs" ON user_push_tokens;
CREATE POLICY "Drivers system insert tokens"
ON user_push_tokens FOR INSERT
WITH CHECK (user_id = auth.uid());
