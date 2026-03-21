-- Fix messages role constraint to allow 'assistant' (orchestrator inserts this)
-- Requires: 20260309011028 migration (creates messages + interviews tables) to run first.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'messages') THEN
    ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_role_check;
    ALTER TABLE public.messages ADD CONSTRAINT messages_role_check CHECK (role IN ('ai', 'user', 'assistant'));
  END IF;
END $$;

-- Add language column to interviews
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'interviews') THEN
    ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar'));
  END IF;
END $$;

-- Atomic credit deduction function (server-side only, prevents race conditions)
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INT;
BEGIN
  SELECT balance INTO current_balance
  FROM credits
  WHERE user_id = p_user_id
  FOR UPDATE; -- Row-level lock prevents race conditions

  IF current_balance IS NULL OR current_balance < 1 THEN
    RETURN FALSE;
  END IF;

  UPDATE credits
  SET balance = balance - 1, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Rate limiting table for edge functions
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Rate limit increment function
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key TEXT,
  p_window_start TIMESTAMPTZ,
  p_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = rate_limits.count + 1
  RETURNING count INTO current_count;

  RETURN current_count <= p_limit;
END;
$$;

-- Clean old rate limit entries (call periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE window_start < NOW() - INTERVAL '10 minutes';
$$;
