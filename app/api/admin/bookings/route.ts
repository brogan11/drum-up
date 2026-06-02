import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = adminClient()

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, pay_amount, platform_fee, status, payment_status, payout_released, created_at, restaurant_id, musician_id, availability_id, source')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ bookings: [] })
  }

  // Pull gig dates from the linked availability slots in one batch query.
  const availIds = [...new Set(bookings.map(b => b.availability_id).filter(Boolean))]
  const { data: avails } = availIds.length
    ? await supabase.from('availability').select('id, date').in('id', availIds)
    : { data: [] as { id: string; date: string }[] }
  const availMap = new Map((avails ?? []).map(a => [a.id, a.date]))

  // Collect unique profile IDs for a single batch query
  const profileIds = [...new Set([
    ...bookings.map(b => b.restaurant_id),
    ...bookings.map(b => b.musician_id),
  ].filter(Boolean))]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name, user_type, role_metadata')
    .in('id', profileIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const enriched = bookings.map(b => {
    const restaurant = profileMap.get(b.restaurant_id)
    const musician = profileMap.get(b.musician_id)
    const venueMeta = restaurant?.role_metadata as Record<string, unknown> | null
    return {
      id: b.id,
      pay_amount: b.pay_amount,
      platform_fee: b.platform_fee,
      status: b.status,
      payment_status: b.payment_status,
      payout_released: b.payout_released,
      created_at: b.created_at,
      gig_date: availMap.get(b.availability_id) ?? null,
      source: b.source ?? 'application',
      restaurant_username: restaurant?.username ?? '',
      restaurant_name: (venueMeta?.venue_name as string | undefined) ?? restaurant?.full_name ?? '—',
      musician_username: musician?.username ?? '',
      musician_name: musician?.full_name ?? '—',
    }
  })

  return NextResponse.json({ bookings: enriched })
}
