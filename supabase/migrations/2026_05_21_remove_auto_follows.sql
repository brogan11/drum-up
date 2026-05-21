-- Bug fix: Remove any database triggers that auto-create follow relationships.
-- New accounts were being created with automatic follows to test accounts.
-- No application code does this, so it must be a trigger/function in the database.
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Step 1 will show you what exists; steps 2-4 clean it up.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DIAGNOSE — run this first to see what you have
-- ─────────────────────────────────────────────────────────────────────────────

-- Show all triggers on auth.users and public.profiles
SELECT
  trigger_schema,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('users', 'profiles')
ORDER BY event_object_table, trigger_name;

-- Show any functions whose body references the follows table
SELECT proname AS function_name, prosrc AS function_body
FROM pg_proc
WHERE prosrc ILIKE '%follows%';

-- Show the 20 most recent follows (to confirm the problem is real)
SELECT
  f.id,
  f.created_at,
  follower.username  AS follower_username,
  follower.user_type AS follower_type,
  following.username AS following_username
FROM public.follows f
LEFT JOIN public.profiles follower  ON follower.id  = f.follower_id
LEFT JOIN public.profiles following ON following.id = f.following_id
ORDER BY f.created_at DESC
LIMIT 20;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DROP any auto-follow trigger + its backing function
--    (replace the names below with whatever step 1 revealed)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop common names used in Supabase starter templates / AI-generated code.
-- Each DROP is safe to run even if the object doesn't exist (IF EXISTS).

DROP TRIGGER IF EXISTS on_new_user_auto_follow   ON auth.users;
DROP TRIGGER IF EXISTS auto_follow_on_signup      ON auth.users;
DROP TRIGGER IF EXISTS create_default_follows     ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created_follow  ON public.profiles;
DROP TRIGGER IF EXISTS auto_follow_trigger         ON public.profiles;

DROP FUNCTION IF EXISTS public.auto_follow_test_accounts()  CASCADE;
DROP FUNCTION IF EXISTS public.create_default_follows()     CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user_follows()    CASCADE;
DROP FUNCTION IF EXISTS public.seed_follows_for_new_user()  CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REMOVE seed / ghost follows
--    Delete follows where the follower signed up after a certain date
--    (adjust the date to the day you first noticed the bug).
--    This preserves real follows made before you started testing.
-- ─────────────────────────────────────────────────────────────────────────────

-- Preview what will be removed before running the DELETE:
/*
SELECT f.*, follower.full_name AS follower_name, following.full_name AS following_name
FROM public.follows f
JOIN public.profiles follower  ON follower.id = f.follower_id
JOIN public.profiles following ON following.id = f.following_id
WHERE f.follower_id IN (
  SELECT id FROM auth.users WHERE created_at >= '2026-05-01'
)
ORDER BY f.created_at DESC;
*/

-- Once you've confirmed the preview looks right, run the DELETE:
/*
DELETE FROM public.follows
WHERE follower_id IN (
  SELECT id FROM auth.users WHERE created_at >= '2026-05-01'
);
*/


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. NUCLEAR option — wipe all follows and start clean
--    Only use this if all follows in the table are test data.
-- ─────────────────────────────────────────────────────────────────────────────

-- TRUNCATE public.follows;
