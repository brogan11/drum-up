#Drum Up

Live-music booking for restaurants and musicians. Post a slot or find a gig in minutes, message directly, and get paid automatically through Stripe.

Live: drum-up.app

##What it is

Drum Up is a two-sided marketplace that connects restaurants, cafés, and bars with independent local musicians. Venues post open slots — date, time, pay, and the vibe they want — and musicians browse nearby gigs, apply with a profile that doubles as a portfolio, and get booked.

Payment is handled end to end. The venue is charged when a booking is confirmed, the funds are held until the gig is performed, and the musician is paid out automatically afterward — no invoicing, no chasing, no cash. The platform is free to join and takes a single flat fee on confirmed bookings, with no subscriptions.

##There are three roles:

Restaurants — post slots, review applicants, confirm bookings.
Musicians — discover gigs, apply, build a profile, and get paid.
Fans — follow venues and discover live music nearby.

##Features

Multi-role authentication — sign-up and session handling for restaurant, musician, and fan accounts via Supabase Auth, with route protection enforced in Next.js middleware.
End-to-end payments — Stripe handles the full lifecycle: charge the venue on confirmation, hold the funds until the gig is performed, release an automatic payout to the musician, and free the hold on cancellation.
Direct messaging — venues and musicians coordinate a booking in a single thread, no email tag.
Location-based discovery — open slots and available talent are surfaced by distance and plotted on an interactive Leaflet map.
Profiles that double as portfolios — bios, performance videos, social links, past venues, and genre tags.
Transactional email — booking confirmations and status updates rendered with React Email and delivered through Resend.
Abuse protection — Upstash Redis-backed rate limiting on sensitive endpoints.

##Tech stack

LayerTechnologyFrameworkNext.js 16 (App Router), React 19LanguageTypeScriptStylingTailwind CSSDatabase & AuthSupabase — PostgreSQL, Auth, Row-Level Security, PLpgSQLPaymentsStripe — full payment lifecycle, Connect payouts, Stripe Elements on the clientEmailResend + React EmailRate limitingUpstash RedisMapsLeafletHostingVercel

##Architecture

Drum Up is a single full-stack Next.js application deployed on Vercel and backed by Supabase (managed PostgreSQL + Auth). The App Router serves both the UI (React Server and Client Components) and the backend (route handlers and server actions), so there is one deployable and no separate API server to run.

Browser  ── React 19 · Tailwind · Leaflet · Stripe Elements
   │
   ▼
Next.js 16 App Router ───────────────►  Vercel (hosting + edge middleware)
   ├─ Server Components & Route Handlers
   ├─ middleware.ts  (Supabase session refresh + route guards)
   └─ lib/           (Supabase + Stripe clients, rate limiting)
   │              │                │
   ▼              ▼                ▼
Supabase        Stripe          Resend
Postgres +     payments +     React Email
Auth + RLS     Connect        transactional
+ PLpgSQL      payouts        mail
   │
   ▼
Upstash Redis  (rate limiting)

Auth & sessions. Supabase Auth issues sessions; middleware.ts refreshes the session on each request and guards protected routes. Server-side reads/writes use the Supabase server client, while the browser client drives the auth UI.

Data & access control. The schema lives in supabase/migrations as versioned SQL, with PLpgSQL functions and Row-Level Security policies enforcing who can read or write each row — for example, a musician can only see their own applications, and a venue only manages its own slots.

Booking & payments. When a venue confirms a booking, the app creates a Stripe payment that holds the funds, and a Stripe webhook drives the booking through its states. After the gig, the payout is released to the musician's connected account; a cancellation releases the hold instead.

Notifications. Booking and status changes render React Email templates that are delivered through Resend.

Discovery. Listings are queried with distance filtering and rendered on a Leaflet map so users see gigs and talent near them.
