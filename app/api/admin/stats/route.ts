import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { estimateStripeFee } from '@/lib/fees'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Realized fee for a booking: prefer the persisted column, fall back to 8%.
const feeOf = (b: { platform_fee: number | null; pay_amount: number | null }) =>
  b.platform_fee != null ? Number(b.platform_fee) : (Number(b.pay_amount) || 0) * 0.08

// A gig has truly ended only after its end time. No timezone is stored, so we
// treat end-time as UTC and require a 12h margin (mirrors the payout cron) before
// a still-uncaptured payout counts as "overdue".
const PAYOUT_MARGIN_MS = 12 * 60 * 60 * 1000

export async function GET() {
  const supabase = adminClient()

  const [profilesRes, bookingsRes, reportsRes] = await Promise.all([
    supabase.from('profiles').select('id, user_type, created_at, stripe_onboarded'),
    supabase
      .from('bookings')
      .select('id, pay_amount, platform_fee, status, payment_status, payout_released, payout_released_at, created_at, availability_id, musician_id'),
    supabase.from('reports').select('id').eq('resolved', false),
  ])

  const profiles = profilesRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const openReports = (reportsRes.data ?? []).length

  // ---- Headline counts ----
  const usersByType = profiles.reduce<Record<string, number>>((acc, p) => {
    const t = p.user_type ?? 'unknown'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})
  const bookingsByStatus = bookings.reduce<Record<string, number>>((acc, b) => {
    const s = b.status ?? 'unknown'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  // ---- Money (realized + pending) ----
  const paid = bookings.filter(b => b.payment_status === 'paid')
  const gmvRealized = paid.reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)
  const revenueRealized = paid.reduce((s, b) => s + feeOf(b), 0)
  const avgBookingValue = paid.length ? gmvRealized / paid.length : 0
  const takeRatePct = gmvRealized > 0 ? (revenueRealized / gmvRealized) * 100 : 0
  // We absorb Stripe's processing fee (destination charges), so true profit is
  // the platform fee minus an estimated Stripe fee per paid gig.
  const stripeFeesRealized = paid.reduce((s, b) => s + estimateStripeFee(Number(b.pay_amount) || 0), 0)
  const netRevenue = revenueRealized - stripeFeesRealized
  const netTakeRatePct = gmvRealized > 0 ? (netRevenue / gmvRealized) * 100 : 0

  const pending = bookings.filter(
    b => b.status === 'confirmed' && b.payment_status === 'authorized' && !b.payout_released,
  )
  const pendingPayoutGross = pending.reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)
  const pendingRevenue = pending.reduce((s, b) => s + feeOf(b), 0)

  // ---- Time-windowed pulse (by created_at) ----
  const now = Date.now()
  const DAY = 86400000
  const confirmed = bookings.filter(b => b.status === 'confirmed')

  const windowSum = <T,>(rows: T[], ts: (r: T) => number | null, val: (r: T) => number, startAgo: number, endAgo: number) =>
    rows.reduce((s, r) => {
      const t = ts(r)
      if (t == null) return s
      return t <= now - startAgo * DAY && t > now - endAgo * DAY ? s + val(r) : s
    }, 0)

  const created = (r: { created_at: string }) => Date.parse(r.created_at)
  const win = <T,>(rows: T[], ts: (r: T) => number | null, val: (r: T) => number) => ({
    d7: windowSum(rows, ts, val, 0, 7),
    p7: windowSum(rows, ts, val, 7, 14),
    d30: windowSum(rows, ts, val, 0, 30),
    p30: windowSum(rows, ts, val, 30, 60),
  })

  const pulse = {
    signups: win(profiles, created, () => 1),
    bookings: win(bookings, created, () => 1),
    gmv: win(confirmed, created, b => Number(b.pay_amount) || 0),
    revenue: win(confirmed, created, b => feeOf(b)),
  }

  // ---- 30-day daily series ----
  const seriesBookings: { label: string; value: number }[] = []
  const seriesGmv: { label: string; value: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const dayStart = new Date(now - i * DAY)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = dayStart.getTime() + DAY
    const label = dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const inDay = (iso: string) => {
      const t = Date.parse(iso)
      return t >= dayStart.getTime() && t < dayEnd
    }
    seriesBookings.push({ label, value: bookings.filter(b => inDay(b.created_at)).length })
    seriesGmv.push({
      label,
      value: confirmed.filter(b => inDay(b.created_at)).reduce((s, b) => s + (Number(b.pay_amount) || 0), 0),
    })
  }

  // ---- Attention: musicians with confirmed gigs but no Stripe payout setup ----
  const onboardedById = new Map(profiles.map(p => [p.id, p.stripe_onboarded === true]))
  const unonboardedMusicians = new Set(
    confirmed.filter(b => b.musician_id && onboardedById.get(b.musician_id) !== true).map(b => b.musician_id),
  )

  // ---- Attention: overdue payouts (gig ended + margin, still uncaptured) ----
  const overdueCandidates = bookings.filter(
    b => b.status === 'confirmed' && b.payment_status === 'authorized' && !b.payout_released,
  )
  let overduePayouts = 0
  if (overdueCandidates.length) {
    const availIds = [...new Set(overdueCandidates.map(b => b.availability_id).filter(Boolean))]
    const { data: avails } = await supabase
      .from('availability')
      .select('id, date, end_time')
      .in('id', availIds)
    const availById = new Map((avails ?? []).map(a => [a.id, a]))
    overduePayouts = overdueCandidates.filter(b => {
      const a = availById.get(b.availability_id)
      if (!a?.date) return false
      const ms = Date.parse(`${a.date}T${a.end_time ?? '23:59:59'}Z`)
      return !Number.isNaN(ms) && ms + PAYOUT_MARGIN_MS <= now
    }).length
  }

  return NextResponse.json({
    totalUsers: profiles.length,
    usersByType,
    totalBookings: bookings.length,
    bookingsByStatus,
    // Back-compat with the existing UI field:
    totalRevenue: revenueRealized,
    openReports,
    money: {
      gmvRealized,
      revenueRealized,
      stripeFeesRealized,
      netRevenue,
      takeRatePct,
      netTakeRatePct,
      avgBookingValue,
      pendingPayoutGross,
      pendingPayoutCount: pending.length,
      pendingRevenue,
    },
    pulse: { ...pulse, seriesBookings, seriesGmv },
    attention: {
      unonboardedWithGigs: unonboardedMusicians.size,
      overduePayouts,
      openReports,
    },
  })
}
