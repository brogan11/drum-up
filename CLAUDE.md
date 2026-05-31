# Drum Up — Project Context

## Overview
Drum Up is a two-sided marketplace platform (web + mobile) that connects restaurants seeking live music with musicians and bands looking for performance opportunities. Regular fans can also follow venues and artists to discover live music in their area.

## Business Model
- **Free tier** — profile creation, browsing, limited messaging
- **Booking fee** — 5–10% on bookings made through the app (primary revenue)
- **Pro Musician tier** — ~$12/month for unlimited videos, featured placement, analytics
- **Pro Venue tier** — ~$25/month for unlimited postings, promoted listings, verified musicians

**Important:** All payments must flow through Stripe Connect, never direct (no Venmo). This keeps booking fees on-platform.

---

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript, React 19)
- **Hosting:** Vercel (Hobby tier) — cron jobs defined in `vercel.json`
- **Database & Auth:** Supabase (with PostGIS extension for location queries)
- **Styling:** Tailwind CSS v3 with custom config
- **Payments:** ✅ Stripe Connect — **LIVE**. Connect Express onboarding for restaurants & musicians, payment intents with platform fee, delayed payouts released by cron, webhooks. (`stripe`, `@stripe/stripe-js`, `@stripe/react-stripe-js`)
- **Transactional Email:** ✅ Resend + React Email (`resend`, `react-email`, `@react-email/render`). Templates live in `emails/`.
- **Rate Limiting:** Upstash Redis + `@upstash/ratelimit` (`lib/ratelimit.ts`)
- **Messaging:** ✅ Built in-app (Supabase tables + realtime), see `components/MessagingTab.tsx`. Stream/Sendbird no longer planned.
- **Video:** Link to YouTube/Instagram for MVP, Cloudinary later
- **Geocoding:** Google Places Autocomplete + Browser Geolocation API

---

## Brand Colors (defined in `tailwind.config.ts`)

| Class | Hex | Usage |
|---|---|---|
| `graphite` | `#333333` | Nav, dark sections, headers |
| `chestnut` | `#DC7F41` | Primary CTAs, accents, links |
| `snow` | `#FCFAF9` | Page backgrounds, light text on dark |
| `teal` | `#6C9A8B` | Secondary buttons, success states |
| `charcoal` | `#5E5E5E` | Body text, borders, icons |

Also: `#E8E4E0` is used as the darker right-side background on auth pages and as the base for the dashboard/app page background (see below).

---

## Design System

- **Font:** Inter (loaded via next/font/google in layout.tsx)
- **Border radius:** `rounded-xl` for most elements
- **Shadows over borders:** Use `shadow-sm` resting → `shadow-md` on hover/focus instead of borders on inputs and cards
- **Cards:** White background, rounded-2xl, shadow-sm
- **Buttons:** chestnut for primary, teal for secondary, with `font-bold`
- **Logo:** DU monogram in chestnut. Located at `public/logo.png` (transparent bg). Use `next/image` to render. Always pair with "Drum Up" text in the navbar so first-time visitors know the brand name.
- **Dashboard/app page background:** `#E8E4E0` base with two soft radial glows — teal at top-left and chestnut at bottom-right. Apply as an inline style on the root wrapper:
  ```
  style={{ background: 'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0' }}
  ```
  Used on every authenticated app screen (restaurant, musician, fan dashboards, onboarding, settings). Provides warmth while keeping the UI light and readable.

---

## Database Schema (Supabase)

All tables have **Row Level Security (RLS) enabled**.
PostGIS extension is enabled for location-based queries (`CREATE EXTENSION IF NOT EXISTS postgis;`).
Schema changes are tracked as SQL files in `supabase/migrations/` — add a new dated migration rather than editing old ones.

### `profiles`
Stores all users — restaurants, musicians, and fans.
- `id` (uuid, FK → auth.users) — default `auth.uid()`
- `created_at` (timestamptz) — default `now()`
- `username` (text) — **UNIQUE** constraint
- `full_name` (text)
- `avatar_url` (text)
- `bio` (text)
- `user_type` (text) — `"restaurant"`, `"musician"`, or `"fan"`
- `location_text` (text) — human readable, e.g. "Philadelphia, PA"
- `latitude` (numeric) — for distance calculations
- `longitude` (numeric) — for distance calculations
- `website` (text)
- `instagram_url` (text)
- `tiktok_url` (text)
- `spotify_url` (text)
- `youtube_url` (text)
- `discovery_radius_miles` (integer) — saved browse-radius preference
- `stripe_account_id` (text) — Stripe Connect Express account
- `stripe_onboarded` (bool) — default `false`
- `notify_gig_alerts` (bool) — default `true` (gig-alert email opt-out)
- `last_message_email_at` (timestamptz) — throttles "new message" nudge emails

### `availability`
Restaurants post open slots for musicians.
- `id` (uuid) — default `gen_random_uuid()`
- `created_at` (timestamptz) — default `now()`
- `restaurant_id` (uuid, FK → profiles.id)
- `date` (date)
- `start_time` (time)
- `end_time` (time)
- `description` (text)
- `pay` (numeric)
- `status` (text) — `"open"`, `"filled"`, `"cancelled"`
- `latitude` (numeric)
- `longitude` (numeric)
- `is_private` (bool) — default `false`; private invite slots hidden from public gig browse

### `bookings`
Confirmed gigs between restaurants and musicians. Tracks payment.
- `id` (uuid) — default `gen_random_uuid()`
- `created_at` (timestamptz) — default `now()`
- `availability_id` (uuid, FK → availability.id)
- `restaurant_id` (uuid, FK → profiles.id)
- `musician_id` (uuid, FK → profiles.id)
- `status` (text) — `"pending"`, `"confirmed"`, `"cancelled"`
- `pay_amount` (numeric)
- `platform_fee` (numeric)
- `stripe_payment_id` (text)
- `stripe_payment_intent_id` (text)
- `stripe_transfer_id` (text)
- `payment_status` (text) — default `"unpaid"` (→ `"authorized"` on charge hold → `"paid"` on capture)
- `payout_released` (bool) — default `false`
- `payout_released_at` (timestamptz) — when the cron captured/released the payout (null if never/legacy)
- `source` (text) — default `"application"` (vs `"invite"`)
- `invite_accepted` (bool) — musician's accept/decline on a private invite (null = pending)
- `note` (text) — optional note attached to an invite

### `messages`
Direct messages between users, grouped into conversations.
- `id` (uuid) — default `gen_random_uuid()`
- `created_at` (timestamptz) — default `now()`
- `sender_id` (uuid, FK → profiles.id)
- `receiver_id` (uuid, FK → profiles.id)
- `content` (text)
- `read` (bool) — default `false`
- `conversation_id` (uuid)

### `message_reactions`
Emoji reactions on messages.
- `id` (uuid) — default `gen_random_uuid()`
- `message_id` (uuid, FK → messages.id, ON DELETE CASCADE)
- `user_id` (uuid, FK → profiles.id)
- `emoji` (text) — UNIQUE per (message, user, emoji)

### `follows`
Tracks fans/users following restaurants and musicians.
- `id` (uuid) — default `gen_random_uuid()`
- `created_at` (timestamptz) — default `now()`
- `follower_id` (uuid, FK → profiles.id)
- `following_id` (uuid, FK → profiles.id)

### `reviews`
Ratings + written reviews left after a booking. One review per (reviewer → reviewee).
- `id` (uuid) — default `gen_random_uuid()`
- `reviewer_id` / `reviewee_id` (uuid, FK → profiles.id)
- `booking_id` (uuid, FK → bookings.id)
- `rating` (integer 1–5)
- `review_text` (text)
- `verified` (bool) — default `false`
- `aspects` (jsonb) — per-category star ratings; keys depend on reviewee type (see `lib/reviews.ts`)
- `tags` (text[]) — selected highlight chips ("Paid promptly", "Crowd favorite"…)

### `musician_availability`
Musicians post dates/times they're open to play — the inverse of `availability`. Restaurants browse and invite.
- `id` (uuid) — default `gen_random_uuid()`
- `musician_id` (uuid, FK → profiles.id, ON DELETE CASCADE)
- `date` (date), `start_time` (time), `end_time` (time)
- `genres` (text[]), `min_pay` (numeric), `notes` (text)
- `status` (text) — default `"open"`
- `latitude` / `longitude` (numeric)

### `notifications`
In-app notification bell feed.
- `id` (uuid) — default `gen_random_uuid()`
- `user_id` (uuid, FK → profiles.id, ON DELETE CASCADE)
- `type` (text), `title` (text), `body` (text), `link` (text)
- `read` (bool) — default `false`

### `profile_views`
Tracks who viewed a profile (for analytics). UNIQUE per (profile, viewer).
- `id` (uuid) — default `gen_random_uuid()`
- `profile_id` / `viewer_id` (uuid, FK → profiles.id)
- `viewed_at` (timestamptz)

### `saved_items`
Personal bookmark list (retention feature).
- `id` (uuid) — default `gen_random_uuid()`
- `user_id` (uuid, FK → profiles.id, ON DELETE CASCADE)
- `item_type` (text) — `"gig"`, `"venue"`, or `"musician"`
- `item_id` (uuid) — UNIQUE per (user, item_type, item_id)

---

## Auth Flow

1. User signs up via `/auth/signup` — selects user_type (restaurant/musician/fan)
2. `user_type` saved to Supabase auth metadata via `options.data`
3. Alternatively, user can sign up via Google OAuth (Supabase OAuth with `signInWithOAuth`)
4. After signup → redirected to `/onboarding` (NOT dashboard)
5. After onboarding complete → redirected to `/dashboard`
6. On login, `/dashboard` reads `user.user_metadata.user_type`
7. Routes user to RestaurantDashboard, MusicianDashboard, or FanDashboard
8. Logout via `supabase.auth.signOut()` then `router.push('/')`

**Note:** Email confirmation pages exist (`/auth/confirm`, `/api/auth/check-email-confirmed`). Confirm the Supabase email-confirmation setting before going live.

---

## Onboarding Flow (`/onboarding`)

Triggered immediately after signup, before the user ever sees the dashboard. Must be completed (or skipped) before accessing the app. Show a progress bar across all steps.

### Step 1 — Basic Info (all user types)
- Full name
- Profile photo upload
- Location (browser geolocation auto-detect OR manual Google Places autocomplete)

### Step 2 — Role-Specific Info
- **Restaurant:** venue name, capacity, cuisine type, typical music nights, photos
- **Musician:** genre(s), instruments, solo/band, years performing, performance videos
- **Fan:** favorite genres, favorite venues (keep it light and optional)

### Step 3 — Social Links & Bio
- Short bio / description
- Instagram, TikTok, Spotify, YouTube links
- Website URL

**Key principles:**
- Let users skip steps — partial profile > abandoned signup
- Max 3 steps — don't overwhelm
- Save progress as they go — don't lose data if they close the tab
- On completion, create/update the `profiles` row in Supabase

---

## Location Strategy

Location is critical to the entire app — musicians need to find nearby gigs, restaurants need to find nearby talent, fans need to discover local shows.

### Two Layers
1. **Profile location** — user's home base, set during onboarding, stored in `profiles` table
2. **Browse/search location** — dynamic, defaults to profile location but can be changed. Users can search by city/zip with radius filter (10mi, 25mi, 50mi, 100mi)

### How to Capture
- **Primary:** Browser Geolocation API — one-click auto-detect during onboarding
- **Fallback:** Google Places Autocomplete input — user types a city/address, returns coordinates automatically
- Store both `location_text` (human readable) and `latitude`/`longitude` (for calculations)

### Distance Queries
Use PostGIS extension in Supabase for queries like "find all open gigs within 25 miles":
```sql
SELECT * FROM availability
WHERE status = 'open'
AND ST_DWithin(
  ST_MakePoint(longitude, latitude)::geography,
  ST_MakePoint(user_lng, user_lat)::geography,
  40234  -- 25 miles in meters
);
```

---

## Conventions

- All client components must start with `'use client'`
- Use `next/navigation`'s `useRouter` for client-side routing
- Supabase client is imported from `@/lib/supabase` (browser, anon key). For server/API routes that bypass RLS use `@/lib/supabase-admin` (service role).
- The Supabase URL and anon key are in `.env.local` (never commit this file)
- User type is stored in `auth.users.raw_user_meta_data.user_type` and must match the `user_type` column on the `profiles` row
- Use TypeScript — files end in .tsx for components, .ts for utilities
- Stick to the brand colors defined in tailwind.config.ts
- Match the existing design system — shadows not borders, rounded-xl, Inter font

### Environment Variables (`.env.local`)
- **Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stripe:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- **Email:** `RESEND_API_KEY`, `FROM_EMAIL`
- **Rate limiting (Upstash):** `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- **App:** `APP_URL`, `NEXT_PUBLIC_APP_URL`
- **Cron / Admin:** `CRON_SECRET` (guards cron routes), `ADMIN_PASSWORD` (admin panel login)

### Key lib helpers
- `lib/stripe.ts` (server SDK), `lib/stripe-client.ts` (browser)
- `lib/resend.ts` + `lib/send-email.ts` — transactional email senders; templates in `emails/`
- `lib/reviews.ts` — canonical review aspect/tag definitions + aggregate helpers per reviewee type
- `lib/analytics.ts` — time-bucketing, money formatting & deltas shared by the analytics pages
- `lib/distance.ts` — haversine/distance helpers; `lib/ics.ts` — calendar (.ics) generation
- `lib/admin-auth.ts` — hashes/verifies the admin session cookie (used by `middleware.ts`)
- `lib/genres.ts`, `lib/social-urls.ts`, `lib/generate-username.ts`, `lib/time.ts`, `lib/saved.ts`, `lib/ratelimit.ts`

### Shared analytics/chart components
- `components/Charts.tsx` — dependency-free SVG/HTML charts (AreaChart, BarChart, Donut, HBars, Radar, Sparkline), all with hover tooltips. Brand palette in the exported `CHART` object.
- `components/AnalyticsUI.tsx` — KPI card, section card, range tabs, header, insights card (shared by both analytics pages).

### Database access & connections
- **Always use `@supabase/supabase-js`** (anon client `@/lib/supabase`, or service-role `@/lib/supabase-admin`). It talks to Supabase over the **REST API (PostgREST)**, Auth, and Realtime — all of which **pool** their own DB connections, so user traffic does NOT map 1:1 to Postgres connections. The Supabase "Database Connections" graph baseline (~20, ceiling scales with compute tier) is mostly internal services and stays flat under load.
- **Do NOT add a direct-connection driver** (`pg`, Prisma, Drizzle, `postgres.js`) in Vercel serverless functions — each invocation opens its own connection and exhausts the limit under load. If direct SQL is ever required, use the **Supavisor pooler** connection string (port **6543**, transaction mode), never the direct `5432` string.

---

## Built So Far

### Foundation & Auth
- ✅ Next.js 16 / React 19 project scaffolded and deployed to Vercel
- ✅ Supabase connected; full schema across 11 tables with RLS + dated migrations in `supabase/migrations/`
- ✅ Tailwind configured with brand colors; shared design system + shimmer/fade animations
- ✅ Homepage (hero, how-it-works, features, pricing, footer), Terms (`/terms`) & Privacy (`/privacy`) pages
- ✅ Signup & login pages (split screen, animated wave divider), Google OAuth callback, email-confirm flow
- ✅ Dashboard router detecting user_type → three dashboards (restaurant/musician/fan) with bottom tab bar
- ✅ DU logo in project

### Onboarding & Profiles
- ✅ 3-step onboarding flow (`/onboarding`) with progress bar, skip, and save-as-you-go
- ✅ Location capture (browser geolocation + Google Places autocomplete), stored as text + lat/lng
- ✅ PostGIS distance queries for nearby gigs/talent; radius filter with saved `discovery_radius_miles`
- ✅ Public profile pages (`/profile/[username]`) with reviews, profile-view tracking
- ✅ Settings page (`/settings`) — profile editing, notification prefs, Stripe management

### Marketplace Core
- ✅ Restaurant availability posting; musician browse/apply flow with distance filtering
- ✅ Musician availability calendar — musicians post open dates; restaurants browse & invite
- ✅ Gig invite flow (private slots): `/api/bookings/invite` + `/api/bookings/respond-invite`
- ✅ Booking lifecycle (apply → accept/decline → confirm → cancel) with realtime updates
- ✅ Fan events discovery tab; follow venues/artists; saved/bookmark items
- ✅ Genre selector, Add-to-Calendar (.ics), avatars, save buttons, skeletons, toasts

### Messaging & Notifications
- ✅ In-app direct messaging (`components/MessagingTab.tsx`) with Supabase realtime + emoji reactions
- ✅ Notification bell (`components/NotificationBell.tsx`) backed by `notifications` table
- ✅ Notification API routes for new gig, new application, application accepted/declined, booking confirmed, cancellation, new message
- ✅ Transactional emails via Resend + React Email (`emails/`): new gig, new application, application accepted/declined, booking confirmed, cancellation, gig reminder, payout released, new message (throttled)

### Payments (Stripe Connect — LIVE)
- ✅ Stripe Connect Express onboarding (`/api/stripe/connect`, `/connect/status`, `/verify`) with re-onboarding when account id is null
- ✅ Payment intents with **8% platform fee** (`/api/stripe/payment-intent`) — musician nets 92%, restaurant pays the full amount
- ✅ Delayed payout release via daily cron (`/api/stripe/release-payout`, 12:00 UTC); stamps `payout_released_at` on capture
- ✅ Stripe webhook handler (`/api/stripe/webhook`)
- ✅ **Payment history & receipts** (`/dashboard/payments`) — income ledger for musicians / spend ledger for venues, with status filters + summary totals; printable per-gig receipts at `/dashboard/payments/receipt/[id]` (browser print-to-PDF, no deps)

### Analytics (`/dashboard/analytics` — routes by user_type)
- ✅ **Musician analytics** — net earnings, pending payouts, gigs played, profile views (+Δ), avg rating, followers; charts for earnings, views, follower growth, booking breakdown, rating distribution, performance-by-aspect radar, top venues, review-tag chips; auto-generated insights
- ✅ **Restaurant analytics** — talent spend, committed spend, **fill rate**, **applications (per slot)**, views, venue rating; charts for spend, applications, views, follower growth, slot-status donut, venue-rating radar, rating distribution, top talent; auto-generated insights
- ✅ All charts have interactive hover tooltips; shared chart + UI + math via `components/Charts.tsx`, `components/AnalyticsUI.tsx`, `lib/analytics.ts`
- ✅ Profile-view tracking fixed — the `/profile/[username]` upsert is now `await`ed and runs before the UUID→username redirect (was a silent no-op)
- ✅ Social/website "Links" cards removed from the musician & restaurant **own-dashboard** profile tabs (still shown on public profiles; editable via Settings)

### Reviews
- ✅ Full review system: overall rating + per-aspect category ratings + highlight tag chips (aspects/tags differ for musician vs restaurant reviewees — see `lib/reviews.ts`), one review per reviewer→reviewee, reputation summaries + rating badges

### Admin
- ✅ Password-protected admin panel (`/admin`) guarded by `middleware.ts` + signed cookie
- ✅ Admin login/logout and dashboard with stats, users, bookings, and reports API routes

### Ops
- ✅ Vercel cron jobs (`vercel.json`): daily payout release + daily gig reminders (`/api/cron/gig-reminders`, 09:00 UTC), guarded by `CRON_SECRET`
- ✅ Upstash rate limiting (`lib/ratelimit.ts`)
- ✅ Error boundaries (`app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`)

## What's Next

- Pro tier subscriptions (Pro Musician / Pro Venue billing via Stripe Billing — separate from Connect)
- Featured/promoted placement for Pro accounts
- Verification badges (musician/venue) — `reviews.verified` + admin tooling exist; needs UI
- Richer search/filters + map view (genre, pay range, date — uses existing PostGIS lat/lng)
- Apple OAuth (requires Apple Developer account)
- Native mobile app
- Error monitoring (Sentry) + a basic test suite (no `test` script yet)
- **Security — lock down `profiles` column access:** `anon`/`authenticated` can currently SELECT *all* columns of `profiles` directly via PostgREST (RLS allows the row read and can't restrict columns), so sensitive fields like `stripe_account_id` and `legal_name` are reachable by a crafted query. The app only avoids this by convention (selecting safe columns). Fix with column-level `REVOKE SELECT (...) ON profiles FROM anon, authenticated`, or expose public reads via a `security_invoker` view of safe columns and revoke direct base-table SELECT from `anon`. (Found 2026-05-31 during Supabase advisor review; see `supabase/migrations/2026_05_31_security_advisor.sql` which dropped the related leaky `public_profiles` view.)
- Re-verify Supabase email confirmation before public launch

---

## Important Reminders

- **Never use Venmo or off-platform payment links** — would bypass our booking fee
- **Always paraphrase social links into displays, never let users share payment info**
- **Stick to the brand colors** defined in tailwind.config.ts
- **Match the existing design system** — shadows not borders, rounded-xl, Inter font
- **Use TypeScript** — files end in .tsx for components, .ts for utilities
- **Location is required** — every profile needs location_text + lat/lng for the marketplace to work
- **Onboarding before dashboard** — new users must go through onboarding first
- **Logo usage** — always pair the DU monogram with "Drum Up" text in navigation