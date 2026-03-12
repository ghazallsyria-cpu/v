-- ═══════════════════════════════════════════════════════════════
-- SCHOOL TIMETABLE - مدرسة الرفعة النموذجية
-- Assigns teachers to periods across the school week
-- Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4
-- Periods 1-7 per day (45 min each starting 7:30)
-- ═══════════════════════════════════════════════════════════════

-- Helper: period times
-- P1: 07:30-08:15  P2: 08:15-09:00  P3: 09:00-09:45
-- P4: 09:45-10:30  P5: 10:30-11:15  P6: 11:15-12:00  P7: 12:00-12:45

-- We'll insert timetable rows using a DO block that looks up IDs dynamically
DO $$
DECLARE
  v_teacher_id UUID;
  v_subject_id UUID;
  v_class_id UUID;
  
  -- Subject lookups
  subj_islamic UUID;
  subj_arabic UUID;
  subj_english UUID;
  subj_french UUID;
  subj_math UUID;
  subj_chemistry UUID;
  subj_physics UUID;
  subj_biology UUID;
  subj_geology UUID;
  subj_social UUID;
  subj_computer UUID;
  
  -- Class lookups (grades 7-12 sections A,B,C)
  -- We'll look them up by name pattern
  
  PROCEDURE insert_slot(
    p_class_name TEXT, p_day INT, p_period INT,
    p_subj_id UUID, p_teacher_national_id TEXT,
    p_start TEXT, p_end TEXT
  ) LANGUAGE plpgsql AS $p$
  DECLARE v_cid UUID; v_tid UUID;
  BEGIN
    SELECT id INTO v_cid FROM public.classes WHERE name ILIKE p_class_name LIMIT 1;
    SELECT id INTO v_tid FROM public.users WHERE national_id = p_teacher_national_id LIMIT 1;
    IF v_cid IS NULL OR v_tid IS NULL OR p_subj_id IS NULL THEN RETURN; END IF;
    INSERT INTO public.timetable (class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time)
    VALUES (v_cid, p_subj_id, v_tid, p_day, p_period, p_start, p_end)
    ON CONFLICT (class_id, day_of_week, period_number) DO UPDATE
      SET subject_id=EXCLUDED.subject_id, teacher_id=EXCLUDED.teacher_id;
  END;
  $p$;

BEGIN
  -- Get subject IDs
  SELECT id INTO subj_islamic  FROM public.subjects WHERE name='تربية إسلامية' LIMIT 1;
  SELECT id INTO subj_arabic   FROM public.subjects WHERE name='لغة عربية' LIMIT 1;
  SELECT id INTO subj_english  FROM public.subjects WHERE name='لغة إنجليزية' LIMIT 1;
  SELECT id INTO subj_french   FROM public.subjects WHERE name='لغة فرنسية' LIMIT 1;
  SELECT id INTO subj_math     FROM public.subjects WHERE name='رياضيات' LIMIT 1;
  SELECT id INTO subj_chemistry FROM public.subjects WHERE name='كيمياء' LIMIT 1;
  SELECT id INTO subj_physics  FROM public.subjects WHERE name='فيزياء' LIMIT 1;
  SELECT id INTO subj_biology  FROM public.subjects WHERE name='أحياء' LIMIT 1;
  SELECT id INTO subj_geology  FROM public.subjects WHERE name='جيولوجيا' LIMIT 1;
  SELECT id INTO subj_social   FROM public.subjects WHERE name='اجتماعيات' LIMIT 1;
  SELECT id INTO subj_computer FROM public.subjects WHERE name='حاسوب' LIMIT 1;

  -- ── SUNDAY (day 0) ────────────────────────────────────────────────
  CALL insert_slot('%أ%','0',1, subj_arabic,   '9000000005','07:30','08:15');
  CALL insert_slot('%أ%','0',2, subj_math,     '9000000018','08:15','09:00');
  CALL insert_slot('%أ%','0',3, subj_english,  '9000000012','09:00','09:45');
  CALL insert_slot('%أ%','0',4, subj_islamic,  '9000000001','09:45','10:30');
  CALL insert_slot('%أ%','0',5, subj_chemistry,'9000000024','10:30','11:15');
  CALL insert_slot('%أ%','0',6, subj_physics,  '9000000027','11:15','12:00');
  CALL insert_slot('%أ%','0',7, subj_computer, '9000000036','12:00','12:45');
  
  -- ── MONDAY (day 1) ────────────────────────────────────────────────
  CALL insert_slot('%أ%','1',1, subj_math,     '9000000018','07:30','08:15');
  CALL insert_slot('%أ%','1',2, subj_arabic,   '9000000005','08:15','09:00');
  CALL insert_slot('%أ%','1',3, subj_biology,  '9000000030','09:00','09:45');
  CALL insert_slot('%أ%','1',4, subj_english,  '9000000012','09:45','10:30');
  CALL insert_slot('%أ%','1',5, subj_social,   '9000000033','10:30','11:15');
  CALL insert_slot('%أ%','1',6, subj_islamic,  '9000000001','11:15','12:00');
  CALL insert_slot('%أ%','1',7, subj_french,   '9000000017','12:00','12:45');
  
  -- ── TUESDAY (day 2) ───────────────────────────────────────────────
  CALL insert_slot('%أ%','2',1, subj_english,  '9000000012','07:30','08:15');
  CALL insert_slot('%أ%','2',2, subj_physics,  '9000000027','08:15','09:00');
  CALL insert_slot('%أ%','2',3, subj_math,     '9000000018','09:00','09:45');
  CALL insert_slot('%أ%','2',4, subj_arabic,   '9000000005','09:45','10:30');
  CALL insert_slot('%أ%','2',5, subj_computer, '9000000036','10:30','11:15');
  CALL insert_slot('%أ%','2',6, subj_geology,  '9000000032','11:15','12:00');
  CALL insert_slot('%أ%','2',7, subj_chemistry,'9000000024','12:00','12:45');
  
  -- ── WEDNESDAY (day 3) ─────────────────────────────────────────────
  CALL insert_slot('%أ%','3',1, subj_islamic,  '9000000001','07:30','08:15');
  CALL insert_slot('%أ%','3',2, subj_social,   '9000000033','08:15','09:00');
  CALL insert_slot('%أ%','3',3, subj_english,  '9000000012','09:00','09:45');
  CALL insert_slot('%أ%','3',4, subj_biology,  '9000000030','09:45','10:30');
  CALL insert_slot('%أ%','3',5, subj_arabic,   '9000000005','10:30','11:15');
  CALL insert_slot('%أ%','3',6, subj_math,     '9000000018','11:15','12:00');
  CALL insert_slot('%أ%','3',7, subj_french,   '9000000017','12:00','12:45');
  
  -- ── THURSDAY (day 4) ──────────────────────────────────────────────
  CALL insert_slot('%أ%','4',1, subj_chemistry,'9000000024','07:30','08:15');
  CALL insert_slot('%أ%','4',2, subj_physics,  '9000000027','08:15','09:00');
  CALL insert_slot('%أ%','4',3, subj_arabic,   '9000000005','09:00','09:45');
  CALL insert_slot('%أ%','4',4, subj_math,     '9000000018','09:45','10:30');
  CALL insert_slot('%أ%','4',5, subj_islamic,  '9000000001','10:30','11:15');
  CALL insert_slot('%أ%','4',6, subj_computer, '9000000036','11:15','12:00');
  CALL insert_slot('%أ%','4',7, subj_english,  '9000000012','12:00','12:45');

END;
$$;
