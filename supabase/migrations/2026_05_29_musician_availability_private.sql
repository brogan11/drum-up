-- Musician-initiated availability offers sent directly in chat should not appear in
-- the public "musicians available" browse (mirrors availability.is_private for the
-- restaurant gig-invite flow). Existing rows backfill to false via the DEFAULT.
ALTER TABLE musician_availability ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
