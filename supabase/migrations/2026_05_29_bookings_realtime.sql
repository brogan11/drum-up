-- Add the bookings table to the realtime publication so the dashboards' existing
-- `bookings-musician-*` / `bookings-restaurant-*` subscriptions fire on accept/decline
-- and payment-confirmation. Without this, those subscriptions are silently inert and
-- cross-user updates only appear on reopen / tab-switch.
--
-- RLS still applies to realtime postgres_changes (bookings has bk_select_party), so each
-- user only receives booking rows they're already a party to. Safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;
END $$;
