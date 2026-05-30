-- Columns required by the restaurant → musician gig-invite flow
-- (app/api/bookings/invite + app/api/bookings/respond-invite). These were previously
-- only documented as a comment in the invite route and never applied, so creating a
-- NEW private slot via "New Slot" / "Book This Date" failed with PGRST204
-- ("Could not find the 'is_private' column of 'availability'"). IF NOT EXISTS makes
-- this safe to re-run even where some columns already exist.

-- Private invite slots must not appear in the public musician gig browse.
ALTER TABLE availability ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

-- Distinguishes invite-originated bookings from open-application bookings.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source text DEFAULT 'application';

-- Musician's accept/decline state on a private invite (null = not yet responded).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invite_accepted boolean;

-- Optional note attached to an invite.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS note text;
