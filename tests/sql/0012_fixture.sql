-- Disposable-database fixture for testing 0012_slot_duration_and_atomic_payment.
-- Built from the exported production column definitions (2026-10-01) — the subset
-- the booking/payment functions touch. No production connection; run on a throwaway
-- cluster only. pgcrypto supplies gen_random_bytes (built-in on Supabase).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Supabase-standard roles so the migration's REVOKE/GRANT statements behave as in
-- production (the disposable cluster's superuser is 'test').
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  name text NOT NULL,
  phone text NOT NULL,
  email text,
  building text,
  floor text,
  area text,
  water_access boolean NOT NULL DEFAULT true,
  is_seed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  vehicle_model text,
  photo_url text,
  clean_preview_url text,
  video_url text,
  video_job_id text,
  video_status text,
  plan text NOT NULL,
  colour text,
  style text,
  location_type text NOT NULL DEFAULT 'studio',
  map_pin jsonb,
  area text,
  guard_permission boolean DEFAULT false,
  water_needed boolean DEFAULT false,
  date date,
  time text,
  total integer NOT NULL DEFAULT 0,
  deposit_paid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'lead',
  approval_status text,
  email_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  end_date date,
  full_day boolean NOT NULL DEFAULT false,
  manage_token text NOT NULL DEFAULT encode(gen_random_bytes(18), 'hex'),
  is_seed boolean NOT NULL DEFAULT false,
  held_at timestamptz,
  customer_phone_e164 text,
  detected_country text,
  call_status text,
  call_transcript text,
  call_from_number text,
  call_duration_seconds integer,
  call_attempt_id text,
  call_detail text,
  call_updated_at timestamptz,
  notes text
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  method text NOT NULL,
  status text NOT NULL,
  demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.blocked_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  time text NOT NULL,
  reason text NOT NULL DEFAULT 'Water shortage',
  is_seed boolean NOT NULL DEFAULT false,
  UNIQUE (date, time)
);

-- Production deposit-guard trigger (migration 0004), so the guard can be tested
-- with real roles instead of only as superuser.
CREATE OR REPLACE FUNCTION public.guard_deposit_paid() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.deposit_paid IS DISTINCT FROM OLD.deposit_paid
     AND coalesce(auth.role(), 'service_role') IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'deposit_paid can only be changed by simulatePayment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bookings_guard_deposit BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.guard_deposit_paid();

-- auth.role() shim: production has Supabase's auth schema; the fixture fakes the
-- one function the guard reads, driven by a session GUC so tests can SET ROLE-like
-- behaviour without a login-capable role.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
