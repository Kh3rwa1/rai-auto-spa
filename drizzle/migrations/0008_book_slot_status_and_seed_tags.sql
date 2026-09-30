-- 1. book_slot(): reserve the slot AND set the status in the same locked UPDATE,
-- so a booking counts against capacity the moment it is reserved.
DROP FUNCTION IF EXISTS public.book_slot(uuid, date, text, boolean, boolean, integer);

CREATE FUNCTION public.book_slot(
  p_booking_id uuid,
  p_date date,
  p_time text,
  p_mobile boolean,
  p_water boolean,
  p_days integer DEFAULT 1,
  p_status text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF p_status IS NOT NULL AND p_status NOT IN ('confirmed','pending_deposit','consultation') THEN
    RETURN 'invalid_status';
  END IF;
  IF NOT (p_time = ANY(v_slots)) THEN RETURN 'invalid_slot'; END IF;
  IF (p_date + p_time::time) < v_now THEN RETURN 'past_date'; END IF;
  IF p_mobile AND NOT p_water AND split_part(p_time, ':', 1)::int BETWEEN 11 AND 15 THEN RETURN 'dry_window'; END IF;
  IF v_full AND p_mobile THEN RETURN 'invalid_slot'; END IF;

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
    full_day = v_full, location_type = v_loc,
    status = coalesce(p_status, status)
  WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END $function$;

REVOKE ALL ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, integer, text) TO service_role;

-- 2. Tag rows created by the demo seed so a reset only removes its own rows.
ALTER TABLE public.clients        ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.bookings       ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.subscriptions  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.waitlist       ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.blocked_slots  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.waitlist_offers ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

-- 3. Server-side cooldown state for the demo reset button.
CREATE TABLE IF NOT EXISTS public.demo_state (
  id text PRIMARY KEY,
  last_reset_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.demo_state TO service_role;
ALTER TABLE public.demo_state ENABLE ROW LEVEL SECURITY;
