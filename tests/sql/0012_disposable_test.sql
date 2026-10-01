-- Sequential behaviour assertions for 0012_slot_duration_and_atomic_payment.
-- Run on a disposable database AFTER the fixture and the migration.
-- Every check uses ASSERT; the script aborts on the first failure.
-- Dates are far-future literals so nothing collides with "today" or other tests.

-- Helper rows -------------------------------------------------------------

CREATE OR REPLACE FUNCTION t_lead(p_status text DEFAULT 'confirmed') RETURNS uuid AS $$
  DECLARE i uuid;
  BEGIN
    INSERT INTO bookings (plan, status, vehicle_model) VALUES ('Essential Wash', p_status, 'vitest') RETURNING id INTO i;
    RETURN i;
  END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION t_book(p_date date, p_time text, p_mobile boolean, p_water boolean DEFAULT true, p_days int DEFAULT 1, p_id uuid DEFAULT NULL, p_status text DEFAULT NULL, p_slots int DEFAULT 1)
RETURNS text AS $$
  DECLARE i uuid; r text;
  BEGIN
    i := coalesce(p_id, t_lead());
    SELECT book_slot(i, p_date, p_time, p_mobile, p_water, p_days, p_status, p_slots) INTO r;
    RETURN r;
  END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION t_payable() RETURNS uuid AS $$
  DECLARE c uuid; b uuid;
  BEGIN
    INSERT INTO clients (name, phone) VALUES ('Vitest Pay', '+919000000001') RETURNING id INTO c;
    INSERT INTO bookings (plan, vehicle_model, total, client_id, status) VALUES ('Essential Wash', 'vitest', 699, c, 'lead') RETURNING id INTO b;
    RETURN b;
  END $$ LANGUAGE plpgsql;

-- 1. Duration: existing two-hour Detail blocks the next hour (order A) -------
DO $$
DECLARE r text;
BEGIN
  PERFORM t_book('2099-01-10', '09:00', false, true, 1, NULL, NULL, 2);
  PERFORM t_book('2099-01-10', '09:00', false, true, 1, NULL, NULL, 2);
  r := t_book('2099-01-10', '10:00', false);
  ASSERT r = 'full', 'order A: wash at 10:00 over running Details should be full, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-10', '11:00', false);
  ASSERT r = 'ok', 'order A: adjacent wash at 11:00 should be ok, got ' || coalesce(r, 'NULL');
END $$;

-- 2. Duration: existing Washes at 10:00 block a proposed Detail at 09:00 (order B)
DO $$
DECLARE r text;
BEGIN
  PERFORM t_book('2099-01-11', '10:00', false);
  PERFORM t_book('2099-01-11', '10:00', false);
  r := t_book('2099-01-11', '09:00', false, true, 1, NULL, NULL, 2);
  ASSERT r = 'full', 'order B: detail at 09:00 needs 10:00, should be full, got ' || coalesce(r, 'NULL');
END $$;

-- 3. Pooled bays: one Wash at 10:00 + Detail at 09:00 fit (2 units = cap) -----
DO $$
DECLARE r text;
BEGIN
  PERFORM t_book('2099-01-12', '10:00', false);
  r := t_book('2099-01-12', '09:00', false, true, 1, NULL, NULL, 2);
  ASSERT r = 'ok', 'pooled: detail at 09:00 with one wash at 10:00 should be ok, got ' || coalesce(r, 'NULL');
END $$;

-- 4. Mobile capacity + adjacency ---------------------------------------------
DO $$
DECLARE r text;
BEGIN
  PERFORM t_book('2099-01-13', '10:00', true);
  r := t_book('2099-01-13', '09:00', true, true, 1, NULL, NULL, 2);
  ASSERT r = 'full', 'mobile: detail at 09:00 needs the van at 10:00, should be full, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-13', '11:00', true);
  ASSERT r = 'ok', 'mobile: adjacent wash at 11:00 should be ok, got ' || coalesce(r, 'NULL');
END $$;

-- 5. Closing time -------------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  r := t_book('2099-01-14', '18:00', false, true, 1, NULL, NULL, 2);
  ASSERT r = 'invalid_slot', 'closing: 2-hour detail at 18:00 should be invalid_slot, got ' || coalesce(r, 'NULL');
  PERFORM t_book('2099-01-14', '17:00', false, true, 1, NULL, NULL, 2);
  r := t_book('2099-01-14', '18:00', false);
  ASSERT r = 'ok', 'closing: wash at 18:00 next to a 17:00 detail should be ok, got ' || coalesce(r, 'NULL');
END $$;

-- 6. Two-day Signature --------------------------------------------------------
DO $$
DECLARE r text;
BEGIN
  PERFORM t_book('2099-01-15', '10:00', false, true, 2);
  PERFORM t_book('2099-01-15', '10:00', false, true, 2);
  r := t_book('2099-01-16', '15:00', false);
  ASSERT r = 'full', 'signature: day 2 must be fully blocked, got ' || coalesce(r, 'NULL');
END $$;

-- 7. Mobile water restriction over EVERY occupied hour ------------------------
DO $$
DECLARE r text;
BEGIN
  r := t_book('2099-01-10', '10:00', true, false, 1, NULL, NULL, 2);
  ASSERT r = 'dry_window', 'water: 2h detail at 10:00 without water hits 11:00 dry window, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-10', '09:00', true, false, 1, NULL, NULL, 2);
  ASSERT r = 'ok', 'water: 2h detail at 09:00 without water is fine, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-10', '16:00', true, false, 1, NULL, NULL, 2);
  ASSERT r = 'ok', 'water: 2h detail at 16:00 without water is fine, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-10', '12:00', true, false);
  ASSERT r = 'dry_window', 'water: single 12:00 without water still rejected, got ' || coalesce(r, 'NULL');
END $$;

-- 8. Legacy callers that omit p_slots -----------------------------------------
DO $$
DECLARE a uuid; b uuid; r text; ds int;
BEGIN
  -- 'confirmed' so the derived duration participates in capacity counting (the
  -- derivation itself is status-independent).
  INSERT INTO bookings (plan, status, vehicle_model) VALUES ('Full Detail', 'confirmed', 'vitest') RETURNING id INTO a;
  INSERT INTO bookings (plan, status, vehicle_model) VALUES ('Full Detail', 'confirmed', 'vitest') RETURNING id INTO b;
  -- Legacy-style call: book_slot WITHOUT p_slots (helper always passes it).
  r := book_slot(a, '2099-01-17', '09:00', false, true, 1, NULL);
  ASSERT r = 'ok', 'derive: legacy detail booking should be ok, got ' || coalesce(r, 'NULL');
  SELECT duration_slots INTO ds FROM bookings WHERE id = a;
  ASSERT ds = 2, 'derive: stored duration_slots should be 2, got ' || coalesce(ds::text, 'NULL');
  r := book_slot(b, '2099-01-17', '09:00', false, true, 1, NULL);
  ASSERT r = 'ok', 'derive: second legacy detail should be ok, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-17', '10:00', false);
  ASSERT r = 'full', 'derive: two 2-hour details occupy 10:00, should be full, got ' || coalesce(r, 'NULL');
END $$;

-- 9. Input validation ---------------------------------------------------------
DO $$
DECLARE i uuid; r text;
BEGIN
  i := t_lead();
  r := book_slot(NULL, '2099-01-12', '09:00', false, true);
  ASSERT r = 'invalid_slot', 'null booking id must be invalid_slot, got ' || coalesce(r, 'NULL');
  r := book_slot(i, NULL, '09:00', false, true);
  ASSERT r = 'invalid_slot', 'null date must be invalid_slot, got ' || coalesce(r, 'NULL');
  r := book_slot(i, '2099-01-12', '09:00', NULL, true);
  ASSERT r = 'invalid_slot', 'null mobile must be invalid_slot, got ' || coalesce(r, 'NULL');
  r := book_slot(i, '2099-01-12', '09:00', false, true, 0);
  ASSERT r = 'invalid_slot', 'days=0 must be invalid_slot, got ' || coalesce(r, 'NULL');
END $$;

-- 10. State validation inside book_slot: no cancelled resurrection, no downgrade
DO $$
DECLARE i uuid; r text;
BEGIN
  i := t_lead('cancelled');
  r := t_book('2099-01-12', '09:00', false, true, 1, i);
  ASSERT r = 'cancelled', 'cancelled booking must not be re-bookable, got ' || coalesce(r, 'NULL');
  i := t_lead('confirmed');
  UPDATE bookings SET deposit_paid = true WHERE id = i;
  r := t_book('2099-01-12', '09:00', false, true, 1, i, 'pending_deposit');
  ASSERT r = 'invalid_status', 'paid booking must not downgrade to pending_deposit, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-12', '09:00', false, true, 1, i);
  ASSERT r = 'ok', 'paid rescheduling (no status arg) must stay allowed, got ' || coalesce(r, 'NULL');
END $$;

-- 11. Payable state is strict: untimed hold, non-pending states, expiry -------
DO $$
DECLARE i uuid; c uuid; r text; paid boolean; n int;
BEGIN
  INSERT INTO clients (name, phone) VALUES ('Vitest T11', '+919000000002') RETURNING id INTO c;
  INSERT INTO bookings (plan, vehicle_model, total, client_id, status) VALUES ('Essential Wash', 'vitest', 699, c, 'lead') RETURNING id INTO i;
  -- Untimed hold: pending_deposit with held_at IS NULL is not payable.
  UPDATE bookings SET date = '2099-01-12', time = '09:00', status = 'pending_deposit' WHERE id = i;
  r := confirm_demo_payment(i, 'upi', 210);
  ASSERT r = 'untimed_hold', 'untimed hold must be untimed_hold, got ' || coalesce(r, 'NULL');
  SELECT deposit_paid INTO paid FROM bookings WHERE id = i;
  ASSERT NOT paid, 'untimed hold must not be paid';
  -- A lead with a slot is not payable either.
  UPDATE bookings SET status = 'lead', held_at = clock_timestamp() WHERE id = i;
  r := confirm_demo_payment(i, 'upi', 210);
  ASSERT r = 'not_payable', 'lead state must be not_payable, got ' || coalesce(r, 'NULL');
  -- A live pending_deposit hold pays.
  UPDATE bookings SET status = 'pending_deposit', held_at = clock_timestamp() WHERE id = i;
  r := confirm_demo_payment(i, 'upi', 210);
  ASSERT r = 'ok', 'live hold should pay, got ' || coalesce(r, 'NULL');
  -- Expired hold cannot pay (fresh row, stamped in the past).
  i := t_payable();
  PERFORM t_book('2099-01-13', '09:00', false, true, 1, i, 'pending_deposit');
  UPDATE bookings SET held_at = clock_timestamp() - interval '25 minutes' WHERE id = i;
  r := confirm_demo_payment(i, 'card', round(699 * 0.3)::int);
  ASSERT r = 'hold_expired', 'expired hold must be hold_expired, got ' || coalesce(r, 'NULL');
  SELECT count(*) INTO n FROM payments WHERE booking_id = i;
  ASSERT n = 0, 'expired hold must not create a payment row';
  -- NULL / invalid inputs (fresh live hold so state validation passes first).
  i := t_payable();
  PERFORM t_book('2099-01-13', '10:00', false, true, 1, i, 'pending_deposit');
  r := confirm_demo_payment(i, NULL, 210);
  ASSERT r = 'invalid_method', 'null method must be invalid_method, got ' || coalesce(r, 'NULL');
  r := confirm_demo_payment(i, 'bitcoin', 210);
  ASSERT r = 'invalid_method', 'unknown method must be invalid_method, got ' || coalesce(r, 'NULL');
  r := confirm_demo_payment(i, 'upi', NULL);
  ASSERT r = 'invalid_amount', 'null amount must be invalid_amount, got ' || coalesce(r, 'NULL');
  r := confirm_demo_payment(i, 'upi', 999999);
  ASSERT r = 'invalid_amount', 'wrong amount must be invalid_amount, got ' || coalesce(r, 'NULL');
  r := confirm_demo_payment(NULL, 'upi', 210);
  ASSERT r = 'not_found', 'null booking must be not_found, got ' || coalesce(r, 'NULL');
END $$;

-- 12. Cancelled-after-paid: re-payment refused --------------------------------
DO $$
DECLARE i uuid; r text;
BEGIN
  i := t_payable();
  PERFORM t_book('2099-01-14', '09:00', false, true, 1, i, 'pending_deposit');
  r := confirm_demo_payment(i, 'upi', round(699 * 0.3)::int);
  ASSERT r = 'ok', 'first payment should be ok, got ' || coalesce(r, 'NULL');
  UPDATE bookings SET status = 'cancelled' WHERE id = i;
  r := confirm_demo_payment(i, 'upi', round(699 * 0.3)::int);
  ASSERT r = 'cancelled', 'cancelled booking must refuse re-payment, got ' || coalesce(r, 'NULL');
END $$;

-- 13. Payment serialises with reservation: after payment the slot is taken ----
DO $$
DECLARE i uuid; r text;
BEGIN
  i := t_payable();
  PERFORM t_book('2099-01-15', '09:00', true, true, 1, i, 'pending_deposit');
  r := confirm_demo_payment(i, 'card', round(699 * 0.3)::int);
  ASSERT r = 'ok', 'payment should be ok, got ' || coalesce(r, 'NULL');
  r := t_book('2099-01-15', '09:00', true);
  ASSERT r = 'full', 'paid van slot must be full for a new booking, got ' || coalesce(r, 'NULL');
END $$;


-- 14. Production deposit guard, with real roles (not superuser-only) -------------
DO $$
DECLARE i uuid;
BEGIN
  i := t_lead('confirmed');
  -- As anon: deposit_paid must be untouchable.
  SET LOCAL "request.jwt.claim.role" = 'anon';
  BEGIN
    UPDATE bookings SET deposit_paid = true WHERE id = i;
    RAISE EXCEPTION 'guard failed: anon could set deposit_paid';
  EXCEPTION WHEN others THEN
    IF SQLERRM NOT LIKE '%deposit_paid can only be changed%' THEN
      RAISE EXCEPTION 'guard failed with unexpected error: %', SQLERRM;
    END IF;
  END;
  -- As service_role (the app's path): allowed.
  SET LOCAL "request.jwt.claim.role" = 'service_role';
  UPDATE bookings SET deposit_paid = true WHERE id = i;
  RESET "request.jwt.claim.role";
END $$;

SELECT 'SEQUENTIAL ASSERTIONS PASSED' AS result;
