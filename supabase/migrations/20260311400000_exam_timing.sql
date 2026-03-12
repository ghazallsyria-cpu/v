-- Add timing fields to exams
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS exam_type TEXT DEFAULT 'اختبار فصلي',
  ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;
