ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'application',
  ADD COLUMN IF NOT EXISTS invite_accepted boolean DEFAULT null;
