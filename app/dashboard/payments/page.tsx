'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DASH_BG } from '@/lib/analytics'
import { DollarSign, Calendar, Banknote, Hourglass, Ban } from '@/components/Icons'

// Platform takes 8% (app/api/stripe/payment-intent/route.ts). Musicians net 92%; the
// restaurant is charged the full amount.
const FEE_RATE = 0.08
const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

interface Row {
  id: string
  date: Date | null
  counterpart: string
  description: string
  gross: number // full slot pay
  fee: number
  net: number // to musician
  status: string // booking status
  paymentStatus: string | null
  payoutReleased: boolean | null
}

type Tone = 'paid' | 'scheduled' | 'pending' | 'cancelled'
type Filter = 'all' | 'paid' | 'pending' | 'cancelled'

// Derive a human status + tone from the booking's payment/booking state.
function deriveStatus(r: Row, role: 'musician' | 'restaurant'): { label: string; tone: Tone } {
  if (r.status === 'cancelled') return { label: role === 'restaurant' ? 'Cancelled / refunded' : 'Cancelled', tone: 'cancelled' }
  if (r.paymentStatus === 'paid') {
    if (role === 'musician') return { label: r.payoutReleased ? 'Paid out' : 'Paid', tone: 'paid' }
    return { label: 'Paid', tone: 'paid' }
  }
  if (r.paymentStatus === 'authorized') return { label: role === 'musician' ? 'Scheduled' : 'Authorized (held)', tone: 'scheduled' }
  return { label: 'Awaiting payment', tone: 'pending' }
}

const TONE_CLASS: Record<Tone, string> = {
  paid: 'bg-teal/15 text-teal',
  scheduled: 'bg-chestnut/15 text-chestnut',
  pending: 'bg-charcoal/10 text-charcoal/70',
  cancelled: 'bg-charcoal/10 text-charcoal/50 line-through decoration-charcoal/30',
}

export default function PaymentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'musician' | 'restaurant' | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) { router.push('/auth/login'); return }
        const { data: profile } = await supabase.from('profiles').select('user_type').eq('id', user.id).maybeSingle()
        if (!profile) { router.push('/onboarding'); return }
        if (profile.user_type !== 'musician' && profile.user_type !== 'restaurant') { router.replace('/dashboard'); return }
        const r = profile.user_type as 'musician' | 'restaurant'
        setRole(r)

        const uid = user.id
        const { data: bks } = await supabase
          .from('bookings')
          .select('id, availability_id, restaurant_id, musician_id, status, pay_amount, payment_status, payout_released, created_at')
          .eq(r === 'musician' ? 'musician_id' : 'restaurant_id', uid)
          .order('created_at', { ascending: false })

        const bookings = bks ?? []
        const availIds = [...new Set(bookings.map(b => b.availability_id).filter(Boolean))] as string[]
        const otherIds = [...new Set(bookings.map(b => (r === 'musician' ? b.restaurant_id : b.musician_id)).filter(Boolean))] as string[]
        const [aRes, pRes] = await Promise.all([
          availIds.length ? supabase.from('availability').select('id, date, description').in('id', availIds) : Promise.resolve({ data: [] as { id: string; date: string; description: string }[] }),
          otherIds.length ? supabase.from('profiles').select('id, full_name, role_metadata').in('id', otherIds) : Promise.resolve({ data: [] as { id: string; full_name: string; role_metadata: Record<string, unknown> | null }[] }),
        ])
        const aMap = new Map((aRes.data ?? []).map(a => [a.id, a as { id: string; date: string; description: string }]))
        const pMap = new Map<string, string>()
        for (const p of (pRes.data ?? []) as { id: string; full_name: string; role_metadata: Record<string, unknown> | null }[]) {
          const mt = (p.role_metadata ?? {}) as Record<string, unknown>
          pMap.set(p.id, (r === 'musician' ? (mt.venue_name as string) : (mt.stage_name as string)) || p.full_name || (r === 'musician' ? 'Venue' : 'Musician'))
        }

        const built: Row[] = bookings.map(b => {
          const av = b.availability_id ? aMap.get(b.availability_id) : undefined
          const gross = Number(b.pay_amount) || 0
          const fee = gross * FEE_RATE
          const otherId = (r === 'musician' ? b.restaurant_id : b.musician_id) as string | null
          return {
            id: b.id,
            date: av?.date ? new Date(av.date + 'T00:00:00') : (b.created_at ? new Date(b.created_at) : null),
            counterpart: (otherId && pMap.get(otherId)) || (r === 'musician' ? 'Venue' : 'Musician'),
            description: av?.description || 'Live music gig',
            gross,
            fee,
            net: gross - fee,
            status: b.status,
            paymentStatus: b.payment_status,
            payoutReleased: b.payout_released,
          }
        })
        setRows(built)
      } catch (err) {
        console.error('Payments load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const totals = useMemo(() => {
    const isMus = role === 'musician'
    const settled = rows.filter(r => r.paymentStatus === 'paid' && r.status !== 'cancelled')
    const pending = rows.filter(r => r.status !== 'cancelled' && r.paymentStatus !== 'paid' && (r.paymentStatus === 'authorized' || r.status === 'confirmed'))
    const thisYear = settled.filter(r => r.date && r.date.getFullYear() === new Date().getFullYear())
    const val = (r: Row) => (isMus ? r.net : r.gross)
    return {
      settledTotal: settled.reduce((s, r) => s + val(r), 0),
      pendingTotal: pending.reduce((s, r) => s + val(r), 0),
      yearTotal: thisYear.reduce((s, r) => s + val(r), 0),
      settledCount: settled.length,
    }
  }, [rows, role])

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filter === 'all') return true
      if (filter === 'cancelled') return r.status === 'cancelled'
      if (filter === 'paid') return r.paymentStatus === 'paid' && r.status !== 'cancelled'
      // pending
      return r.status !== 'cancelled' && r.paymentStatus !== 'paid'
    })
  }, [rows, filter])

  const isMus = role === 'musician'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={DASH_BG}>
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={DASH_BG}>
      <header className="sticky top-0 z-30 bg-graphite/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} aria-label="Back to dashboard" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-snow">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-snow font-black text-xl leading-tight">Payments</h1>
            <p className="text-snow/50 text-xs font-medium truncate">{isMus ? 'Your gig earnings & payouts' : 'Your talent spend'}</p>
          </div>
          <Banknote className="w-5 h-5 text-chestnut" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Stat icon={<DollarSign className="w-4 h-4" />} label={isMus ? 'Earned' : 'Spent'} value={usd(totals.settledTotal)} sub={`${totals.settledCount} paid`} accent="#6C9A8B" />
          <Stat icon={<Hourglass className="w-4 h-4" />} label={isMus ? 'Pending' : 'Committed'} value={usd(totals.pendingTotal)} accent="#DC7F41" />
          <Stat icon={<Calendar className="w-4 h-4" />} label="This year" value={usd(totals.yearTotal)} />
        </div>

        {/* Filters */}
        <div className="inline-flex bg-white rounded-xl shadow-sm p-1 mb-4">
          {(['all', 'paid', 'pending', 'cancelled'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-chestnut text-snow' : 'text-charcoal/60 hover:text-graphite'}`}>{f}</button>
          ))}
        </div>

        {/* Transactions */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm py-16 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-snow flex items-center justify-center text-charcoal/30 mb-3"><Banknote className="w-6 h-6" /></div>
            <p className="text-graphite font-bold text-sm">No transactions{filter !== 'all' ? ` (${filter})` : ''} yet</p>
            <p className="text-charcoal/50 text-xs mt-1 max-w-xs">{isMus ? 'Earnings appear here once a venue pays for a confirmed gig.' : 'Payments appear here once you pay a musician for a confirmed gig.'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm divide-y divide-charcoal/[0.07] overflow-hidden">
            {filtered.map(r => {
              const st = deriveStatus(r, role!)
              const canReceipt = r.paymentStatus === 'paid' && r.status !== 'cancelled'
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                  <div className="w-10 h-10 rounded-xl bg-snow flex flex-col items-center justify-center shrink-0 text-charcoal/70">
                    <span className="text-[10px] font-bold uppercase leading-none">{r.date ? r.date.toLocaleDateString('en-US', { month: 'short' }) : '—'}</span>
                    <span className="text-sm font-black leading-none mt-0.5">{r.date ? r.date.getDate() : ''}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-graphite font-bold text-sm truncate">{r.counterpart}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TONE_CLASS[st.tone]}`}>{st.label}</span>
                      {canReceipt && (
                        <button onClick={() => router.push(`/dashboard/payments/receipt/${r.id}`)} className="text-[11px] font-bold text-chestnut hover:underline">Receipt</button>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-black text-sm ${r.status === 'cancelled' ? 'text-charcoal/40 line-through' : isMus ? 'text-teal' : 'text-graphite'}`}>
                      {isMus ? '+' : '−'}{usd(isMus ? r.net : r.gross)}
                    </p>
                    <p className="text-charcoal/40 text-[10px] font-medium">{isMus ? `${usd(r.fee)} fee` : `incl. ${usd(r.fee)} fee`}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-charcoal/40 text-[11px] text-center mt-4 flex items-center justify-center gap-1.5">
          <Ban className="w-3 h-3" /> Payments are processed securely through Stripe.
        </p>
      </main>
    </div>
  )
}

function Stat({ icon, label, value, sub, accent }: { icon: ReactNode; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: (accent ?? '#5E5E5E') + '22', color: accent ?? '#5E5E5E' }}>{icon}</span>
        <span className="text-charcoal/55 text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-graphite text-lg font-black leading-none">{value}</p>
      {sub && <p className="text-charcoal/45 text-[11px] font-medium mt-1">{sub}</p>}
    </div>
  )
}
