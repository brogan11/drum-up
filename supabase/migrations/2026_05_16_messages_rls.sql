-- Drum Up — messages RLS + follows RLS
-- Run in Supabase SQL editor.

alter table public.messages enable row level security;

do $$
declare r record;
begin
  for r in (select policyname from pg_policies
            where schemaname='public' and tablename='messages') loop
    execute format('drop policy %I on public.messages', r.policyname);
  end loop;
end $$;

create policy "msg_select_party"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "msg_insert_sender"
  on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "msg_update_receiver"
  on public.messages for update
  using (auth.uid() = receiver_id);

create index if not exists messages_conversation_idx on public.messages(conversation_id);
create index if not exists messages_sender_idx       on public.messages(sender_id);
create index if not exists messages_receiver_idx     on public.messages(receiver_id);

-- Follows table RLS (if not already done)
alter table public.follows enable row level security;

do $$
declare r record;
begin
  for r in (select policyname from pg_policies
            where schemaname='public' and tablename='follows') loop
    execute format('drop policy %I on public.follows', r.policyname);
  end loop;
end $$;

create policy "follows_select_all"
  on public.follows for select
  using (true);

create policy "follows_insert_self"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "follows_delete_self"
  on public.follows for delete
  using (auth.uid() = follower_id);
