
CREATE TABLE public.interview_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  current_phase text NOT NULL DEFAULT 'opening',
  question_count integer NOT NULL DEFAULT 0,
  running_scores jsonb NOT NULL DEFAULT '{}',
  topics_covered jsonb NOT NULL DEFAULT '[]',
  cv_summary text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(interview_id)
);

ALTER TABLE public.interview_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interview state"
ON public.interview_state
FOR SELECT
TO authenticated
USING (public.owns_interview(interview_id));

CREATE POLICY "Users can insert own interview state"
ON public.interview_state
FOR INSERT
TO authenticated
WITH CHECK (public.owns_interview(interview_id));

CREATE POLICY "Users can update own interview state"
ON public.interview_state
FOR UPDATE
TO authenticated
USING (public.owns_interview(interview_id));
