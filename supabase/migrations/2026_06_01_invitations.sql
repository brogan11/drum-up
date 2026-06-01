-- Drum Up — off-platform invitations (2026-06-01)
-- Run in the Supabase SQL editor.
--
-- Lets an existing user invite a real-world contact (a venue they play / a musician
-- they book) onto the platform by email. Pure referral: no seeded profile row — the
-- invitee signs up & onboards normally, and on completion we auto-connect both sides.

create table if not exists public.invitations (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  inviter_id    uuid not null references public.profiles(id) on delete cascade,
  invitee_email text not null,
  invitee_name  text,
  invited_role  text not null check (invited_role in ('restaurant', 'musician')),
  token         text not null unique default gen_random_uuid()::text,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  accepted_by   uuid references public.profiles(id) on delete set null,
  accepted_at   timestamptz
);

-- One active invite per (inviter, email).
create unique index if not exists invitations_unique_pending
  on public.invitations (inviter_id, lower(invitee_email))
  where status = 'pending';

create index if not exists invitations_token_idx on public.invitations(token);

alter table public.invitations enable row level security;

do $$
declare r record;
begin
  for r in (select policyname from pg_policies
            where schemaname='public' and tablename='invitations') loop
    execute format('drop policy %I on public.invitations', r.policyname);
  end loop;
end $$;

-- A user can read and create invites they sent. Anonymous token lookups and the
-- accept flow run through service-role API routes, so no anon/cross-user policy
-- is exposed on the base table.
create policy "inv_select_own"
  on public.invitations for select
  to authenticated
  using (auth.uid() = inviter_id);

create policy "inv_insert_own"
  on public.invitations for insert
  to authenticated
  with check (auth.uid() = inviter_id);
