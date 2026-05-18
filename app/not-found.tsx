import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-graphite flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-white/10 rounded-xl p-2">
          <Image src="/logo.png" alt="Drum Up" width={32} height={32} className="object-contain" />
        </div>
        <span className="text-snow text-xl font-black tracking-tight">Drum Up</span>
      </div>

      <div className="w-16 h-16 bg-chestnut/20 border border-chestnut/30 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-inner">
        🎶
      </div>

      <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-2">404</p>
      <h1 className="text-snow text-2xl font-black tracking-tight mb-2">
        Page not found.
      </h1>
      <p className="text-snow/60 text-sm leading-relaxed mb-8 max-w-xs">
        This page doesn&apos;t exist — but the music plays on.
      </p>

      <Link
        href="/"
        className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-lg"
      >
        Go Home
      </Link>
    </div>
  )
}
