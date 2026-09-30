ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS bookings_subscription_day_uidx ON public.bookings(subscription_id, date) WHERE subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS waitlist_offers_group_idx ON public.waitlist_offers(cancelled_booking_id);