-- Fix: new users should get 1 free credit, not 0
-- The migration 20260316231657 accidentally set credits to 0 on new user trigger.
-- This migration restores the correct default and backfills existing users.

-- 1. Restore handle_new_user trigger to give 1 credit
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.credits (user_id, balance)
  VALUES (NEW.id, 1)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 2. Backfill: give 1 credit to any existing users who have 0
UPDATE public.credits
SET balance = 1
WHERE balance = 0;
