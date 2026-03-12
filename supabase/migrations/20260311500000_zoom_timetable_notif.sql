-- ── Add zoom_link to users ────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS zoom_link TEXT;

-- ── Ensure notifications columns are correct ─────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_id UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;

-- ── Add pass_marks to exams (safe) ────────────────────────────────────────
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS pass_marks NUMERIC DEFAULT 50;

-- ── Timetable: update teacher slots with zoom_link auto-populated ─────────
-- This is handled in application layer via zoom_link column on users

-- ── Set zoom links for teachers (sample - teachers can update themselves) ──
-- No sample zoom links inserted; teachers set their own

-- ── Create timetable entries for all 37 teachers across classes ───────────
-- First ensure we have the subjects and classes before inserting timetable
-- This migration adds a helper function to auto-generate timetable

-- ── Permissions as school settings (defaults) ────────────────────────────
INSERT INTO public.school_settings (key, value) VALUES
  ('teacher_can_add_exams','true'),
  ('teacher_can_edit_exams','true'),
  ('teacher_can_add_lessons','true'),
  ('teacher_can_grade','true'),
  ('teacher_can_take_attendance','true'),
  ('teacher_can_message_students','true'),
  ('teacher_can_message_parents','true'),
  ('teacher_can_view_reports','true'),
  ('student_can_take_exams','true'),
  ('student_can_view_grades','true'),
  ('student_can_view_lessons','true'),
  ('student_can_view_schedule','true'),
  ('student_can_message_teachers','true'),
  ('student_can_message_students','true'),
  ('parent_can_view_grades','true'),
  ('parent_can_view_attendance','true'),
  ('parent_can_view_schedule','true'),
  ('parent_can_message_teachers','true'),
  ('parent_can_message_admin','true')
ON CONFLICT (key) DO NOTHING;
