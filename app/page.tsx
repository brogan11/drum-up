import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { eqBarStyle } from '@/lib/eq'
import { HowItWorksTabs } from '@/components/HowItWorksTabs'
import { ScrollLink } from '@/components/ScrollLink'
import {
  IconZap, IconPin, IconClock, IconCalSmall, IconHouse, IconMusic, IconTick, IconPlay,
  IconShield, IconGift, IconTag,
} from '@/components/HomeIcons'

const EQ_BARS = 36

export const metadata: Metadata = {
  title: 'Drum Up — Book live music for your restaurant, or fill your gig calendar',
  description:
    'Drum Up connects restaurants with local musicians. Post a slot or find a gig in minutes, message directly, and get paid automatically through Stripe. Free to join, 8% flat fee, no subscriptions.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Drum Up — Live music booking for restaurants & musicians',
    description:
      'Post a slot or find a gig in minutes, message directly, and get paid automatically through Stripe. Free to join, 8% flat fee, no subscriptions.',
    url: '/',
    siteName: 'Drum Up',
    type: 'website',
    images: [{ url: '/orange-drum-up.png', width: 512, height: 512, alt: 'Drum Up' }],
  },
  twitter: {
    card: 'summary',
    title: 'Drum Up — Live music booking for restaurants & musicians',
    description: 'Post a slot or find a gig in minutes. Free to join, 8% flat fee, paid automatically through Stripe.',
    images: ['/orange-drum-up.png'],
  },
}

const MARQUEE_WORDS = [
  'ACOUSTIC SETS', 'JAZZ NIGHTS', 'BRUNCH SESSIONS', 'OPEN MIC',
  'INDIE BANDS', 'SOLO ARTISTS', 'ROOFTOP SHOWS', 'SUNDAY BLUES',
  'WINE & WAX', 'CAFE TUNES', 'SOUL DUOS', 'LATE-NIGHT KEYS',
]

const GIG_CARDS = [
  { venue: 'The Rusty Nail', day: 'Friday, Jun 6', time: '8:00 – 11:00 PM', pay: 150, genres: ['Jazz', 'Acoustic'], location: 'Old City, Philadelphia', distance: '0.8 mi', note: 'Indoor patio, intimate crowd, 40 seats' },
  { venue: 'Bravo Bistro', day: 'Saturday, Jun 7', time: '7:00 – 10:00 PM', pay: 200, genres: ['Ambient', 'Instrumental'], location: 'Rittenhouse, Philadelphia', distance: '1.4 mi', note: 'Seated dining, background set preferred' },
  { venue: 'Harbor House', day: 'Sunday, Jun 8', time: '11:00 AM – 2:00 PM', pay: 125, genres: ['Folk', 'Singer-Songwriter'], location: 'Fishtown, Philadelphia', distance: '2.1 mi', note: 'Brunch service, 60-seat patio' },
  { venue: "Lola's Kitchen", day: 'Thursday, Jun 12', time: '9:00 PM – 12:00 AM', pay: 175, genres: ['R&B', 'Soul'], location: 'South Philadelphia', distance: '3.2 mi', note: 'Late-night crowd, high energy welcome' },
]

const TRUST_ITEMS = [
  { icon: <IconShield />, title: 'Payments secured by Stripe', desc: 'Every booking runs on Stripe. We never see or store your card details.' },
  { icon: <IconGift />, title: 'Free to join, no card required', desc: 'Browse venues and musicians for free. You only pay when a gig is confirmed.' },
  { icon: <IconTag />, title: '8% flat fee, nothing hidden', desc: 'One transparent booking fee on the venue side. No subscriptions, ever.' },
]

const FAQS = [
  { q: 'How do payments work?', a: 'Everything runs through Stripe. The venue is charged when a booking is confirmed, the funds are held, and the musician is paid automatically after the gig is performed. No invoices, no cash, no chasing.' },
  { q: 'What does it cost?', a: 'Joining and browsing are free. When a booking is confirmed, the venue pays a flat 8% booking fee — that is our only charge. There are no subscriptions or listing fees.' },
  { q: 'What happens if a gig is cancelled?', a: 'Because the payout is only released after the gig is performed, nobody is left out of pocket. Cancelled bookings release the hold, and our team can step in if anything needs sorting.' },
  { q: 'Who is Drum Up for?', a: 'Independent musicians and the restaurants, cafés, and bars that book them — plus fans who want to follow venues and discover live music nearby. No agencies or middlemen required.' },
  { q: 'Do I need to be in a specific city?', a: 'No. Drum Up matches venues and musicians by distance, so it works wherever you are. The more people nearby, the richer your feed of gigs and talent.' },
]

// Shared primary-button styles: brand chestnut fill + visible focus ring.
const primaryBtn =
  'bg-chestnut text-snow hover:opacity-90 transition-opacity shadow-lg inline-flex items-center justify-center gap-2.5 group ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-snow overflow-x-hidden">

      {/* ── NAV ── */}
      <nav aria-label="Primary" className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-graphite/85 border-b border-charcoal/20">
        <div className="flex items-center justify-between px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-chestnut">
            <div className="bg-white rounded-lg p-1">
              <Image src="/orange-drum-up.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            </div>
            <span className="text-snow text-xl font-black tracking-tight">Drum Up</span>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <ScrollLink href="#how" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">How It Works</ScrollLink>
            <ScrollLink href="#why" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">Why Us</ScrollLink>
            <ScrollLink href="#faq" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">FAQ</ScrollLink>

            {/* Social — brand chestnut */}
            <div className="flex items-center gap-2">
              <a
                href="https://www.instagram.com/drumup.app/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Drum Up on Instagram"
                className="text-chestnut hover:opacity-75 transition-opacity rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61590497710592"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Drum Up on Facebook"
                className="text-chestnut hover:opacity-75 transition-opacity rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                  <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
                </svg>
              </a>
            </div>

            <Link href="/auth/login" className="text-snow hover:text-chestnut transition-colors font-medium">Log In</Link>
            <Link href="/auth/signup" className={`${primaryBtn} px-5 py-2 rounded-xl font-bold`}>Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-svh bg-graphite overflow-hidden pt-20 flex flex-col justify-center">

        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.12] pointer-events-none">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div key={i} className="eq-bar w-2 md:w-3 bg-chestnut rounded-t" style={eqBarStyle(i, 11)} />
          ))}
        </div>

        {/* Soft glows as radial gradients (not filter:blur — large blurred layers
            render with hard seam lines and lag during scroll on mobile GPUs) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 520px 520px at 50% 42%, rgba(220,127,65,0.10), transparent 70%), ' +
              'radial-gradient(ellipse 320px 320px at 8% 100%, rgba(108,154,139,0.10), transparent 70%), ' +
              'radial-gradient(ellipse 320px 320px at 96% 0%, rgba(220,127,65,0.08), transparent 70%)',
          }}
        />

        <div className="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full py-20">

          <div className="flex items-center justify-center gap-3 mb-10">
            <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chestnut opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-chestnut" />
            </span>
            <p className="text-teal text-xs md:text-sm font-semibold uppercase tracking-[0.35em]">Live Music Booking, Reimagined</p>
          </div>

          <h1 className="text-center text-snow font-black leading-[0.85] tracking-tight">
            <span className="block text-[16vw] md:text-[11vw]">BOOK THE</span>
            <span className="block text-[16vw] md:text-[11vw] text-chestnut italic">SOUND</span>
            <span className="block text-[16vw] md:text-[11vw]">OF TONIGHT.</span>
          </h1>

          <p className="text-snow/75 text-lg md:text-xl mt-10 max-w-xl mx-auto text-center leading-relaxed">
            Restaurants fill slow nights. Musicians fill their calendars.
            One platform, no middlemen, no mystery fees.
          </p>

          {/* Dual CTAs — role is preserved into signup via ?type= */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
            <Link href="/auth/signup?type=restaurant" className={`${primaryBtn} px-8 py-4 rounded-xl font-bold text-base`}>
              <IconHouse />
              I&apos;m a Restaurant
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link
              href="/auth/signup?type=musician"
              className="border-2 border-snow/40 text-snow px-8 py-4 rounded-xl font-bold text-base hover:border-chestnut hover:text-chestnut transition-colors inline-flex items-center justify-center gap-2.5 group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut"
            >
              <IconMusic />
              I&apos;m a Musician
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Honest trust line + risk reversal right at the decision point */}
          <p className="text-center text-snow/70 text-sm mt-6 font-medium">
            Free to join · No card required · Pay only when a gig is confirmed
          </p>
          <p className="text-center text-snow/45 text-sm mt-3">
            Just here to discover live music?{' '}
            <Link href="/auth/signup?type=fan" className="underline underline-offset-2 text-snow/70 hover:text-snow transition-colors">
              Join as a fan →
            </Link>
          </p>
        </div>

        <div aria-hidden="true" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-snow/45 text-xs uppercase tracking-[0.35em] font-semibold">
          Scroll
        </div>
      </section>

      {/* ── TRUST BAR (honest, pre-launch) ── */}
      <section aria-label="Why you can trust Drum Up" className="bg-snow border-b border-graphite/10">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-14">
          <p className="text-center text-chestnut text-xs font-bold uppercase tracking-[0.3em] mb-2">Newly launched</p>
          <h2 className="text-center text-graphite text-2xl md:text-3xl font-black mb-10">
            Be one of the first venues &amp; musicians on Drum Up.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TRUST_ITEMS.map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-chestnut/10 text-chestnut shrink-0">{icon}</span>
                <div>
                  <h3 className="text-graphite font-black text-base mb-1">{title}</h3>
                  <p className="text-charcoal text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARQUEE BAND ── */}
      <div aria-hidden="true" className="bg-chestnut py-5 overflow-hidden border-y-4 border-graphite">
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
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-graphite text-4xl md:text-5xl font-black mb-8 leading-tight">
            Three steps. <span className="text-chestnut italic">Both sides.</span>
          </h2>
          <HowItWorksTabs />
        </div>
      </section>

      {/* ── WHY DRUM UP ── */}
      <section id="why" className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">

        <div aria-hidden="true" className="absolute -right-48 top-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-chestnut/10 spin-slow pointer-events-none" />
        <div aria-hidden="true" className="absolute -right-48 top-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-chestnut/[0.05] spin-slow pointer-events-none" style={{ animationDirection: 'reverse' }} />

        <div className="relative max-w-6xl mx-auto">
          <div className="mb-14">
            <p className="text-chestnut text-xs font-bold uppercase tracking-[0.35em] mb-4">What makes us different</p>
            <h2 className="text-snow text-4xl md:text-5xl font-black leading-tight">Why Drum Up.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Automatic payouts — large, 2 cols */}
            <div className="md:col-span-2 bg-chestnut rounded-2xl p-8 md:p-10 flex flex-col justify-between min-h-[220px]">
              <div className="text-snow/70 mb-6"><IconZap /></div>
              <div>
                <h3 className="text-snow text-2xl md:text-3xl font-black mb-3">Automatic payouts after the gig.</h3>
                <p className="text-snow text-[15px] leading-relaxed max-w-md">
                  After the gig ends, the money moves. Stripe sends funds directly to the musician. No chasing, no invoicing, no awkward cash.
                </p>
              </div>
            </div>

            <div className="bg-snow rounded-2xl p-8 flex flex-col justify-between min-h-[220px]">
              <p className="text-chestnut text-xs font-bold uppercase tracking-[0.25em]">Platform fee</p>
              <div>
                <div className="text-graphite font-black leading-none mb-2" style={{ fontSize: 'clamp(3.5rem, 8vw, 5rem)' }}>
                  8<span className="text-4xl">%</span>
                </div>
                <p className="text-charcoal text-sm leading-relaxed">Charged to the venue at confirmation. Nothing hidden, nothing extra.</p>
              </div>
            </div>

            <div className="bg-snow/10 rounded-2xl p-8 flex flex-col justify-between min-h-[220px]">
              <div className="flex flex-col gap-2.5" aria-hidden="true">
                <div className="bg-white/20 rounded-xl rounded-bl-sm px-3 py-2.5 self-start max-w-[85%]">
                  <p className="text-snow text-xs leading-snug">Friday 8pm, indoor patio, acoustic preferred. Interested?</p>
                </div>
                <div className="bg-chestnut/80 rounded-xl rounded-br-sm px-3 py-2.5 self-end max-w-[70%]">
                  <p className="text-snow text-xs">In. Sending my setlist tonight.</p>
                </div>
              </div>
              <div>
                <h3 className="text-snow text-lg font-black mb-1">Direct messaging</h3>
                <p className="text-snow/75 text-sm">No email tag. Close the deal in one thread.</p>
              </div>
            </div>

            <div className="md:col-span-2 bg-teal rounded-2xl p-8 md:p-10 flex flex-col justify-between min-h-[200px]">
              <p className="text-graphite/70 text-xs font-bold uppercase tracking-[0.25em]">Who this is for</p>
              <div>
                <h3 className="text-snow text-2xl md:text-3xl font-black mb-3">Built for independents.</h3>
                <p className="text-snow text-[15px] leading-relaxed max-w-md">
                  Not agencies. Not booking managers. A solo guitarist in Philly and a neighborhood bistro looking for a Friday night set. Both deserve a real tool.
                </p>
              </div>
            </div>

            <div className="bg-snow rounded-2xl p-8 flex flex-col justify-between min-h-[200px]">
              <p className="text-charcoal text-xs font-bold uppercase tracking-[0.25em]">Cost to join</p>
              <div>
                <div className="text-graphite font-black leading-none mb-2" style={{ fontSize: 'clamp(3rem, 7vw, 4.5rem)' }}>$0</div>
                <h3 className="text-graphite text-base font-black mb-1">No subscriptions</h3>
                <p className="text-charcoal text-sm">Free to join, free to browse. Pay only when a gig is confirmed.</p>
              </div>
            </div>

            <div className="md:col-span-2 bg-snow/[0.06] border border-snow/10 rounded-2xl p-8 md:p-10 min-h-[200px]">
              <p className="text-chestnut text-xs font-bold uppercase tracking-[0.25em] mb-5">Musician profiles</p>
              <h3 className="text-snow text-2xl font-black mb-3">Your profile is your portfolio.</h3>
              <p className="text-snow/75 text-[15px] leading-relaxed max-w-lg">
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
              This is what musicians see when they open the feed — slots, venues, and pay laid out at a glance.
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
                    <div className="text-charcoal text-[11px]">guaranteed</div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-charcoal text-sm">
                    <span className="shrink-0 text-charcoal/60"><IconCalSmall /></span>
                    {card.day} · {card.time}
                  </div>
                  <div className="flex items-center gap-2 text-charcoal text-sm">
                    <span className="shrink-0 text-charcoal/60"><IconPin /></span>
                    {card.location} · {card.distance}
                  </div>
                </div>

                <p className="text-charcoal text-xs italic mb-5 leading-snug">{card.note}</p>

                <Link
                  href="/auth/signup?type=musician"
                  className="block text-center w-full bg-graphite text-snow py-2.5 rounded-xl font-bold text-sm hover:bg-graphite/80 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut"
                >
                  Apply Now →
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-charcoal text-[11px] mt-8 uppercase tracking-widest font-semibold">
            Sample layout. Sign up to see live gigs in your city.
          </p>
        </div>
      </section>

      {/* ── FOR MUSICIANS ── */}
      <section className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 300px 300px at 0% 50%, rgba(108,154,139,0.07), transparent 70%)' }}
        />

        <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-20 items-center">

          <div>
            <p className="text-teal text-xs font-bold uppercase tracking-[0.35em] mb-5">For musicians</p>
            <h2 className="text-snow text-4xl md:text-5xl font-black leading-[1.05] mb-6">
              Discover venues.<br />
              Build a <span className="text-chestnut italic">recurring income.</span>
            </h2>
            <p className="text-snow/75 text-base leading-relaxed mb-8">
              Stop chasing bookings through DMs and cold emails. Drum Up shows you every open slot near you, lets you apply in seconds, and pays you automatically after you perform.
            </p>
            <ul className="space-y-3.5 mb-10">
              {[
                'Keep 92% of every confirmed gig',
                'Your videos and social links front and center',
                'Message venues directly, no gatekeeping',
                'Build a recurring roster of venues that know your sound',
              ].map(item => (
                <li key={item} className="flex items-start gap-3 text-snow/85 text-[15px]">
                  <span className="text-teal mt-0.5 shrink-0"><IconTick /></span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/auth/signup?type=musician" className={`${primaryBtn} px-8 py-4 rounded-xl font-bold`}>
              Build your profile
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>

          {/* Musician profile card — illustrative; non-interactive */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full mx-auto md:ml-auto" aria-hidden="true">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-chestnut flex items-center justify-center text-snow font-black text-xl shrink-0">MW</div>
              <div>
                <h3 className="text-graphite font-black text-lg leading-tight">Marcus Webb</h3>
                <p className="text-charcoal text-sm">Solo Guitarist</p>
                <p className="text-charcoal text-xs mt-0.5 flex items-center gap-1.5"><IconPin /> Philadelphia, PA</p>
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
                    <p className="text-charcoal text-[10px]">{v.venue}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <span className="flex-1 bg-graphite text-snow py-2.5 rounded-xl font-bold text-xs text-center">Message</span>
              <span className="flex-1 border border-graphite/20 text-graphite py-2.5 rounded-xl font-bold text-xs text-center">View Profile</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOR RESTAURANTS ── */}
      <section className="bg-snow py-28 md:py-36 px-6 md:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 md:gap-20 items-center">

          {/* Slot posting card — illustrative; non-interactive */}
          <div className="bg-graphite rounded-3xl p-6 shadow-xl max-w-sm w-full mx-auto order-2 md:order-1" aria-hidden="true">

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-teal text-[10px] font-bold uppercase tracking-widest mb-1">Open Slot</p>
                <h3 className="text-snow font-black text-xl">The Rusty Nail</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-chestnut/20 flex items-center justify-center text-chestnut"><IconHouse /></div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { icon: <IconCalSmall />, text: 'Friday, June 6' },
                { icon: <IconClock />, text: '8:00 PM – 11:00 PM' },
                { icon: <IconPin />, text: 'Indoor patio · 40 seats' },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-snow/85 text-sm">
                  <div className="w-7 h-7 rounded-lg bg-snow/10 flex items-center justify-center shrink-0 text-snow/60">{icon}</div>
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="bg-snow/10 rounded-xl px-4 py-3 mb-5">
              <p className="text-snow/60 text-[11px] uppercase tracking-widest font-bold mb-1">Looking for</p>
              <p className="text-snow text-sm">Jazz or Acoustic preferred</p>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-snow/55 text-[11px] uppercase tracking-widest font-bold mb-0.5">Pay</p>
                <p className="text-chestnut text-3xl font-black">$150</p>
              </div>
              <div className="text-right">
                <p className="text-snow/55 text-[11px] uppercase tracking-widest font-bold mb-0.5">Applications</p>
                <p className="text-snow text-3xl font-black">7</p>
              </div>
            </div>

            <span className="block text-center w-full bg-chestnut text-snow py-3 rounded-xl font-bold text-sm">Review Applications →</span>
          </div>

          <div className="order-1 md:order-2">
            <p className="text-chestnut text-xs font-bold uppercase tracking-[0.35em] mb-5">For restaurants</p>
            <h2 className="text-graphite text-4xl md:text-5xl font-black leading-[1.05] mb-6">
              Fill slow nights.<br />
              Find the right <span className="text-chestnut italic">vibe.</span>
            </h2>
            <p className="text-charcoal text-base leading-relaxed mb-8">
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
            <Link href="/auth/signup?type=restaurant" className="inline-flex items-center gap-2 bg-graphite text-snow px-8 py-4 rounded-xl font-bold hover:bg-graphite/80 transition-colors group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut">
              Post your first slot
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 md:py-36 px-6 md:px-8" style={{ background: '#E8E4E0' }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-chestnut text-xs font-bold uppercase tracking-[0.35em] mb-3">Questions</p>
            <h2 className="text-graphite text-4xl md:text-5xl font-black leading-tight">Everything you might ask.</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map(({ q, a }) => (
              <details key={q} className="group bg-white rounded-2xl shadow-sm overflow-hidden">
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 py-5 text-graphite font-black text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut">
                  {q}
                  <span aria-hidden="true" className="text-chestnut text-2xl leading-none transition-transform group-open:rotate-45 shrink-0">+</span>
                </summary>
                <p className="px-6 pb-5 -mt-1 text-charcoal text-[15px] leading-relaxed">{a}</p>
              </details>
            ))}
          </div>

          <p className="text-center text-charcoal text-sm mt-10">
            Still have a question?{' '}
            <a href="mailto:support@drum-up.app" className="text-chestnut font-bold hover:underline">Email our team →</a>
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-1/4 flex items-end justify-around opacity-[0.10] pointer-events-none">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div key={i} className="eq-bar w-2 md:w-3 bg-teal rounded-t" style={eqBarStyle(i, 29)} />
          ))}
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 450px 380px at 50% 100%, rgba(220,127,65,0.10), transparent 70%)' }}
        />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-snow text-4xl md:text-7xl font-black leading-[0.95] mb-6">
            The night is <span className="text-chestnut italic">waiting.</span>
          </h2>
          <p className="text-snow/75 text-lg md:text-xl mb-10">
            Free to join. No card required. Start finding gigs or booking talent today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className={`${primaryBtn} px-10 py-4 rounded-xl font-black text-base shadow-xl`}>
              Get on the Bill
              <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
            <Link href="/auth/login" className="border border-snow/30 text-snow px-10 py-4 rounded-xl font-bold text-base hover:border-snow/60 transition-colors text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut">
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-graphite border-t border-charcoal/40 py-12 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">

            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="bg-white rounded-lg p-1">
                  <Image src="/orange-drum-up.png" alt="" width={24} height={24} className="w-6 h-6 object-contain" />
                </div>
                <span className="text-snow text-lg font-black tracking-tight">Drum Up</span>
              </div>
              <p className="text-snow/60 text-sm mb-5">Where restaurants meet live music.</p>

              <p className="text-snow/50 text-[10px] font-bold uppercase tracking-widest mb-3">Follow along</p>
              <div className="flex items-center gap-3">
                <a
                  href="https://www.instagram.com/drumup.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Drum Up on Instagram"
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-chestnut/10 text-chestnut hover:bg-chestnut hover:text-snow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>
                <a
                  href="https://www.facebook.com/profile.php?id=61590497710592"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Drum Up on Facebook"
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-chestnut/10 text-chestnut hover:bg-chestnut hover:text-snow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z" />
                  </svg>
                </a>
              </div>
            </div>

            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div>
                <p className="text-snow/50 text-[10px] font-bold uppercase tracking-widest mb-3">Navigate</p>
                <ul className="text-snow/70 text-sm space-y-2">
                  <li><ScrollLink href="#how" className="hover:text-chestnut transition-colors">How It Works</ScrollLink></li>
                  <li><ScrollLink href="#why" className="hover:text-chestnut transition-colors">Why Drum Up</ScrollLink></li>
                  <li><ScrollLink href="#faq" className="hover:text-chestnut transition-colors">FAQ</ScrollLink></li>
                  <li><Link href="/auth/signup" className="hover:text-chestnut transition-colors">Sign Up</Link></li>
                  <li><Link href="/auth/login" className="hover:text-chestnut transition-colors">Log In</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-snow/50 text-[10px] font-bold uppercase tracking-widest mb-3">Company</p>
                <ul className="text-snow/70 text-sm space-y-2">
                  <li><a href="mailto:support@drum-up.app" className="hover:text-chestnut transition-colors">Contact</a></li>
                  <li><Link href="/terms" className="hover:text-chestnut transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-chestnut transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-charcoal/40 pt-8">
            <p className="text-snow/50 text-sm">© 2026 Drum Up. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}
