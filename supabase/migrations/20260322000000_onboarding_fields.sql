-- Add onboarding fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_source TEXT,
  ADD COLUMN IF NOT EXISTS goals TEXT[];
