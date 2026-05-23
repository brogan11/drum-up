import Link from 'next/link'
import { eqBarStyle } from '@/lib/eq'

const EQ_BARS = 36
const MARQUEE_WORDS = [
  'ACOUSTIC SETS', 'JAZZ NIGHTS', 'BRUNCH SESSIONS', 'OPEN MIC',
  'INDIE BANDS', 'SOLO ARTISTS', 'ROOFTOP SHOWS', 'SUNDAY BLUES',
  'WINE & WAX', 'CAFE TUNES', 'SOUL DUOS', 'LATE-NIGHT KEYS',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-snow overflow-x-hidden">

      {/* NAV — sticky/blurred over hero */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-graphite/85 border-b border-charcoal/20">
        <div className="flex items-center justify-between px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg p-1">
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            </div>
            <h1 className="text-snow text-xl font-black tracking-tight">Drum Up</h1>
          </Link>
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="#how" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">How It Works</Link>
            <Link href="#features" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">Features</Link>
            <Link href="#pricing" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">Pricing</Link>
            <Link href="/auth/login" className="text-snow hover:text-chestnut transition-colors font-medium">Log In</Link>
            <Link href="/auth/signup" className="bg-chestnut text-snow px-5 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen bg-graphite overflow-hidden pt-32 pb-12 flex flex-col justify-center">

            {/* Animated equalizer bars across the floor of the hero */}
            <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.12] pointer-events-none">
              {Array.from({ length: EQ_BARS }).map((_, i) => (
                <div
                  key={i}
                  className="eq-bar w-2 md:w-3 bg-chestnut rounded-t"
                  style={eqBarStyle(i, 11)}
                />
              ))}
            </div>

            {/* Stage glows */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-chestnut opacity-10 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-teal opacity-10 blur-3xl pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-chestnut opacity-10 blur-3xl pointer-events-none" />

            <div className="relative z-10 px-6 md:px-8 max-w-7xl mx-auto w-full">

              {/* Live indicator */}
              <div className="flex items-center justify-center gap-3 mb-8">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chestnut opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-chestnut" />
                </span>
                <p className="text-teal text-xs md:text-sm font-semibold uppercase tracking-[0.35em]">Live Music Booking, Reimagined</p>
              </div>

              {/* Marquee-style headline */}
              <h2 className="text-center text-snow font-black leading-[0.85] tracking-tight">
                <span className="block text-[16vw] md:text-[11vw]">BOOK THE</span>
                <span className="block text-[16vw] md:text-[11vw] text-chestnut italic">SOUND</span>
                <span className="block text-[16vw] md:text-[11vw]">OF TONIGHT.</span>
              </h2>

              <p className="text-snow/70 text-lg md:text-2xl mt-10 max-w-2xl mx-auto text-center">
                Restaurants, musicians, fans — one app, one stage.
                Drum Up is where local live music gets made.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
                <Link href="/auth/signup" className="bg-chestnut text-snow px-10 py-5 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg inline-flex items-center justify-center gap-2 group">
                  Get on the Bill
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
                <Link href="#how" className="border border-snow/30 text-snow px-10 py-5 rounded-xl font-bold text-lg hover:border-chestnut hover:text-chestnut transition-colors text-center">
                  See How It Works
                </Link>
              </div>
            </div>

            {/* Scroll hint */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-snow/40 text-xs uppercase tracking-[0.3em] font-semibold">
              Scroll
            </div>
              </section>

      {/* MARQUEE BAND */}
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

      {/* HOW IT WORKS — tilted poster cards */}
      <section id="how" className="bg-snow py-28 md:py-36 px-6 md:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-20">
            <p className="text-chestnut text-xs md:text-sm font-semibold uppercase tracking-[0.35em] mb-4">Three Sides of the Stage</p>
            <h2 className="text-graphite text-4xl md:text-6xl font-black leading-tight">
              Built for everyone <span className="text-chestnut italic">in the room.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 md:gap-6">

            {/* Restaurant */}
            <div className="bg-graphite text-snow rounded-3xl p-8 md:p-10 shadow-xl md:rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
              <div className="text-chestnut text-6xl md:text-7xl font-black mb-4 leading-none">01</div>
              <p className="text-teal text-[11px] uppercase tracking-[0.25em] font-bold mb-2">For Restaurants</p>
              <h3 className="text-3xl font-black mb-3">Stage your venue.</h3>
              <p className="opacity-75 mb-6">Post your open dates, browse profiles, lock in talent that fits your room.</p>
              <ul className="text-sm space-y-2.5">
                <li className="flex gap-2"><span className="text-chestnut">→</span> Post availability in minutes</li>
                <li className="flex gap-2"><span className="text-chestnut">→</span> Verified musician profiles</li>
                <li className="flex gap-2"><span className="text-chestnut">→</span> Pay securely in-app</li>
                <li className="flex gap-2"><span className="text-chestnut">→</span> Build a trusted roster</li>
              </ul>
            </div>

            {/* Musician — popped */}
            <div className="bg-chestnut text-snow rounded-3xl p-8 md:p-10 shadow-2xl md:-translate-y-6 hover:-translate-y-10 transition-transform duration-500 relative">
              <div className="absolute -top-3 -right-3 bg-graphite text-snow text-[10px] font-bold tracking-widest px-4 py-2 rounded-full shadow-md flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>HEADLINER</div>
              <div className="text-snow text-6xl md:text-7xl font-black mb-4 leading-none">02</div>
              <p className="text-graphite text-[11px] uppercase tracking-[0.25em] font-bold mb-2">For Musicians & Bands</p>
              <h3 className="text-3xl font-black mb-3">Get more gigs.</h3>
              <p className="opacity-95 mb-6">Build your profile, share your sound, find rooms hungry for live music.</p>
              <ul className="text-sm space-y-2.5">
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Showcase videos & social links</li>
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Match with local venues</li>
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Get paid directly</li>
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Fill your calendar</li>
              </ul>
            </div>

            {/* Fan */}
            <div className="bg-teal text-snow rounded-3xl p-8 md:p-10 shadow-xl md:rotate-[2deg] hover:rotate-0 transition-transform duration-500">
              <div className="text-graphite text-6xl md:text-7xl font-black mb-4 leading-none">03</div>
              <p className="text-graphite text-[11px] uppercase tracking-[0.25em] font-bold mb-2">For Fans</p>
              <h3 className="text-3xl font-black mb-3">Find your sound.</h3>
              <p className="opacity-95 mb-6">Follow the spots and artists you love. Always know who's playing tonight.</p>
              <ul className="text-sm space-y-2.5">
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Follow venues & artists</li>
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Live music near you, tonight</li>
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Discover local talent</li>
                <li className="flex gap-2"><span className="text-graphite font-bold">→</span> Alerts before doors open</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* FEATURES — bento grid */}
      <section id="features" className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">

        {/* Subtle rotating vinyl-ish decoration */}
        <div className="absolute -right-40 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border-2 border-chestnut/10 spin-slow pointer-events-none" />
        <div className="absolute -right-40 top-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full border border-chestnut/5 spin-slow pointer-events-none" style={{ animationDirection: 'reverse' }} />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16 md:mb-20">
            <p className="text-chestnut text-xs md:text-sm font-semibold uppercase tracking-[0.35em] mb-4">What's Inside</p>
            <h2 className="text-snow text-4xl md:text-6xl font-black leading-tight">
              Everything the night <span className="text-chestnut italic">needs.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-5 auto-rows-[190px]">

            {/* Big chat mockup feature */}
            <div className="md:col-span-4 md:row-span-2 bg-chestnut rounded-3xl p-8 md:p-10 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <p className="text-graphite text-[11px] uppercase tracking-[0.25em] font-bold mb-3">Direct Messaging</p>
                <h3 className="text-snow text-3xl md:text-5xl font-black mb-3 leading-[0.95]">No more email tag.</h3>
                <p className="text-snow/90 text-base md:text-lg max-w-md">Chat directly in-app. Lock in the gig in minutes — not days of back-and-forth.</p>
              </div>
              <div className="flex flex-col gap-3 mt-8 max-w-sm">
                <div className="bg-snow text-graphite rounded-2xl rounded-bl-sm px-4 py-3 self-start shadow-md">
                  <p className="text-[10px] uppercase tracking-widest text-charcoal mb-0.5">Venue</p>
                  <p className="text-sm">Friday 8pm — acoustic set, indoor patio. Interested?</p>
                </div>
                <div className="bg-graphite text-snow rounded-2xl rounded-br-sm px-4 py-3 self-end shadow-md">
                  <p className="text-sm">In. Sending my setlist tonight.</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-snow text-graphite rounded-3xl p-7 shadow-md flex flex-col justify-between">
              <p className="text-chestnut text-[11px] uppercase tracking-[0.25em] font-bold">Smart Calendar</p>
              <div>
                <h3 className="text-2xl font-black mb-1">One view.</h3>
                <p className="text-charcoal text-sm">Availability, requests, confirmed gigs — all together.</p>
              </div>
            </div>

            <div className="md:col-span-2 bg-teal text-snow rounded-3xl p-7 shadow-md flex flex-col justify-between">
              <p className="text-graphite text-[11px] uppercase tracking-[0.25em] font-bold">Secure Pay</p>
              <div>
                <h3 className="text-2xl font-black mb-1">Stripe, sorted.</h3>
                <p className="opacity-95 text-sm">No cash apps, no chasing checks. Just paid.</p>
              </div>
            </div>

            <div className="md:col-span-3 bg-snow text-graphite rounded-3xl p-7 shadow-md flex flex-col justify-between">
              <p className="text-chestnut text-[11px] uppercase tracking-[0.25em] font-bold">Video Portfolios</p>
              <div>
                <h3 className="text-2xl font-black mb-1">Show, don't tell.</h3>
                <p className="text-charcoal text-sm">Embed clips from YouTube & Instagram. Let your sound speak first.</p>
              </div>
            </div>

            <div className="md:col-span-3 bg-graphite border border-chestnut/30 rounded-3xl p-7 flex flex-col justify-between">
              <p className="text-chestnut text-[11px] uppercase tracking-[0.25em] font-bold">Local Discovery</p>
              <div>
                <h3 className="text-snow text-2xl font-black mb-1">Your zip, your stage.</h3>
                <p className="text-snow/70 text-sm">Find rooms and artists right in your neighborhood.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-snow py-28 md:py-36 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-chestnut text-xs md:text-sm font-semibold uppercase tracking-[0.35em] mb-4">Pricing</p>
            <h2 className="text-graphite text-4xl md:text-6xl font-black mb-4 leading-tight">
              Free to <span className="text-chestnut italic">play.</span>
            </h2>
            <p className="text-charcoal text-lg max-w-xl mx-auto">We only make money when you do. Upgrade only if you want the spotlight.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-white rounded-3xl p-10 shadow-sm hover:shadow-md transition-shadow border-t-4 border-charcoal">
              <p className="text-charcoal text-[11px] uppercase tracking-[0.25em] font-bold mb-2">Free</p>
              <h3 className="text-graphite text-5xl font-black mb-1">$0</h3>
              <p className="text-charcoal text-sm mb-8">Forever. No card.</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Full profile creation</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Browse and message</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Book through the app</li>
                <li className="flex items-start gap-2 opacity-40"><span>×</span> Featured placement</li>
              </ul>
            </div>

            <div className="bg-graphite text-snow rounded-3xl p-10 shadow-2xl relative md:-translate-y-4 border-t-4 border-chestnut">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-chestnut text-snow text-[10px] font-bold tracking-widest px-4 py-1.5 rounded-full">MOST POPULAR</span>
              <p className="text-chestnut text-[11px] uppercase tracking-[0.25em] font-bold mb-2">Pro Musician</p>
              <h3 className="text-5xl font-black mb-1">$12<span className="text-xl opacity-60">/mo</span></h3>
              <p className="opacity-60 text-sm mb-8">Cancel anytime.</p>
              <ul className="text-sm space-y-3 opacity-95">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Everything in Free</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Unlimited video uploads</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Featured in search</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Profile analytics</li>
              </ul>
            </div>

            <div className="bg-white rounded-3xl p-10 shadow-sm hover:shadow-md transition-shadow border-t-4 border-teal">
              <p className="text-teal text-[11px] uppercase tracking-[0.25em] font-bold mb-2">Pro Venue</p>
              <h3 className="text-graphite text-5xl font-black mb-1">$25<span className="text-xl opacity-60">/mo</span></h3>
              <p className="text-charcoal text-sm mb-8">Cancel anytime.</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Everything in Free</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Unlimited postings</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Promoted listings</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Verified musician pool</li>
              </ul>
            </div>
          </div>

          <p className="text-center text-charcoal text-sm mt-10">+ 8% platform fee on bookings, paid by the venue at confirmation.</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="bg-graphite py-28 md:py-36 px-6 md:px-8 relative overflow-hidden">
        <div className="absolute inset-x-0 bottom-0 top-1/4 flex items-end justify-around opacity-[0.10] pointer-events-none">
          {Array.from({ length: EQ_BARS }).map((_, i) => (
            <div
              key={i}
              className="eq-bar w-2 md:w-3 bg-teal rounded-t"
              style={eqBarStyle(i, 29)}
            />
          ))}
        </div>
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-chestnut opacity-10 blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <h2 className="text-snow text-4xl md:text-7xl font-black leading-[0.95] mb-6">
            The night is <span className="text-chestnut italic">waiting.</span>
          </h2>
          <p className="text-snow/70 text-lg md:text-xl mb-10">Sign up free. No card. No catch. Just music.</p>
          <Link href="/auth/signup" className="bg-chestnut text-snow px-12 py-5 rounded-xl font-black text-lg hover:opacity-90 transition-opacity shadow-2xl inline-flex items-center gap-3 group">
            Get on the Bill
            <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-graphite border-t border-charcoal/30 py-12 px-6 md:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white rounded-lg p-1">
                <img src="/orange-drum-up.png" alt="Drum Up" className="w-6 h-6 object-contain" />
              </div>
              <h3 className="text-snow text-lg font-black tracking-tight">Drum Up</h3>
            </div>
            <p className="text-charcoal text-sm">Where Restaurants meet Live Music.</p>
          </div>
          <div>
            <h4 className="text-snow font-bold mb-3">Product</h4>
            <ul className="text-charcoal text-sm space-y-2">
              <li><Link href="#how" className="hover:text-chestnut transition-colors">How It Works</Link></li>
              <li><Link href="#features" className="hover:text-chestnut transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-chestnut transition-colors">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-snow font-bold mb-3">Company</h4>
            <ul className="text-charcoal text-sm space-y-2">
              <li><Link href="#" className="hover:text-chestnut transition-colors">About</Link></li>
              <li><Link href="#" className="hover:text-chestnut transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-snow font-bold mb-3">Get Started</h4>
            <ul className="text-charcoal text-sm space-y-2">
              <li><Link href="/auth/signup" className="hover:text-chestnut transition-colors">Sign Up</Link></li>
              <li><Link href="/auth/login" className="hover:text-chestnut transition-colors">Log In</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-charcoal/30 text-center">
          <p className="text-charcoal text-sm">© 2026 Drum Up. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
