-- Drum Up — admin audit log (2026-06-05)
-- Run in the Supabase SQL editor.
--
-- Records every privileged action taken from the admin panel (bans, refunds,
-- payout releases, fee overrides, review removals, report resolutions, bulk
-- operations, and admin-sent emails). On a live-payments platform this is the
-- accountability trail: who did what, to whom, and when.
--
-- Written only via the service role (the /api/admin/* routes), so RLS is enabled
-- with NO policies — anon/authenticated can never read or write it.

create table if not exists public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor       text not null default 'admin',  -- reserved for future multi-admin
  action      text not null,                   -- e.g. 'ban_user', 'refund_booking'
  target_type text,                            -- 'user' | 'booking' | 'review' | 'report' | 'email'
  target_id   text,                            -- id of the affected row (or null for bulk/email)
  summary     text,                            -- human-readable one-liner
  metadata    jsonb                            -- structured before/after, counts, etc.
);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
create index if not exists admin_actions_target_idx on public.admin_actions (target_type, target_id);

alter table public.admin_actions enable row level security;
-- Intentionally no policies: service-role only.
