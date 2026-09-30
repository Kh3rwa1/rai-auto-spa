CREATE TABLE public.waitlist_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancelled_booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date date NOT NULL,
  time text NOT NULL,
  location_type text NOT NULL DEFAULT 'mobile',
  area text,
  status text NOT NULL DEFAULT 'offered',
  claimed_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.waitlist_offers TO service_role;
ALTER TABLE public.waitlist_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest demo read car media" ON storage.objects;
DROP POLICY IF EXISTS "guest demo read blocked_slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "guest demo write blocked_slots" ON public.blocked_slots;
DROP POLICY IF EXISTS "guest demo read bookings" ON public.bookings;
DROP POLICY IF EXISTS "guest demo write bookings" ON public.bookings;
DROP POLICY IF EXISTS "guest demo read clients" ON public.clients;
DROP POLICY IF EXISTS "guest demo read subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "guest demo write subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "guest demo read waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "guest demo write waitlist" ON public.waitlist;

-- first-caller-becomes-admin race removed; admins are granted explicitly
DROP FUNCTION IF EXISTS public.claim_owner();