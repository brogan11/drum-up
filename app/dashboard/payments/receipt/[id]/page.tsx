'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const FEE_RATE = 0.08
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface Receipt {
  id: string
  date: Date | null
  description: string
  gross: number
  fee: number
  net: number
  venue: string
  musician: string
  status: string
  paymentStatus: string | null
  payoutReleased: boolean | null
  payoutReleasedAt: Date | null
  viewerRole: 'musician' | 'restaurant'
}

export default function ReceiptPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [r, setR] = useState<Receipt | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { router.push('/auth/login'); return }

        const { data: b } = await supabase
          .from('bookings')
          .select('id, availability_id, restaurant_id, musician_id, status, pay_amount, payment_status, payout_released, payout_released_at, created_at')
          .eq('id', id)
          .maybeSingle()

        if (!b) { setError('Receipt not found.'); setLoading(false); return }
        if (b.musician_id !== user.id && b.restaurant_id !== user.id) { setError('You do not have access to this receipt.'); setLoading(false); return }

        const [{ data: av }, { data: people }] = await Promise.all([
          b.availability_id ? supabase.from('availability').select('date, description').eq('id', b.availability_id).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from('profiles').select('id, full_name, role_metadata').in('id', [b.restaurant_id, b.musician_id].filter(Boolean) as string[]),
        ])
        const nameOf = (pid: string | null, key: 'venue_name' | 'stage_name', fallback: string) => {
          const p = (people ?? []).find(x => x.id === pid)
          if (!p) return fallback
          const mt = (p.role_metadata ?? {}) as Record<string, unknown>
          return (mt[key] as string) || p.full_name || fallback
        }
        const gross = Number(b.pay_amount) || 0
        const fee = gross * FEE_RATE
        setR({
          id: b.id,
          date: av?.date ? new Date(av.date + 'T00:00:00') : (b.created_at ? new Date(b.created_at) : null),
          description: av?.description || 'Live music gig',
          gross, fee, net: gross - fee,
          venue: nameOf(b.restaurant_id, 'venue_name', 'Venue'),
          musician: nameOf(b.musician_id, 'stage_name', 'Musician'),
          status: b.status,
          paymentStatus: b.payment_status,
          payoutReleased: b.payout_released,
          payoutReleasedAt: b.payout_released_at ? new Date(b.payout_released_at as string) : null,
          viewerRole: b.musician_id === user.id ? 'musician' : 'restaurant',
        })
      } catch (err) {
        console.error('Receipt load failed:', err)
        setError('Could not load this receipt.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (error || !r) {
    return (
      <div className="min-h-screen bg-snow flex flex-col items-center justify-center px-6 text-center">
        <p className="text-graphite font-bold text-lg mb-1">Receipt unavailable</p>
        <p className="text-charcoal text-sm mb-6">{error}</p>
        <button onClick={() => router.push('/dashboard/payments')} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">Back to payments</button>
      </div>
    )
  }

  const isMus = r.viewerRole === 'musician'
  const docTitle = isMus ? 'Payout Statement' : 'Payment Receipt'
  const statusLabel =
    r.status === 'cancelled' ? 'Cancelled / refunded'
      : r.paymentStatus === 'paid' ? (isMus && r.payoutReleased ? 'Paid out' : 'Paid')
        : r.paymentStatus === 'authorized' ? 'Authorized (held until gig)'
          : 'Awaiting payment'

  return (
    <div className="min-h-screen bg-snow print:bg-white py-8 px-4">
      {/* Controls — hidden when printing */}
      <div className="max-w-xl mx-auto flex items-center justify-between mb-5 print:hidden">
        <button onClick={() => router.push('/dashboard/payments')} className="text-charcoal/70 text-sm font-bold hover:text-graphite flex items-center gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Back
        </button>
        <button onClick={() => window.print()} className="bg-chestnut text-snow px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /></svg>
          Download / Print
        </button>
      </div>

      {/* Receipt */}
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm print:shadow-none print:rounded-none overflow-hidden">
        <div className="bg-graphite px-7 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Drum Up" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-snow font-black text-lg">Drum Up</span>
          </div>
          <div className="text-right">
            <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.25em]">{docTitle}</p>
            <p className="text-snow/50 text-xs font-medium mt-0.5">#{r.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>

        <div className="px-7 py-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Field label="Performance date" value={r.date ? r.date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) : '—'} />
            <Field label="Issued" value={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
            <Field label={isMus ? 'Paid by' : 'Venue'} value={r.venue} />
            <Field label={isMus ? 'Performer' : 'Paid to'} value={r.musician} />
            {r.payoutReleasedAt && (
              <Field label={isMus ? 'Paid out' : 'Payment captured'} value={r.payoutReleasedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} />
            )}
          </div>

          <div className="border-t border-charcoal/10 pt-4">
            <div className="flex items-center justify-between text-sm py-1.5">
              <span className="text-charcoal/70">{r.description}</span>
              <span className="text-graphite font-semibold tabular-nums">{usd(r.gross)}</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1.5">
              <span className="text-charcoal/70">Platform fee (8%)</span>
              <span className={`font-semibold tabular-nums ${isMus ? 'text-charcoal/70' : 'text-charcoal/40'}`}>{isMus ? `−${usd(r.fee)}` : `(${usd(r.fee)} incl.)`}</span>
            </div>
            <div className="flex items-center justify-between border-t border-charcoal/10 mt-2 pt-3">
              <span className="text-graphite font-bold">{isMus ? 'Net payout' : 'Total charged'}</span>
              <span className="text-graphite font-black text-xl tabular-nums">{usd(isMus ? r.net : r.gross)}</span>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between bg-snow rounded-xl px-4 py-3">
            <span className="text-charcoal/55 text-xs font-bold uppercase tracking-wider">Status</span>
            <span className="text-graphite text-sm font-bold">{statusLabel}</span>
          </div>
        </div>

        <div className="px-7 py-4 border-t border-charcoal/10 text-center">
          <p className="text-charcoal/40 text-[11px]">Processed securely through Stripe. This document is generated by Drum Up for your records.</p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-charcoal/45 text-[10px] font-bold uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-graphite text-sm font-semibold">{value}</p>
    </div>
  )
}
