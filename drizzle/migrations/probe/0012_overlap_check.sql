-- 0012 overlap check — READ-ONLY, works BEFORE and AFTER the duration migration.
--
-- Duration is derived from the fields that already exist in the exported
-- production schema (plan + full_day) — the same derivation the migration's
-- backfill and sync trigger use — so this query never references duration_slots
-- and runs on the pre-migration database unchanged.
--
-- Occupancy mirrors book_slot's counting rules exactly:
--   * statuses confirmed / pending_deposit / consultation
--   * unpaid holds older than 20 minutes do not occupy (held_at IS NULL does)
--   * whole-day reservations occupy every slot of every day in date..end_date
--   * a Full Detail occupies its starting slot AND the next hour; all other
--     services occupy one hour
--
-- EDIT the window start date in both queries below, then run.
-- Query 1 lists every capacity conflict (sample data included);
-- Query 2 lists only conflicts involving at least one REAL customer booking —
-- those must be reported, never modified automatically.

-- Query 1: ALL capacity conflicts in the window (sample data included).
WITH params AS (
  SELECT date '2026-10-01' AS start_date  -- EDIT ME: first day of the audit window
),
slots AS (
  SELECT unnest(ARRAY['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']) AS slot
),
window_days AS (
  SELECT generate_series((SELECT start_date FROM params),
                         (SELECT start_date FROM params) + 6,
                         interval '1 day')::date AS day
),
live AS (
  SELECT b.id, b.plan, b.full_day, b.date, coalesce(b.end_date, b.date) AS end_date,
         b.time, b.location_type,
         CASE WHEN b.client_id IS NOT NULL AND cl.is_seed = false THEN 'real'
              ELSE 'sample' END AS data_class
  FROM bookings b
  LEFT JOIN clients cl ON cl.id = b.client_id
  WHERE b.status IN ('confirmed','pending_deposit','consultation')
    AND (b.status <> 'pending_deposit' OR b.deposit_paid
         OR b.held_at IS NULL
         OR b.held_at > now() - interval '20 minutes')
),
occupancy AS (
  SELECT l.id, l.data_class, l.location_type, d.day, s.slot
  FROM live l
  JOIN window_days d ON d.day BETWEEN l.date AND l.end_date
  JOIN slots s
    ON l.full_day
    OR (l.time IS NOT NULL
        AND s.slot::time >= l.time::time
        AND s.slot::time < l.time::time
                     + make_interval(hours => CASE WHEN l.plan = 'Full Detail' THEN 2 ELSE 1 END))
)
SELECT o.day,
       o.slot,
       o.location_type,
       count(*)::int AS occupied_units,
       CASE WHEN o.location_type = 'mobile' THEN 1 ELSE 2 END AS capacity,
       string_agg(DISTINCT o.data_class, ',') AS data_classes,
       string_agg(DISTINCT o.id::text, ',')  AS booking_ids
FROM occupancy o
GROUP BY o.day, o.slot, o.location_type
HAVING count(*) > CASE WHEN o.location_type = 'mobile' THEN 1 ELSE 2 END
ORDER BY o.day, o.slot;

-- Query 2: ONLY conflicts involving at least one REAL customer booking.
WITH params AS (
  SELECT date '2026-10-01' AS start_date  -- EDIT ME: first day of the audit window
),
slots AS (
  SELECT unnest(ARRAY['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00']) AS slot
),
window_days AS (
  SELECT generate_series((SELECT start_date FROM params),
                         (SELECT start_date FROM params) + 6,
                         interval '1 day')::date AS day
),
live AS (
  SELECT b.id, b.plan, b.full_day, b.date, coalesce(b.end_date, b.date) AS end_date,
         b.time, b.location_type,
         CASE WHEN b.client_id IS NOT NULL AND cl.is_seed = false THEN 'real'
              ELSE 'sample' END AS data_class
  FROM bookings b
  LEFT JOIN clients cl ON cl.id = b.client_id
  WHERE b.status IN ('confirmed','pending_deposit','consultation')
    AND (b.status <> 'pending_deposit' OR b.deposit_paid
         OR b.held_at IS NULL
         OR b.held_at > now() - interval '20 minutes')
),
occupancy AS (
  SELECT l.id, l.data_class, l.location_type, d.day, s.slot
  FROM live l
  JOIN window_days d ON d.day BETWEEN l.date AND l.end_date
  JOIN slots s
    ON l.full_day
    OR (l.time IS NOT NULL
        AND s.slot::time >= l.time::time
        AND s.slot::time < l.time::time
                     + make_interval(hours => CASE WHEN l.plan = 'Full Detail' THEN 2 ELSE 1 END))
)
SELECT o.day,
       o.slot,
       o.location_type,
       count(*)::int AS occupied_units,
       count(*) FILTER (WHERE o.data_class = 'real') AS real_bookings_in_conflict,
       string_agg(DISTINCT o.id::text, ',') AS booking_ids
FROM occupancy o
GROUP BY o.day, o.slot, o.location_type
HAVING count(*) > CASE WHEN o.location_type = 'mobile' THEN 1 ELSE 2 END
   AND bool_or(o.data_class = 'real')
ORDER BY o.day, o.slot;
