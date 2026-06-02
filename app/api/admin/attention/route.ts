import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const PAYOUT_MARGIN_MS = 12 * 60 * 60 * 1000
const venueName = (p: { full_name: string | null; role_metadata: unknown } | undefined) => {
  const m = (p?.role_metadata ?? {}) as Record<string, unknown>
  return (m.venue_name as string | undefined) ?? p?.full_name ?? '—'
}

export async function GET() {
  const supabase = adminClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, pay_amount, status, payment_status, payout_released, availability_id, musician_id, restaurant_id')
    .eq('status', 'confirmed')

  const confirmed = bookings ?? []

  const profileIds = [...new Set(confirmed.flatMap(b => [b.musician_id, b.restaurant_id]).filter(Boolean))]
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, username, full_name, role_metadata, stripe_onboarded').in('id', profileIds)
    : { data: [] as { id: string; username: string | null; full_name: string | null; role_metadata: unknown; stripe_onboarded: boolean | null }[] }
  const pMap = new Map((profiles ?? []).map(p => [p.id, p]))

  // ---- Musicians with confirmed gigs but no Stripe payout setup ----
  const byMusician = new Map<string, number>()
  for (const b of confirmed) {
    if (!b.musician_id) continue
    if (pMap.get(b.musician_id)?.stripe_onboarded === true) continue
    byMusician.set(b.musician_id, (byMusician.get(b.musician_id) ?? 0) + 1)
  }
  const unonboarded = [...byMusician.entries()].map(([id, count]) => ({
    musician_id: id,
    name: pMap.get(id)?.full_name ?? '—',
    username: pMap.get(id)?.username ?? '',
    confirmedGigs: count,
  })).sort((a, b) => b.confirmedGigs - a.confirmedGigs)

  // ---- Overdue payouts: gig ended (+margin) but still uncaptured ----
  const candidates = confirmed.filter(b => b.payment_status === 'authorized' && !b.payout_released)
  let overdue: {
    bookingId: string; musician_name: string; restaurant_name: string; gigDate: string; pay_amount: number
  }[] = []
  if (candidates.length) {
    const availIds = [...new Set(candidates.map(b => b.availability_id).filter(Boolean))]
    const { data: avails } = await supabase
      .from('availability').select('id, date, end_time').in('id', availIds)
    const aMap = new Map((avails ?? []).map(a => [a.id, a]))
    const now = Date.now()
    overdue = candidates
      .map(b => {
        const a = aMap.get(b.availability_id)
        if (!a?.date) return null
        const ms = Date.parse(`${a.date}T${a.end_time ?? '23:59:59'}Z`)
        if (Number.isNaN(ms) || ms + PAYOUT_MARGIN_MS > now) return null
        return {
          bookingId: b.id,
          musician_name: pMap.get(b.musician_id)?.full_name ?? '—',
          restaurant_name: venueName(pMap.get(b.restaurant_id)),
          gigDate: a.date as string,
          pay_amount: Number(b.pay_amount) || 0,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.gigDate.localeCompare(b.gigDate))
  }

  return NextResponse.json({ unonboarded, overdue })
}
