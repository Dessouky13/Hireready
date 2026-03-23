-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_interviews_user_id ON public.interviews (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS idx_reports_interview_id ON public.reports (interview_id);
CREATE INDEX IF NOT EXISTS idx_messages_interview_created ON public.messages (interview_id, created_at);
