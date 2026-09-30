CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  method text NOT NULL,
  status text NOT NULL,
  demo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX payments_booking_idx ON public.payments(booking_id);

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