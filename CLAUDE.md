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

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Hosting:** Vercel (Hobby tier)
- **Database & Auth:** Supabase (with PostGIS extension for location queries)
- **Styling:** Tailwind CSS v3 with custom config
- **Payments:** Stripe Connect (planned, not yet integrated)
- **Messaging:** Stream or Sendbird (planned)
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

Also: `#E8E4E0` is used as the darker right-side background on auth pages.

---

## Design System

- **Font:** Inter (loaded via next/font/google in layout.tsx)
- **Border radius:** `rounded-xl` for most elements
- **Shadows over borders:** Use `shadow-sm` resting → `shadow-md` on hover/focus instead of borders on inputs and cards
- **Cards:** White background, rounded-2xl, shadow-sm
- **Buttons:** chestnut for primary, teal for secondary, with `font-bold`
- **Logo:** DU monogram in chestnut. Located at `public/logo.png` (transparent bg). Use `next/image` to render. Always pair with "Drum Up" text in the navbar so first-time visitors know the brand name.

---

## Database Schema (Supabase)

All tables have **Row Level Security (RLS) enabled**.
PostGIS extension is enabled for location-based queries (`CREATE EXTENSION IF NOT EXISTS postgis;`).

### `profiles`
Stores all users — restaurants, musicians, and fans.
- `id` (uuid, FK → auth.users) — default `auth.uid()`
- `created_at` (timestamptz) — default `now()`
- `username` (text)
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

### `messages`
Direct messages between users, grouped into conversations.
- `id` (uuid) — default `gen_random_uuid()`
- `created_at` (timestamptz) — default `now()`
- `sender_id` (uuid, FK → profiles.id)
- `receiver_id` (uuid, FK → profiles.id)
- `content` (text)
- `read` (bool) — default `false`
- `conversation_id` (uuid)

### `follows`
Tracks fans/users following restaurants and musicians.
- `id` (uuid) — default `gen_random_uuid()`
- `created_at` (timestamptz) — default `now()`
- `follower_id` (uuid, FK → profiles.id)
- `following_id` (uuid, FK → profiles.id)

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

**Note:** Email confirmation is currently disabled for development. Re-enable before going live.

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
- Supabase client is imported from `@/lib/supabase`
- The Supabase URL and anon key are in `.env.local` (never commit this file)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- User type is stored in `auth.users.raw_user_meta_data.user_type` and must match the `user_type` column on the `profiles` row
- Use TypeScript — files end in .tsx for components, .ts for utilities
- Stick to the brand colors defined in tailwind.config.ts
- Match the existing design system — shadows not borders, rounded-xl, Inter font

---

## Built So Far

- ✅ Next.js project scaffolded and deployed to Vercel
- ✅ Supabase connected with all 5 tables
- ✅ Tailwind configured with brand colors
- ✅ Homepage with hero, how-it-works, features, pricing, footer
- ✅ Signup page with split screen layout and animated wave divider
- ✅ Login page matching signup style
- ✅ Google OAuth callback handler
- ✅ Dashboard router that detects user_type
- ✅ Three dashboard variants (restaurant, musician, fan) with bottom tab bar navigation
- ✅ DU logo created and added to project

## What's Next

- Onboarding flow (3-step profile setup after signup)
- Location capture during onboarding (geolocation + Google Places)
- PostGIS setup in Supabase for distance queries
- Profile editing page for each user type
- Availability posting form for restaurants
- Browse/apply flow for musicians with distance filtering
- Feed view for fans
- Direct messaging UI
- Stripe Connect integration for payments
- Reviews and ratings system
- Apple OAuth (requires Apple Developer account)

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