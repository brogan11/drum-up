-- Drum Up — follows RLS
-- Run in Supabase SQL editor.
-- Enables fans (and anyone) to follow/unfollow restaurants and musicians.

alter table public.follows enable row level security;

do $$
declare r record;
begin
  for r in (select policyname from pg_policies
            where schemaname='public' and tablename='follows') loop
    execute format('drop policy %I on public.follows', r.policyname);
  end loop;
end $$;

-- Anyone can see who follows whom (needed for follower counts).
create policy "fl_select_authenticated"
  on public.follows for select
  to authenticated
  using (true);

-- Users can only create follows where they are the follower.
create policy "fl_insert_self"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

-- Users can only delete their own follows.
create policy "fl_delete_self"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- Indexes for common lookups.
create index if not exists follows_follower_idx  on public.follows(follower_id);
create index if not exists follows_following_idx on public.follows(following_id);
