ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS call_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS call_attempt_id text,
  ADD COLUMN IF NOT EXISTS call_detail text,
  ADD COLUMN IF NOT EXISTS call_updated_at timestamptz;