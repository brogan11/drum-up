import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const venueName = (p: { full_name: string | null; role_metadata: unknown } | undefined) => {
  const m = (p?.role_metadata ?? {}) as Record<string, unknown>
  return (m.venue_name as string | undefined) ?? p?.full_name ?? '—'
}

export async function GET(request: Request) {
  const supabase = adminClient()
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, user_type, created_at, is_banned, location_text, bio, stripe_onboarded, platform_fee_pct, fee_waiver_until')
    .eq('id', id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const [bookingsRes, reviewsRes, reportsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, pay_amount, status, payment_status, created_at, availability_id, musician_id, restaurant_id')
      .or(`musician_id.eq.${id},restaurant_id.eq.${id}`)
      .order('created_at', { ascending: false }),
    supabase.from('reviews').select('rating').eq('reviewee_id', id),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('reported_id', id),
  ])

  const bookings = bookingsRes.data ?? []
  const reviews = reviewsRes.data ?? []

  // Counterpart names + gig dates
  const counterpartIds = [...new Set(bookings.map(b => (b.musician_id === id ? b.restaurant_id : b.musician_id)).filter(Boolean))]
  const availIds = [...new Set(bookings.map(b => b.availability_id).filter(Boolean))]
  const [{ data: cProfiles }, { data: avails }] = await Promise.all([
    counterpartIds.length
      ? supabase.from('profiles').select('id, full_name, username, role_metadata').in('id', counterpartIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; username: string | null; role_metadata: unknown }[] }),
    availIds.length
      ? supabase.from('availability').select('id, date').in('id', availIds)
      : Promise.resolve({ data: [] as { id: string; date: string }[] }),
  ])
  const cMap = new Map((cProfiles ?? []).map(p => [p.id, p]))
  const aMap = new Map((avails ?? []).map(a => [a.id, a]))

  const paid = bookings.filter(b => b.payment_status === 'paid')
  const ltv = paid.reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)

  const bookingList = bookings.slice(0, 50).map(b => {
    const asMusician = b.musician_id === id
    const cp = cMap.get(asMusician ? b.restaurant_id : b.musician_id)
    return {
      id: b.id,
      role: asMusician ? 'musician' : 'restaurant',
      counterpart: asMusician ? venueName(cp) : (cp?.full_name ?? '—'),
      counterpart_username: cp?.username ?? '',
      pay_amount: Number(b.pay_amount) || 0,
      status: b.status,
      payment_status: b.payment_status,
      gig_date: (aMap.get(b.availability_id)?.date as string) ?? null,
      created_at: b.created_at,
    }
  })

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length
    : null

  return NextResponse.json({
    profile,
    stats: {
      ltv,
      paidGigs: paid.length,
      totalBookings: bookings.length,
      reviewsReceived: reviews.length,
      avgRating,
      reportsAgainst: reportsRes.count ?? 0,
    },
    bookings: bookingList,
  })
}
