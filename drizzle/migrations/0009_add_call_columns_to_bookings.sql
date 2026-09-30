ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_phone_e164 text,
  ADD COLUMN IF NOT EXISTS detected_country text,
  ADD COLUMN IF NOT EXISTS call_status text,
  ADD COLUMN IF NOT EXISTS call_transcript text,
  ADD COLUMN IF NOT EXISTS call_from_number text;