-- Drum Up — onboarding flow migration
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

-- 1. Enable PostGIS so we can do geo queries later (distance from venue, etc.)
create extension if not exists postgis;

-- 2. Add the onboarding columns to profiles
alter table public.profiles
  add column if not exists location_text text,
  add column if not exists latitude      double precision,
  add column if not exists longitude     double precision,
  add column if not exists role_metadata jsonb default '{}'::jsonb;

-- 3. Make sure RLS lets a user upsert their own profile row
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone"     on public.profiles;
drop policy if exists "Users can insert their own profile"    on public.profiles;
drop policy if exists "Users can update their own profile"    on public.profiles;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 4. Avatars storage bucket (public-readable, user-writable to their own folder)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars are publicly readable"      on storage.objects;
drop policy if exists "Users can upload their own avatar"  on storage.objects;
drop policy if exists "Users can update their own avatar"  on storage.objects;
drop policy if exists "Users can delete their own avatar"  on storage.objects;

create policy "Avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
