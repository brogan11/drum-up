-- Generate usernames for existing profiles that have null usernames.
-- Run steps 1–3 in the Supabase SQL Editor in order.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. DIAGNOSE — see which profiles are missing usernames
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id, full_name, username
FROM profiles
WHERE username IS NULL
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL — generate a basic slug from full_name for profiles with no username
--    Duplicates get a numeric suffix appended manually if needed after running.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE profiles
SET username = LOWER(
  TRIM(BOTH '-' FROM
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(COALESCE(full_name, 'user')),
        '[^a-zA-Z0-9\s]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  )
)
WHERE username IS NULL
  AND full_name IS NOT NULL;

-- Set a fallback for profiles with no full_name either
UPDATE profiles
SET username = 'user-' || LEFT(id::text, 8)
WHERE username IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ADD CONSTRAINTS (safe to run even if they already exist via IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Unique username
ALTER TABLE profiles
ADD CONSTRAINT IF NOT EXISTS profiles_username_key
UNIQUE (username);

-- Format check: lowercase letters, numbers, hyphens; no leading/trailing hyphen
ALTER TABLE profiles
ADD CONSTRAINT IF NOT EXISTS profiles_username_format
CHECK (
  username ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'
  OR (LENGTH(username) = 1 AND username ~ '^[a-z0-9]$')
);
