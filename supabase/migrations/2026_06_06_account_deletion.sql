-- Drum Up — account deletion / right-to-erasure support (2026-06-06)
-- Run in the Supabase SQL editor.
--
-- Implements the Privacy Policy's deletion commitment (§7 Account Deletion / §6
-- Retention): when a user deletes their account we erase personal data and
-- personal content immediately, but BOOKING/PAYMENT rows must be retained (in
-- anonymized form) for up to 7 years for tax & accounting. We therefore cannot
-- always hard-delete the profiles row (bookings FK-reference it), so users who
-- have financial history are anonymized in place and flagged with deleted_at.
--
--   deleted_at — timestamp the account was deleted/anonymized. NULL = active.
--                Used to hide the profile from public pages and listings.

alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_at_idx on public.profiles (deleted_at);

-- Let the profiles guard trigger (2026_06_02 / 2026_06_04) keep blocking client
-- writes to server-only columns — deleted_at is only ever set by the service
-- role via /api/account/delete, so no policy change is required here. Clients
-- already cannot write arbitrary columns; this column is server-managed.
