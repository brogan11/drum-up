import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-snow">

      {/* Navbar */}
      <nav className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-lg p-1">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
          </div>
          <h1 className="text-snow text-xl font-black tracking-tight">Drum Up</h1>
        </div>
        <div className="flex items-center gap-6">
          <Link href="#how-it-works" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">
            How It Works
          </Link>
          <Link href="#features" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">
            Features
          </Link>
          <Link href="#pricing" className="text-snow hover:text-chestnut transition-colors font-medium hidden md:inline">
            Pricing
          </Link>
          <Link href="/auth/login" className="text-snow hover:text-chestnut transition-colors font-medium">
            Log In
          </Link>
          <Link href="/auth/signup" className="bg-chestnut text-snow px-5 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative min-h-screen bg-graphite flex items-center justify-center overflow-hidden">
        
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 25% 50%, #DC7F41 0%, transparent 50%), 
                             radial-gradient(circle at 75% 50%, #6C9A8B 0%, transparent 50%)`,
          }} />
        </div>

        <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-chestnut opacity-5 blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-teal opacity-5 blur-3xl" />

        <div className="relative z-10 text-center px-8 max-w-4xl">
          <p className="text-teal text-sm font-semibold uppercase tracking-widest mb-4">
            The Live Music Booking Platform
          </p>
          <h1 className="text-snow text-6xl md:text-7xl font-bold mb-6 leading-tight">
            Where Restaurants
            <span className="text-chestnut block">Meet Live Music</span>
          </h1>
          <p className="text-snow opacity-70 text-xl mb-10 max-w-2xl mx-auto">
            Drum Up connects restaurants seeking live entertainment with talented musicians and bands — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link href="/auth/signup" className="bg-chestnut text-snow px-8 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg">
              Get Started Free
            </Link>
            <Link href="#how-it-works" className="border border-snow border-opacity-30 text-snow px-8 py-4 rounded-xl font-bold text-lg hover:border-chestnut hover:text-chestnut transition-colors">
              Learn More
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8 border-t border-charcoal border-opacity-30">
            <div>
              <p className="text-chestnut text-3xl font-bold">500+</p>
              <p className="text-snow opacity-60 text-sm">Active Musicians</p>
            </div>
            <div>
              <p className="text-chestnut text-3xl font-bold">200+</p>
              <p className="text-snow opacity-60 text-sm">Partner Venues</p>
            </div>
            <div>
              <p className="text-chestnut text-3xl font-bold">1,000+</p>
              <p className="text-snow opacity-60 text-sm">Bookings Made</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0 80 C 360 0, 1080 0, 1440 80 L1440 80 L0 80 Z" fill="#FCFAF9" />
          </svg>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="bg-snow py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-chestnut text-sm font-semibold uppercase tracking-widest text-center mb-3">
            How It Works
          </p>
          <h2 className="text-graphite text-4xl font-bold text-center mb-4">
            Something for everyone
          </h2>
          <p className="text-charcoal text-lg text-center mb-16 max-w-2xl mx-auto">
            Whether you're a venue, a performer, or a music lover, Drum Up brings live music to life.
          </p>

          <div className="grid md:grid-cols-3 gap-8">

            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-graphite rounded-2xl flex items-center justify-center mb-6 shadow-md">
                <span className="text-2xl">🍽</span>
              </div>
              <h3 className="text-graphite text-2xl font-bold mb-3">Restaurants</h3>
              <p className="text-charcoal mb-6">Post your open dates and times when you want live music. Browse musician profiles and book the perfect talent for your venue.</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Post availability in minutes</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Browse verified musician profiles</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Book and pay securely in-app</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Build a roster of trusted performers</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-chestnut rounded-2xl flex items-center justify-center mb-6 shadow-md">
                <span className="text-2xl">♪</span>
              </div>
              <h3 className="text-graphite text-2xl font-bold mb-3">Musicians & Bands</h3>
              <p className="text-charcoal mb-6">Build your profile, showcase your work, and find restaurants actively looking for live music near you.</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Create a professional profile</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Share videos and social links</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Get paid securely through the app</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Grow your gigging schedule</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-16 h-16 bg-teal rounded-2xl flex items-center justify-center mb-6 shadow-md">
                <span className="text-2xl">★</span>
              </div>
              <h3 className="text-graphite text-2xl font-bold mb-3">Fans</h3>
              <p className="text-charcoal mb-6">Follow your favorite restaurants and musicians. Always know who is playing where tonight in your city.</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Follow restaurants and artists</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> See live music near you</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Discover new local talent</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Get notified of upcoming gigs</li>
              </ul>
            </div>

          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="bg-[#E8E4E0] py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-chestnut text-sm font-semibold uppercase tracking-widest text-center mb-3">
            Why Drum Up
          </p>
          <h2 className="text-graphite text-4xl font-bold text-center mb-16">
            Built for the live music community
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-graphite font-bold mb-2">Fast Booking</h3>
              <p className="text-charcoal text-sm">Confirm gigs in minutes, not days. Skip the back-and-forth emails.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">💬</div>
              <h3 className="text-graphite font-bold mb-2">Direct Messaging</h3>
              <p className="text-charcoal text-sm">Chat directly with venues or musicians right in the app.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-graphite font-bold mb-2">Secure Payments</h3>
              <p className="text-charcoal text-sm">All transactions are protected through Stripe.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">📍</div>
              <h3 className="text-graphite font-bold mb-2">Local Discovery</h3>
              <p className="text-charcoal text-sm">Find venues and talent right in your neighborhood.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">⭐</div>
              <h3 className="text-graphite font-bold mb-2">Reviews & Ratings</h3>
              <p className="text-charcoal text-sm">Build trust with reviews from past gigs and venues.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">🎬</div>
              <h3 className="text-graphite font-bold mb-2">Video Portfolios</h3>
              <p className="text-charcoal text-sm">Musicians showcase their sound with embedded videos.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="text-graphite font-bold mb-2">Smart Calendar</h3>
              <p className="text-charcoal text-sm">Manage availability and bookings all in one place.</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-3xl mb-3">📱</div>
              <h3 className="text-graphite font-bold mb-2">Mobile Friendly</h3>
              <p className="text-charcoal text-sm">Manage your gigs on the go from any device.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="pricing" className="bg-snow py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-chestnut text-sm font-semibold uppercase tracking-widest text-center mb-3">
            Pricing
          </p>
          <h2 className="text-graphite text-4xl font-bold text-center mb-4">
            Simple, fair pricing
          </h2>
          <p className="text-charcoal text-lg text-center mb-16 max-w-2xl mx-auto">
            Free to join, free to use. We only make money when you do.
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h3 className="text-graphite text-2xl font-bold mb-2">Free</h3>
              <p className="text-chestnut text-4xl font-bold mb-1">$0</p>
              <p className="text-charcoal text-sm mb-6">Forever</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Full profile creation</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Browse and message</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Book through the app</li>
                <li className="flex items-start gap-2"><span className="text-charcoal opacity-50">×</span> Featured placement</li>
              </ul>
            </div>

            <div className="bg-graphite rounded-2xl p-8 shadow-lg relative">
              <span className="absolute top-4 right-4 bg-chestnut text-snow text-xs font-bold px-3 py-1 rounded-full">POPULAR</span>
              <h3 className="text-snow text-2xl font-bold mb-2">Pro Musician</h3>
              <p className="text-chestnut text-4xl font-bold mb-1">$12<span className="text-lg">/mo</span></p>
              <p className="text-snow opacity-60 text-sm mb-6">Cancel anytime</p>
              <ul className="text-snow opacity-90 text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Everything in Free</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Unlimited video uploads</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Featured in search</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Profile analytics</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <h3 className="text-graphite text-2xl font-bold mb-2">Pro Venue</h3>
              <p className="text-chestnut text-4xl font-bold mb-1">$25<span className="text-lg">/mo</span></p>
              <p className="text-charcoal text-sm mb-6">Cancel anytime</p>
              <ul className="text-charcoal text-sm space-y-3">
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Everything in Free</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Unlimited postings</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Promoted listings</li>
                <li className="flex items-start gap-2"><span className="text-teal">✓</span> Verified musician pool</li>
              </ul>
            </div>
          </div>

          <p className="text-center text-charcoal text-sm mt-8">
            We also take a small 8% fee on bookings made through the platform.
          </p>
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-[#E8E4E0] py-24 px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-chestnut text-sm font-semibold uppercase tracking-widest text-center mb-3">
            Testimonials
          </p>
          <h2 className="text-graphite text-4xl font-bold text-center mb-16">
            Loved by the music community
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <p className="text-chestnut text-2xl mb-3">"</p>
              <p className="text-charcoal mb-6 italic">Drum Up has completely changed how we book live music. We've found incredible musicians we never would have discovered otherwise.</p>
              <p className="text-graphite font-bold">Sarah M.</p>
              <p className="text-charcoal text-sm">Restaurant Owner</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <p className="text-chestnut text-2xl mb-3">"</p>
              <p className="text-charcoal mb-6 italic">As a working musician, this app has been a game changer. I've doubled my gigs since signing up.</p>
              <p className="text-graphite font-bold">James K.</p>
              <p className="text-charcoal text-sm">Jazz Pianist</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <p className="text-chestnut text-2xl mb-3">"</p>
              <p className="text-charcoal mb-6 italic">Love being able to see who is playing where tonight. It's how I discover all my new favorite local artists.</p>
              <p className="text-graphite font-bold">Mike R.</p>
              <p className="text-charcoal text-sm">Live Music Fan</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-graphite py-24 px-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full bg-chestnut opacity-5 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-teal opacity-5 blur-3xl" />
        <div className="relative z-10">
          <h2 className="text-snow text-4xl md:text-5xl font-bold mb-4">
            Ready to <span className="text-chestnut">Drum Up</span> some business?
          </h2>
          <p className="text-snow opacity-70 text-lg mb-10 max-w-xl mx-auto">
            Join hundreds of restaurants and musicians already connecting on Drum Up. Free to start, no credit card required.
          </p>
          <Link href="/auth/signup" className="bg-chestnut text-snow px-10 py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity shadow-lg inline-block">
            Create Your Free Account
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-graphite border-t border-charcoal border-opacity-30 py-12 px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-white rounded-lg p-1">
                <img src="/orange-drum-up.png" alt="Drum Up" className="w-6 h-6 object-contain" />
              </div>
              <h3 className="text-snow text-lg font-black tracking-tight">Drum Up</h3>
            </div>
            <p className="text-charcoal text-sm">Connecting restaurants and live music, one gig at a time.</p>
          </div>
          <div>
            <h4 className="text-snow font-bold mb-3">Product</h4>
            <ul className="text-charcoal text-sm space-y-2">
              <li><Link href="#how-it-works" className="hover:text-chestnut transition-colors">How It Works</Link></li>
              <li><Link href="#features" className="hover:text-chestnut transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="hover:text-chestnut transition-colors">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-snow font-bold mb-3">Company</h4>
            <ul className="text-charcoal text-sm space-y-2">
              <li><Link href="#" className="hover:text-chestnut transition-colors">About Us</Link></li>
              <li><Link href="#" className="hover:text-chestnut transition-colors">Contact</Link></li>
              <li><Link href="#" className="hover:text-chestnut transition-colors">Blog</Link></li>
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
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-charcoal border-opacity-30 text-center">
          <p className="text-charcoal text-sm">© 2025 Drum Up. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}