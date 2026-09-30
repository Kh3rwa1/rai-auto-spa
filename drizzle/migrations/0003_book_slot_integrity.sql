ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS full_day boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS manage_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex');
CREATE INDEX IF NOT EXISTS bookings_date_idx ON public.bookings(date);

CREATE OR REPLACE FUNCTION public.book_slot(
  p_booking_id uuid, p_date date, p_time text, p_mobile boolean, p_water boolean, p_days int DEFAULT 1
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_loc text := CASE WHEN p_mobile THEN 'mobile' ELSE 'studio' END;
  v_cap int := CASE WHEN p_mobile THEN 1 ELSE 2 END;
  v_now timestamp := now() AT TIME ZONE 'Asia/Kolkata';
  v_full boolean := p_days > 1;
  v_end date := p_date + (greatest(p_days,1) - 1);
  v_day date;
  v_slot text;
  v_used int;
  v_slots text[] := ARRAY['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
BEGIN
  IF NOT (p_time = ANY(v_slots)) THEN RETURN 'invalid_slot'; END IF;
  IF (p_date + p_time::time) < v_now THEN RETURN 'past_date'; END IF;
  IF p_mobile AND NOT p_water AND split_part(p_time, ':', 1)::int BETWEEN 11 AND 15 THEN RETURN 'dry_window'; END IF;
  IF v_full AND p_mobile THEN RETURN 'invalid_slot'; END IF;

  -- serialise all bookings touching these days + location
  FOR v_day IN SELECT generate_series(p_date, v_end, interval '1 day')::date LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_day::text || '|' || v_loc));
  END LOOP;

  FOR v_day IN SELECT generate_series(p_date, v_end, interval '1 day')::date LOOP
    FOREACH v_slot IN ARRAY CASE WHEN v_full THEN v_slots ELSE ARRAY[p_time] END LOOP
      IF EXISTS (SELECT 1 FROM blocked_slots WHERE date = v_day AND time = v_slot) THEN RETURN 'blocked'; END IF;
      SELECT count(*) INTO v_used FROM bookings b
        WHERE b.id <> p_booking_id AND b.location_type = v_loc
          AND b.status IN ('confirmed','pending_deposit','consultation')
          AND v_day BETWEEN b.date AND coalesce(b.end_date, b.date)
          AND (b.time = v_slot OR b.full_day);
      IF v_used >= v_cap THEN RETURN 'full'; END IF;
    END LOOP;
  END LOOP;

  UPDATE bookings SET date = p_date, time = p_time, end_date = CASE WHEN v_full THEN v_end ELSE NULL END,
    full_day = v_full, location_type = v_loc
  WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END $$;

REVOKE ALL ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, int) TO service_role;