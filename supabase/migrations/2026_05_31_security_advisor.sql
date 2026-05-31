-- Supabase security advisor fixes (2026-05-31)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Drop the unused, leaky `public_profiles` view.
--    Findings (verified against the live DB):
--      * Defined with SECURITY DEFINER → bypasses Row Level Security (runs as owner).
--      * Readable by the anonymous (logged-out) role.
--      * Exposed `stripe_account_id` (and 20 other columns) to anyone.
--      * NOT referenced anywhere in the app — the public profile page queries the
--        `profiles` table directly with an explicit safe column list. No migration
--        creates this view; it was a manual leftover.
--    Dropping it removes the exposure with zero app impact. If you ever want a public
--    read surface, recreate it WITH (security_invoker = on) and WITHOUT the
--    stripe_account_id / stripe_onboarded columns.
DROP VIEW IF EXISTS public.public_profiles;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. public.spatial_ref_sys (RLS disabled) — NO ACTION NEEDED.
--    This is a PostGIS system table (~8,500 rows of EPSG coordinate-system reference
--    data, zero user data), owned by the postgis extension. You generally cannot enable
--    RLS on it ("must be owner of table spatial_ref_sys") and doing so could break
--    PostGIS. This advisor warning is a known benign false-positive — acknowledge/dismiss
--    it in the Supabase dashboard.
