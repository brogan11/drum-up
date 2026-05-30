-- Richer reviews: per-category aspect ratings + highlight tags.
-- The existing reviews table only stored a single overall `rating` + free text. We add:
--   * aspects — jsonb map of { aspectKey: 1..5 }, the categories depend on who is being
--     reviewed (a restaurant rating a musician scores different things than a musician
--     rating a restaurant). See lib/reviews.ts for the canonical keys.
--   * tags    — text[] of selected highlight chips ("Paid promptly", "Crowd favorite"…).
-- Both are optional; an overall star rating is still required. Safe to re-run.
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS aspects jsonb DEFAULT '{}'::jsonb;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[];

-- One review per reviewer → reviewee. Mirrors the app's existing "already reviewed"
-- check and stops a user from spamming multiple reviews onto the same profile. A
-- partial-safe unique index (skips rows where either id is null, which shouldn't occur).
CREATE UNIQUE INDEX IF NOT EXISTS reviews_reviewer_reviewee_uniq
  ON reviews (reviewer_id, reviewee_id)
  WHERE reviewer_id IS NOT NULL AND reviewee_id IS NOT NULL;
