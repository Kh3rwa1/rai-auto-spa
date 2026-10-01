BEGIN;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS duration_slots integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bookings_duration_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.plan IS DISTINCT FROM OLD.plan THEN
    NEW.duration_slots := CASE WHEN NEW.plan = 'Full Detail' THEN 2 ELSE 1 END;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS bookings_duration_sync ON public.bookings;
CREATE TRIGGER bookings_duration_sync
  BEFORE INSERT OR UPDATE OF plan ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_duration_sync();

DROP FUNCTION IF EXISTS public.book_slot(uuid, date, text, boolean, boolean, integer, text);

CREATE OR REPLACE FUNCTION public.book_slot(p_booking_id uuid, p_date date, p_time text, p_mobile boolean, p_water boolean, p_days integer DEFAULT 1, p_status text DEFAULT NULL::text, p_slots integer DEFAULT NULL::integer)
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
  v_day date; v_slot text; v_used int;
  v_dur int;
  v_start int; v_idx int; v_hour text;
  v_hours text[] := ARRAY[]::text[];
  v_slots text[] := ARRAY['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
  v_status text; v_paid boolean; v_plan text;
BEGIN
  IF p_booking_id IS NULL OR p_date IS NULL OR p_time IS NULL OR p_mobile IS NULL
     OR p_days IS NULL OR p_days < 1 THEN RETURN 'invalid_slot'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('confirmed','pending_deposit','consultation') THEN RETURN 'invalid_status'; END IF;
  IF NOT (p_time = ANY(v_slots)) THEN RETURN 'invalid_slot'; END IF;

  SELECT status, deposit_paid, plan INTO v_status, v_paid, v_plan FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF v_paid AND p_status = 'pending_deposit' THEN RETURN 'invalid_status'; END IF;

  v_dur := greatest(1, coalesce(p_slots, CASE WHEN v_plan = 'Full Detail' THEN 2 ELSE 1 END));
  v_start := array_position(v_slots, p_time);

  FOR i IN 0 .. v_dur - 1 LOOP
    v_idx := v_start + i;
    IF v_idx IS NULL OR v_idx > array_length(v_slots, 1) THEN RETURN 'invalid_slot'; END IF;
    v_hours := v_hours || v_slots[v_idx];
  END LOOP;

  IF (p_date + p_time::time) < v_now THEN RETURN 'past_date'; END IF;
  IF p_mobile AND NOT p_water THEN
    FOREACH v_hour IN ARRAY v_hours LOOP
      IF split_part(v_hour, ':', 1)::int BETWEEN 11 AND 15 THEN RETURN 'dry_window'; END IF;
    END LOOP;
  END IF;
  IF v_full AND p_mobile THEN RETURN 'invalid_slot'; END IF;

  FOR v_day IN SELECT generate_series(p_date, v_end, interval '1 day')::date LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_day::text || '|' || v_loc));
  END LOOP;

  FOR v_day IN SELECT generate_series(p_date, v_end, interval '1 day')::date LOOP
    FOREACH v_slot IN ARRAY CASE WHEN v_full THEN v_slots ELSE v_hours END LOOP
      IF EXISTS (SELECT 1 FROM blocked_slots WHERE date = v_day AND time = v_slot) THEN RETURN 'blocked'; END IF;
      SELECT count(*) INTO v_used FROM bookings b
        WHERE b.id <> p_booking_id AND b.location_type = v_loc
          AND b.status IN ('confirmed','pending_deposit','consultation')
          AND (b.status <> 'pending_deposit' OR b.deposit_paid OR b.held_at IS NULL
               OR b.held_at > now() - interval '20 minutes')
          AND v_day BETWEEN b.date AND coalesce(b.end_date, b.date)
          AND (b.full_day OR (
                b.time = ANY(v_slots)
                AND array_position(v_slots, b.time) <= array_position(v_slots, v_slot)
                AND array_position(v_slots, v_slot) < array_position(v_slots, b.time) + greatest(1, b.duration_slots)
              ));
      IF v_used >= v_cap THEN RETURN 'full'; END IF;
    END LOOP;
  END LOOP;

  UPDATE bookings SET date = p_date, time = p_time,
    end_date = CASE WHEN v_full THEN v_end ELSE NULL END,
    full_day = v_full, location_type = v_loc,
    duration_slots = v_dur,
    status = coalesce(p_status, status),
    held_at = CASE WHEN coalesce(p_status, status) = 'pending_deposit' THEN now() ELSE held_at END
  WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END $function$;

REVOKE ALL ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, integer, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_demo_payment(p_booking_id uuid, p_method text, p_amount integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b bookings%ROWTYPE;
  v_expected int;
BEGIN
  IF p_booking_id IS NULL THEN RETURN 'not_found'; END IF;

  SELECT * INTO b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF b.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF b.deposit_paid THEN RETURN 'already_paid'; END IF;
  IF b.status = 'pending_deposit' AND b.held_at IS NULL THEN RETURN 'untimed_hold'; END IF;
  IF b.status <> 'pending_deposit' THEN RETURN 'not_payable'; END IF;
  IF b.held_at <= now() - interval '20 minutes' THEN RETURN 'hold_expired'; END IF;

  IF p_method IS NULL OR p_method NOT IN ('upi','card','netbanking') THEN RETURN 'invalid_method'; END IF;
  v_expected := round(b.total * 0.3);
  IF p_amount IS NULL OR p_amount <> v_expected THEN RETURN 'invalid_amount'; END IF;

  IF b.date IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(b.date::text || '|' || b.location_type));
  END IF;

  UPDATE bookings SET deposit_paid = true, status = 'confirmed' WHERE id = p_booking_id;
  INSERT INTO payments (booking_id, amount, method, status) VALUES (p_booking_id, p_amount, p_method, 'success');
  RETURN 'ok';
END $function$;

REVOKE ALL ON FUNCTION public.confirm_demo_payment(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_demo_payment(uuid, text, integer) TO service_role;

COMMIT;