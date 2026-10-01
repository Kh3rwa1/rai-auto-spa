-- 0012_slot_duration_and_atomic_payment — ROLLBACK
--
-- Restores the exact previously deployed database state (exported from production
-- 2026-10-01): the 7-argument book_slot with the 20-minute hold-expiry clause and
-- held_at stamping. Data confirmed through confirm_demo_payment stays paid and
-- valid; only the duration-aware counting and the atomic payment function are
-- removed. The duration_slots column is left in place (harmless, default 1);
-- drop it only with the optional statement at the end.
--
-- Matching CODE rollback: the app changes that depend on this migration live in
-- src/lib/booking-core.ts (p_slots in bookSlot/tryBookSlot), src/lib/booking-pay.functions.ts
-- (p_slots in confirmBooking; confirm_demo_payment RPC in simulatePayment),
-- src/lib/quickbook.functions.ts, src/lib/offer.functions.ts, src/lib/booking-video.functions.ts,
-- src/routes/api/public/update-booking.ts (p_slots + plan sizing), src/lib/plans.ts
-- (slotsForPlan), and the display mirrors in src/lib/booking.functions.ts +
-- src/components/owner/WeekCalendar.tsx. Restore them from git (git checkout -- <paths>
-- / git revert) so the app stops sending p_slots and calling confirm_demo_payment —
-- the restored 7-arg book_slot rejects unknown parameters, and confirm_demo_payment
-- no longer exists. Order: roll the code back first, then run this file.

BEGIN;

DROP FUNCTION IF EXISTS public.confirm_demo_payment(uuid, text, integer);
DROP TRIGGER IF EXISTS bookings_duration_sync ON public.bookings;
DROP FUNCTION IF EXISTS public.bookings_duration_sync();
DROP FUNCTION IF EXISTS public.book_slot(uuid, date, text, boolean, boolean, integer, text, integer);

-- The previously deployed production book_slot (7-arg), verbatim:
CREATE OR REPLACE FUNCTION public.book_slot(p_booking_id uuid, p_date date, p_time text, p_mobile boolean, p_water boolean, p_days integer DEFAULT 1, p_status text DEFAULT NULL::text)
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
  v_slots text[] := ARRAY['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
BEGIN
  IF p_status IS NOT NULL AND p_status NOT IN ('confirmed','pending_deposit','consultation') THEN RETURN 'invalid_status'; END IF;
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
          AND (b.status <> 'pending_deposit' OR b.deposit_paid OR b.held_at IS NULL
               OR b.held_at > now() - interval '20 minutes')
          AND v_day BETWEEN b.date AND coalesce(b.end_date, b.date)
          AND (b.time = v_slot OR b.full_day);
      IF v_used >= v_cap THEN RETURN 'full'; END IF;
    END LOOP;
  END LOOP;

  UPDATE bookings SET date = p_date, time = p_time,
    end_date = CASE WHEN v_full THEN v_end ELSE NULL END,
    full_day = v_full, location_type = v_loc,
    status = coalesce(p_status, status),
    held_at = CASE WHEN coalesce(p_status, status) = 'pending_deposit' THEN now() ELSE held_at END
  WHERE id = p_booking_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END $function$
;

REVOKE ALL ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.book_slot(uuid, date, text, boolean, boolean, integer, text) TO service_role;

COMMIT;

-- Optional: only if you also want the column gone (leave it in place otherwise —
-- the trigger that maintained it is dropped above, the default keeps new rows at 1):
-- ALTER TABLE public.bookings DROP COLUMN duration_slots;
