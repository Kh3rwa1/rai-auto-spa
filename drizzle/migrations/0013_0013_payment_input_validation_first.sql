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

  -- Validate the payment inputs before the booking-state checks, so a malformed
  -- request is rejected with a named input code regardless of the row's state.
  IF p_method IS NULL OR p_method NOT IN ('upi','card','netbanking') THEN RETURN 'invalid_method'; END IF;
  v_expected := round(b.total * 0.3);
  IF p_amount IS NULL OR p_amount <> v_expected THEN RETURN 'invalid_amount'; END IF;

  IF b.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF b.deposit_paid THEN RETURN 'already_paid'; END IF;
  IF b.status = 'pending_deposit' AND b.held_at IS NULL THEN RETURN 'untimed_hold'; END IF;
  IF b.status <> 'pending_deposit' THEN RETURN 'not_payable'; END IF;
  IF b.held_at <= now() - interval '20 minutes' THEN RETURN 'hold_expired'; END IF;

  IF b.date IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(b.date::text || '|' || b.location_type));
  END IF;

  UPDATE bookings SET deposit_paid = true, status = 'confirmed' WHERE id = p_booking_id;
  INSERT INTO payments (booking_id, amount, method, status) VALUES (p_booking_id, p_amount, p_method, 'success');
  RETURN 'ok';
END $function$;