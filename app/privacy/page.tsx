import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { PrivacyContent, LEGAL_EFFECTIVE_DATE } from '@/components/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy — Drum Up',
  description: 'Read the Drum Up Privacy Policy.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-snow flex flex-col">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-graphite/85 border-b border-charcoal/20">
        <div className="flex items-center justify-between px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg p-1">
              <Image src="/orange-drum-up.png" alt="" width={28} height={28} className="w-7 h-7 object-contain" />
            </div>
            <span className="text-snow text-xl font-black tracking-tight">Drum Up</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-snow hover:text-chestnut transition-colors font-medium">Log In</Link>
            <Link href="/auth/signup" className="bg-chestnut text-snow px-5 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* HEADER */}
      <div className="bg-graphite pt-32 pb-12 px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.25em] mb-3">Legal</p>
          <h1 className="text-snow text-4xl md:text-5xl font-black tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-snow/70 text-sm">Effective: {LEGAL_EFFECTIVE_DATE}</p>
        </div>
      </div>

      {/* CONTENT */}
      <main className="flex-1 px-6 md:px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="prose-legal">
            <PrivacyContent />
          </div>
        </div>
      </main>

      {/* FOOTER */}
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
              <p className="text-snow/60 text-sm">Where restaurants meet live music.</p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div>
                <p className="text-snow/50 text-[10px] font-bold uppercase tracking-widest mb-3">Navigate</p>
                <ul className="text-snow/70 text-sm space-y-2">
                  <li><Link href="/" className="hover:text-chestnut transition-colors">Home</Link></li>
                  <li><Link href="/auth/signup" className="hover:text-chestnut transition-colors">Sign Up</Link></li>
                  <li><Link href="/auth/login" className="hover:text-chestnut transition-colors">Log In</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-snow/50 text-[10px] font-bold uppercase tracking-widest mb-3">Legal</p>
                <ul className="text-snow/70 text-sm space-y-2">
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
