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
- **Database & Auth:** Supabase
- **Styling:** Tailwind CSS v3 with custom config
- **Payments:** Stripe Connect (planned, not yet integrated)
- **Messaging:** Stream or Sendbird (planned)
- **Video:** Link to YouTube/Instagram for MVP, Cloudinary later

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

---

## Database Schema (Supabase)

All tables have **Row Level Security (RLS) enabled**.

### `profiles`
Stores all users — restaurants, musicians, and fans.
- `id` (uuid, FK → auth.users) — default `auth.uid()`
- `created_at` (timestamptz) — default `now()`
- `username` (text)
- `full_name` (text)
- `avatar_url` (text)
- `bio` (text)
- `user_type` (text) — `"restaurant"`, `"musician"`, or `"fan"`
- `location` (text)
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

## Conventions

- All client components must start with `'use client'`
- Use `next/navigation`'s `useRouter` for client-side routing
- Supabase client is imported from `@/lib/supabase`
- The Supabase URL and anon key are in `.env.local` (never commit this file)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- User type is stored in `auth.users.raw_user_meta_data.user_type` and must match the `user_type` column on the `profiles` row

---

## Auth Flow

1. User signs up via `/auth/signup` — selects user_type (restaurant/musician/fan)
2. `user_type` saved to Supabase auth metadata via `options.data`
3. On login, `/dashboard` reads `user.user_metadata.user_type`
4. Routes user to RestaurantDashboard, MusicianDashboard, or FanDashboard
5. Logout via `supabase.auth.signOut()` then `router.push('/')`

**Note:** Email confirmation is currently disabled for development. Re-enable before going live.

---

## Built So Far

- ✅ Next.js project scaffolded and deployed to Vercel
- ✅ Supabase connected with all 5 tables
- ✅ Tailwind configured with brand colors
- ✅ Homepage with hero, how-it-works, features, pricing, testimonials, footer
- ✅ Signup page with split screen layout and animated wave divider
- ✅ Login page matching signup style
- ✅ Dashboard router that detects user_type
- ✅ Three dashboard variants (restaurant, musician, fan) — basic shell

## What's Next

- Instagram-style bottom tab navigation on dashboards
- Profile editing page for each user type
- Availability posting form for restaurants
- Browse/apply flow for musicians
- Feed view for fans
- Direct messaging UI
- Stripe Connect integration for payments
- Reviews and ratings system

---

## Important Reminders

- **Never use Venmo or off-platform payment links** — would bypass our booking fee
- **Always paraphrase social links into displays, never let users share payment info**
- **Stick to the brand colors** defined in tailwind.config.ts
- **Match the existing design system** — shadows not borders, rounded-xl, Inter font
- **Use TypeScript** — files end in .tsx for components, .ts for utilities