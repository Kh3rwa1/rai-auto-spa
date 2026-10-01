-- 0012 write-pause / deposit-guard probe — FOR THE SQL EDITOR, read-mostly.
--
-- Everything here runs inside ONE transaction that is explicitly ROLLED BACK:
-- the synthetic booking it creates never persists. There is NO arbitrary
-- production UPDATE: the only row touched is the synthetic one created in the
-- same transaction, and only in the guard context being tested.
--
-- Expected outcomes (record them in your deployment notes):
--   Probe 1 (anon context): `UPDATE 0` — the browser/anon role cannot modify
--     deposit_paid (RLS on bookings has no policy for anon, so the row is
--     invisible AND unwritable). If you see `UPDATE 1`, STOP: that means the
--     guest role can flip deposits, and deployment must not proceed.
--   Probe 2 (service_role context): `UPDATE 1` — the server's own path can
--     confirm the synthetic booking. The ROLLBACK erases it.
--   Note: the Supabase SQL editor runs as a superuser WITHOUT JWT claims, so
--     `auth.role()` coalesces to 'service_role' there; `SET LOCAL ROLE anon`
--     reproduces the browser role for probe 1. The truest browser check is the
--     PostgREST path (the app itself), which staging E2E covers.

BEGIN;

-- Synthetic booking, created ONLY inside this transaction.
INSERT INTO bookings (plan, vehicle_model, status)
VALUES ('Essential Wash', 'WRITE-PROBE (rolled back)', 'lead')
RETURNING id AS probe_id \gset

-- Probe 1: deposit write attempt in the guest role — expect UPDATE 0.
SET LOCAL ROLE anon;
UPDATE bookings SET deposit_paid = true WHERE id = :'probe_id';

-- Probe 2: same write in the service role — expect UPDATE 1.
RESET ROLE;
SET LOCAL ROLE service_role;
UPDATE bookings SET deposit_paid = true WHERE id = :'probe_id';

ROLLBACK;
SELECT 'PROBE ROLLED BACK — synthetic row erased' AS result;
