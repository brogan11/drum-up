-- Drum Up — record legal acceptance (2026-06-07)
-- Run in the Supabase SQL editor.
--
-- Stores when (and which version of) the Terms of Service and Privacy Policy a
-- user agreed to during onboarding. This is the consent evidence trail — useful
-- for compliance and shown to operators in the admin user drawer.
--
--   terms_accepted_at    — timestamp the user accepted the Terms of Service
--   privacy_accepted_at  — timestamp the user accepted the Privacy Policy
--   legal_version        — the effective date of the docs they agreed to
--                          (LEGAL_EFFECTIVE_DATE in components/legal.tsx)

alter table public.profiles
  add column if not exists terms_accepted_at   timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists legal_version       text;
