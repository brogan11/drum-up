'use client'

import { useState } from 'react'
import Link from 'next/link'
import { eqBarStyle } from '@/lib/eq'

const EQ_BARS = 36

const MARQUEE_WORDS = [
  'ACOUSTIC SETS', 'JAZZ NIGHTS', 'BRUNCH SESSIONS', 'OPEN MIC',
  'INDIE BANDS', 'SOLO ARTISTS', 'ROOFTOP SHOWS', 'SUNDAY BLUES',
  'WINE & WAX', 'CAFE TUNES', 'SOUL DUOS', 'LATE-NIGHT KEYS',
]

const GIG_CARDS = [
  {
    venue: 'The Rusty Nail',
    day: 'Friday, Jun 6',
    time: '8:00 – 11:00 PM',
    pay: 150,
    genres: ['Jazz', 'Acoustic'],
    location: 'Old City, Philadelphia',
    distance: '0.8 mi',
    note: 'Indoor patio, intimate crowd, 40 seats',
  },
  {
    venue: 'Bravo Bistro',
    day: 'Saturday, Jun 7',
    time: '7:00 – 10:00 PM',
    pay: 200,
    genres: ['Ambient', 'Instrumental'],
    location: 'Rittenhouse, Philadelphia',
    distance: '1.4 mi',
    note: 'Seated dining, background set preferred',
  },
  {
    venue: 'Harbor House',
    day: 'Sunday, Jun 8',
    time: '11:00 AM – 2:00 PM',
    pay: 125,
    genres: ['Folk', 'Singer-Songwriter'],
    location: 'Fishtown, Philadelphia',
    distance: '2.1 mi',
    note: 'Brunch service, 60-seat patio',
  },
  {
    venue: "Lola's Kitchen",
    day: 'Thursday, Jun 12',
    time: '9:00 PM – 12:00 AM',
    pay: 175,
    genres: ['R&B', 'Soul'],
    location: 'South Philadelphia',
    distance: '3.2 mi',
    note: 'Late-night crowd, high energy welcome',
  },
]

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="12" y1="14" x2="12" y2="18" />
      <line x1="10" y1="16" x2="14" y2="16" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconZap() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}

function IconPin() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function IconClock() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconCalSmall() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconHouse() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconMusic() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

function IconTick() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

// ── Step data ─────────────────────────────────────────────────────────────────

const RESTAURANT_STEPS = [
  {
    num: '01',
    icon: <IconCalendar />,
    title: 'Post a slot',
    desc: 'Pick a date, set your hours, name your pay rate, describe the vibe. Your listing is live in under two minutes.',
  },
  {
    num: '02',
    icon: <IconUsers />,
    title: 'Review applicants',
    desc: 'Browse musician profiles, watch their videos, read their pitch. You decide who steps on your stage.',
  },
  {
    num: '03',
    icon: <IconCheck />,
    title: 'Show night sorted',
    desc: 'Confirm the booking and Drum Up handles payment after the gig. You focus on your guests.',
  },
]

const MUSICIAN_STEPS = [
  {
    num: '01',
    icon: <IconSearch />,
    title: 'Browse open gigs',
    desc: 'Every open slot near you, filtered by date, distance, genre, and pay. No cold emails, no middlemen.',
  },
  {
    num: '02',
    icon: <IconSend />,
    title: 'Send your pitch',
    desc: 'Your profile is your resume. Link your best clips and reach out directly to the booker.',
  },
  {
    num: '03',
    icon: <IconZap />,
    title: 'Get paid automatically',
    desc: 'After the gig, funds land in your account through Stripe. No invoices, no chasing, no cash-app awkwardness.',
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function HomePage() {
  const [tab, setTab] = useState<'restaurant' | 'musician'>('restaurant')

  return (
    <div className="min-h-screen bg-snow overflow-x-hidden" style={{ scrollBehavior: 'smooth' }}>

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-graphite/85 border-b border-charcoal/20">
        <div className="flex items-center justify-between px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg p-1">
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-snow text-xl font-black tracking-tight">Drum Up</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="#how" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">How It Works</Link>
            <Link href="#why" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">Why Us</Link>
            <Link href="/auth/login" className="text-snow hover:text-chestnut transition-colors font-medium">Log In</Link>
            <Link href="/auth/signup" className="bg-chestnut text-snow px-5 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen bg-graphite overflow-hidden pt-20 flex flex-col justify-center">

        {/* EQ bars */}
        <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.12] pointer-events-none">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div key={i} className="eq-bar w-2 md:w-3 bg-chestnut rounded-t" style={eqBarStyle(i, 11)} />
          ))}
        </div>

        {/* Stage glows */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-chestnut opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-teal opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-chestnut opacity-[0.08] blur-3xl pointer-events-none" />

        <div className="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full py-20">

          {/* Live indicator */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chestnut opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-chestnut" />
            </span>
            <p className="text-teal text-xs md:text-sm font-semibold uppercase tracking-[0.35em]">Live Music Booking, Reimagined</p>
          </div>

          {/* Headline */}
          <h1 className="text-center text-snow font-black leading-[0.85] tracking-tight">
            <span className="block text-[16vw] md:text-[11vw]">BOOK THE</span>
            <span className="block text-[16vw] md:text-[11vw] text-chestnut italic">SOUND</span>
            <span className="block text-[16vw] md:text-[11vw]">OF TONIGHT.</span>
          </h1>

          <p className="text-snow/70 text-lg md:text-xl mt-10 max-w-xl mx-auto text-center leading-relaxed">
            Restaurants fill slow nights. Musicians fill their calendars.
            One platform, no middlemen, no mystery fees.
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link
              href="/auth/signup"
              className="bg-chestnut text-snow px-8 py-4 rounded-xl font-bold text-base hover:opacity-90 transition-opacity shadow-lg inline-flex items-center justify-center gap-2.5 group"
            >
              <IconHouse />
              I&apos;m a Restaurant
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/auth/signup"
              className="border-2 border-snow/30 text-snow px-8 py-4 rounded-xl font-bold text-base hover:border-chestnut hover:text-chestnut transition-colors inline-flex items-center justify-center gap-2.5 group"
            >
              <IconMusic />
              I&apos;m a Musician
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          <p className="text-center text-snow/40 text-sm mt-6">
            Browsing the scene?{' '}
            <Link href="/auth/signup" className="underline underline-offset-2 hover:text-snow/60 transition-colors">
              Join as a fan →
            </Link>
          </p>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-snow/30 text-xs uppercase tracking-[0.35em] font-semibold">
          Scroll
        </div>
      </section>

      {/* ── MARQUEE BAND ── */}
      <div className="bg-chestnut py-5 overflow-hidden border-y-4 border-graphite">
        <div className="marquee-track flex">
          {Array.from({ length: 2 }).map((_, group) => (
            <div key={group} className="flex shrink-0">
              {MARQUEE_WORDS.map((t, i) => (
                <span key={`${group}-${i}`} className="flex items-center gap-10 pr-10 text-snow font-black text-2xl md:text-3xl tracking-wider whitespace-nowrap">
                  {t}
                  <span className="text-graphite text-base">●</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="bg-snow py-28 md:py-36 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="text-graphite text-4xl md:text-5xl font-black mb-8 leading-tight">
              Three steps. <span className="text-chestnut italic">Both sides.</span>
            </h2>

            {/* Pill switcher */}
            <div className="inline-flex bg-graphite/10 rounded-full p-1.5 gap-1">
              <button
                onClick={() => setTab('restaurant')}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                  tab === 'restaurant'
                    ? 'bg-graphite text-snow shadow-md'
                    : 'text-charcoal hover:text-graphite'
                }`}
              >
                For Restaurants
              </button>
              <button
                onClick={() => setTab('musician')}
                className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 ${
                  tab === 'musician'
                    ? 'bg-chestnut text-snow shadow-md'
                    : 'text-charcoal hover:text-graphite'
                }`}
              >
                For Musicians
              </button>
            </div>
          </div>

          {/* Tab panels */}
          <div className="relative min-h-[380px] md:min-h-[300px]">

            {/* Restaurant steps — in normal flow, sets height */}
            <div className={`transition-opacity duration-300 ${tab === 'restaurant' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="grid md:grid-cols-3 gap-10 md:gap-14">
                {RESTAURANT_STEPS.map((step) => (
                  <div key={step.num} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 mb-1">
                      <span className="text-graphite/15 font-black text-6xl leading-none tabular-nums">{step.num}</span>
                      <div className="text-chestnut">{step.icon}</div>
                    </div>
                    <h3 className="text-graphite text-xl font-black">{step.title}</h3>
                    <p className="text-charcoal text-[15px] leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12 flex justify-center">
                <Link href="/auth/signup" className="bg-graphite text-snow px-8 py-3.5 rounded-xl font-bold hover:opacity-80 transition-opacity inline-flex items-center gap-2 group">
                  Post your first slot
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>
            </div>

            {/* Musician steps — absolute overlay */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${tab === 'musician' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <div className="grid md:grid-cols-3 gap-10 md:gap-14">
                {MUSICIAN_STEPS.map((step) => (
                  <div key={step.num} className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 mb-1">
                      <span className="text-graphite/15 font-black text-6xl leading-none tabular-nums">{step.num}</span>
                      <div className="text-chestnut">{step.icon}</div>
                    </div>
                    <h3 className="text-graphite text-xl font-black">{step.title}</h3>
                    <p className="text-charcoal text-[15px] leading-relaxed">{step.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-12 flex justify-center">
                <Link href="/auth/signup" className="bg-chestnut text-snow px-8 py-3.5 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2 group">
                  Find gigs near you
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY DRUM UP ── */}
      <section id="why" className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">

        <div className="absolute -right-48 top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-chestnut/10 spin-slow pointer-events-none" />
        <div className="absolute -right-48 top-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-chestnut/[0.05] spin-slow pointer-events-none" style={{ animationDirection: 'reverse' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="mb-14">
            <p className="text-chestnut text-xs font-bold uppercase tracking-[0.35em] mb-4">What makes us different</p>
            <h2 className="text-snow text-4xl md:text-5xl font-black leading-tight">
              Why Drum Up.
            </h2>
          </div>

          {/* Varied feature grid — no identical cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Automatic payouts — large, 2 cols */}
            <div className="md:col-span-2 bg-chestnut rounded-2xl p-8 md:p-10 flex flex-col justify-between min-h-[220px]">
              <div className="text-snow/70 mb-6">
                <IconZap />
              </div>
              <div>
                <h3 className="text-snow text-2xl md:text-3xl font-black mb-3">Automatic payouts after the gig.</h3>
                <p className="text-snow/85 text-[15px] leading-relaxed max-w-md">
                  After the gig ends, the money moves. Stripe sends funds directly to the musician. No chasing, no invoicing, no awkward cash.
                </p>
              </div>
            </div>

            {/* 8% fee — 1 col, number-led */}
            <div className="bg-snow rounded-2xl p-8 flex flex-col justify-between min-h-[220px]">
              <p className="text-chestnut text-xs font-bold uppercase tracking-[0.25em]">Platform fee</p>
              <div>
                <div className="text-graphite font-black leading-none mb-2" style={{ fontSize: 'clamp(3.5rem, 8vw, 5rem)' }}>
                  8<span className="text-4xl">%</span>
                </div>
                <p className="text-charcoal text-sm leading-relaxed">
                  Charged to the venue at confirmation. Nothing hidden, nothing extra.
                </p>
              </div>
            </div>

            {/* Direct messaging — 1 col, visual */}
            <div className="bg-snow/10 rounded-2xl p-8 flex flex-col justify-between min-h-[220px]">
              <div className="flex flex-col gap-2.5">
                <div className="bg-white/20 rounded-xl rounded-bl-sm px-3 py-2.5 self-start max-w-[85%]">
                  <p className="text-snow text-xs leading-snug">Friday 8pm, indoor patio, acoustic preferred. Interested?</p>
                </div>
                <div className="bg-chestnut/80 rounded-xl rounded-br-sm px-3 py-2.5 self-end max-w-[70%]">
                  <p className="text-snow text-xs">In. Sending my setlist tonight.</p>
                </div>
              </div>
              <div>
                <h3 className="text-snow text-lg font-black mb-1">Direct messaging</h3>
                <p className="text-snow/65 text-sm">No email tag. Close the deal in one thread.</p>
              </div>
            </div>

            {/* Built for independents — 2 col */}
            <div className="md:col-span-2 bg-teal rounded-2xl p-8 md:p-10 flex flex-col justify-between min-h-[200px]">
              <p className="text-graphite/60 text-xs font-bold uppercase tracking-[0.25em]">Who this is for</p>
              <div>
                <h3 className="text-snow text-2xl md:text-3xl font-black mb-3">Built for independents.</h3>
                <p className="text-snow/90 text-[15px] leading-relaxed max-w-md">
                  Not agencies. Not booking managers. A solo guitarist in Philly and a neighborhood bistro looking for a Friday night set. Both deserve a real tool.
                </p>
              </div>
            </div>

            {/* No subscriptions — 1 col */}
            <div className="bg-snow rounded-2xl p-8 flex flex-col justify-between min-h-[200px]">
              <p className="text-charcoal text-xs font-bold uppercase tracking-[0.25em]">Cost to join</p>
              <div>
                <div className="text-graphite font-black leading-none mb-2" style={{ fontSize: 'clamp(3rem, 7vw, 4.5rem)' }}>$0</div>
                <h3 className="text-graphite text-base font-black mb-1">No subscriptions</h3>
                <p className="text-charcoal text-sm">Free to join, free to browse. Pay only when a gig is confirmed.</p>
              </div>
            </div>

            {/* Your profile — 2 col */}
            <div className="md:col-span-2 bg-snow/[0.06] border border-snow/10 rounded-2xl p-8 md:p-10 min-h-[200px]">
              <p className="text-chestnut text-xs font-bold uppercase tracking-[0.25em] mb-5">Musician profiles</p>
              <h3 className="text-snow text-2xl font-black mb-3">Your profile is your portfolio.</h3>
              <p className="text-snow/65 text-[15px] leading-relaxed max-w-lg">
                Bio, videos, social links, past venues, genre tags. Everything a booker needs to say yes in 60 seconds, without you sending a single email attachment.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── GIG FEED PREVIEW ── */}
      <section className="py-28 md:py-36 px-6 md:px-8" style={{ background: '#E8E4E0' }}>
        <div className="max-w-6xl mx-auto">

          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <p className="text-chestnut text-xs font-bold uppercase tracking-[0.35em] mb-3">App preview</p>
              <h2 className="text-graphite text-4xl md:text-5xl font-black leading-tight">
                Your next gig is<br className="hidden md:block" /> already up.
              </h2>
            </div>
            <p className="text-charcoal text-[15px] max-w-xs leading-relaxed md:text-right">
              This is what musicians see when they open the feed. Real slots, real venues, real pay.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {GIG_CARDS.map((card, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center flex-wrap gap-1.5 mb-2">
                      <span className="bg-teal/15 text-teal text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Open</span>
                      {card.genres.map(g => (
                        <span key={g} className="bg-graphite/[0.07] text-charcoal text-[10px] font-semibold px-2.5 py-1 rounded-full">{g}</span>
                      ))}
                    </div>
                    <h3 className="text-graphite text-lg font-black">{card.venue}</h3>
                  </div>
                  <div className="text-right shrink-0 pl-4">
                    <div className="text-chestnut text-2xl font-black">${card.pay}</div>
                    <div className="text-charcoal/60 text-[11px]">guaranteed</div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-charcoal text-sm">
                    <span className="shrink-0 text-charcoal/50"><IconCalSmall /></span>
                    {card.day} · {card.time}
                  </div>
                  <div className="flex items-center gap-2 text-charcoal text-sm">
                    <span className="shrink-0 text-charcoal/50"><IconPin /></span>
                    {card.location} · {card.distance}
                  </div>
                </div>

                <p className="text-charcoal/55 text-xs italic mb-5 leading-snug">{card.note}</p>

                <button className="w-full bg-graphite text-snow py-2.5 rounded-xl font-bold text-sm hover:opacity-80 transition-opacity">
                  Apply Now →
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-charcoal/50 text-[11px] mt-8 uppercase tracking-widest font-semibold">
            Preview only. Sign up to see live gigs in your city.
          </p>
        </div>
      </section>

      {/* ── FOR MUSICIANS ── */}
      <section className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">
        <div className="absolute -left-32 top-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-teal opacity-[0.07] blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-20 items-center">

          {/* Copy */}
          <div>
            <p className="text-teal text-xs font-bold uppercase tracking-[0.35em] mb-5">For musicians</p>
            <h2 className="text-snow text-4xl md:text-5xl font-black leading-[1.05] mb-6">
              Discover venues.<br />
              Build a <span className="text-chestnut italic">recurring income.</span>
            </h2>
            <p className="text-snow/65 text-[16px] leading-relaxed mb-8">
              Stop chasing bookings through DMs and cold emails. Drum Up shows you every open slot near you, lets you apply in seconds, and pays you automatically after you perform.
            </p>
            <ul className="space-y-3.5 mb-10">
              {[
                'Keep 92% of every confirmed gig',
                'Your videos and social links front and center',
                'Message venues directly, no gatekeeping',
                'Build a recurring roster of venues that know your sound',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-snow/80 text-[15px]">
                  <span className="text-teal mt-0.5 shrink-0"><IconTick /></span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup" className="bg-chestnut text-snow px-8 py-4 rounded-xl font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-2 group">
              Build your profile
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Musician profile card mockup */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-auto md:ml-auto">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-chestnut flex items-center justify-center text-snow font-black text-xl shrink-0">
                MW
              </div>
              <div>
                <h3 className="text-graphite font-black text-lg leading-tight">Marcus Webb</h3>
                <p className="text-charcoal text-sm">Solo Guitarist</p>
                <p className="text-charcoal/55 text-xs mt-0.5 flex items-center gap-1.5">
                  <IconPin />
                  Philadelphia, PA
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {['Jazz', 'Blues', 'Acoustic', 'Soul'].map(g => (
                <span key={g} className="bg-graphite/[0.07] text-charcoal text-[11px] font-semibold px-3 py-1 rounded-full">{g}</span>
              ))}
            </div>

            <p className="text-charcoal text-[11px] font-bold uppercase tracking-widest mb-3">Recent sets</p>
            <div className="space-y-2 mb-5">
              {[
                { title: 'Sunday Sessions', venue: 'Live at The Blue Room' },
                { title: 'Harbor Lights EP', venue: 'Original Compositions' },
              ].map(v => (
                <div key={v.title} className="flex items-center gap-3 bg-graphite/[0.05] rounded-xl px-3 py-2.5">
                  <div className="w-7 h-7 bg-chestnut/15 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-chestnut"><IconPlay /></span>
                  </div>
                  <div>
                    <p className="text-graphite text-xs font-bold">{v.title}</p>
                    <p className="text-charcoal/55 text-[10px]">{v.venue}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button className="flex-1 bg-graphite text-snow py-2.5 rounded-xl font-bold text-xs">Message</button>
              <button className="flex-1 border border-graphite/20 text-graphite py-2.5 rounded-xl font-bold text-xs">View Profile</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR RESTAURANTS ── */}
      <section className="bg-snow py-28 md:py-36 px-6 md:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-20 items-center">

          {/* Slot posting card mockup */}
          <div className="bg-graphite rounded-3xl p-6 shadow-xl max-w-sm w-full mx-auto order-2 md:order-1">

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-teal text-[10px] font-bold uppercase tracking-widest mb-1">Open Slot</p>
                <h3 className="text-snow font-black text-xl">The Rusty Nail</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-chestnut/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { icon: <IconCalSmall />, text: 'Friday, June 6' },
                { icon: <IconClock />, text: '8:00 PM – 11:00 PM' },
                { icon: <IconPin />, text: 'Indoor patio · 40 seats' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-snow/80 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-snow/10 flex items-center justify-center shrink-0 text-snow/50">
                    {icon}
                  </div>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="bg-snow/10 rounded-xl px-4 py-3 mb-5">
              <p className="text-snow/50 text-[11px] uppercase tracking-widest font-bold mb-1">Looking for</p>
              <p className="text-snow text-sm">Jazz or Acoustic preferred</p>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-snow/45 text-[11px] uppercase tracking-widest font-bold mb-0.5">Pay</p>
                <p className="text-chestnut text-3xl font-black">$150</p>
              </div>
              <div className="text-right">
                <p className="text-snow/45 text-[11px] uppercase tracking-widest font-bold mb-0.5">Applications</p>
                <p className="text-snow text-3xl font-black">7</p>
              </div>
            </div>

            <button className="w-full bg-chestnut text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
              Review Applications →
            </button>
          </div>

          {/* Copy */}
          <div className="order-1 md:order-2">
            <p className="text-chestnut text-xs font-bold uppercase tracking-[0.35em] mb-5">For restaurants</p>
            <h2 className="text-graphite text-4xl md:text-5xl font-black leading-[1.05] mb-6">
              Fill slow nights.<br />
              Find the right <span className="text-chestnut italic">vibe.</span>
            </h2>
            <p className="text-charcoal text-[16px] leading-relaxed mb-8">
              You know which nights need a lift. Post a slot in two minutes and let Drum Up surface musicians who fit your room, not just whoever happens to be available.
            </p>
            <ul className="space-y-3.5 mb-10">
              {[
                'No upfront cost: pay only the 8% booking fee',
                'Browse musician videos before you commit',
                'Message directly and confirm in minutes',
                'Build a shortlist of musicians your regulars love',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-charcoal text-[15px]">
                  <span className="text-teal mt-0.5 shrink-0"><IconTick /></span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup" className="bg-graphite text-snow px-8 py-4 rounded-xl font-bold hover:opacity-80 transition-opacity inline-flex items-center gap-2 group">
              Post your first slot
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 top-1/4 flex items-end justify-around opacity-[0.10] pointer-events-none">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div key={i} className="eq-bar w-2 md:w-3 bg-teal rounded-t" style={eqBarStyle(i, 29)} />
          ))}
        </div>
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-chestnut opacity-10 blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-snow text-4xl md:text-7xl font-black leading-[0.95] mb-6">
            The night is <span className="text-chestnut italic">waiting.</span>
          </h2>
          <p className="text-snow/65 text-lg md:text-xl mb-10">
            Free to join. No card required. Start finding gigs or booking talent today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="bg-chestnut text-snow px-10 py-4 rounded-xl font-black text-base hover:opacity-90 transition-opacity shadow-xl inline-flex items-center justify-center gap-2 group">
              Get on the Bill
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link href="/auth/login" className="border border-snow/20 text-snow px-10 py-4 rounded-xl font-bold text-base hover:border-snow/40 transition-colors text-center">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-graphite border-t border-charcoal/30 py-12 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">

            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="bg-white rounded-lg p-1">
                  <img src="/orange-drum-up.png" alt="Drum Up" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-snow text-lg font-black tracking-tight">Drum Up</span>
              </div>
              <p className="text-charcoal text-sm">Where restaurants meet live music.</p>
            </div>

            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div>
                <p className="text-snow/40 text-[10px] font-bold uppercase tracking-widest mb-3">Navigate</p>
                <ul className="text-charcoal text-sm space-y-2">
                  <li><Link href="#how" className="hover:text-chestnut transition-colors">How It Works</Link></li>
                  <li><Link href="#why" className="hover:text-chestnut transition-colors">Why Drum Up</Link></li>
                  <li><Link href="/auth/signup" className="hover:text-chestnut transition-colors">Sign Up</Link></li>
                  <li><Link href="/auth/login" className="hover:text-chestnut transition-colors">Log In</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-snow/40 text-[10px] font-bold uppercase tracking-widest mb-3">Legal</p>
                <ul className="text-charcoal text-sm space-y-2">
                  <li><Link href="/terms" className="hover:text-chestnut transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-chestnut transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-charcoal/30 pt-8">
            <p className="text-charcoal/60 text-sm">© 2026 Drum Up. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
