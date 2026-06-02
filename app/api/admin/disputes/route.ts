import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Admin-only: Stripe disputes / chargebacks, enriched with the related booking +
// party names where we can match on the payment intent. Guarded by middleware.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  try {
    const list = await stripe.disputes.list({ limit: 100 })

    // Resolve payment-intent ids → bookings → party names.
    const piIds = [...new Set(list.data.map(d =>
      typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id,
    ).filter(Boolean) as string[])]

    const supabase = adminClient()
    const bookingByPi = new Map<string, { id: string; restaurant_id: string; musician_id: string }>()
    if (piIds.length) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, restaurant_id, musician_id, stripe_payment_intent_id')
        .in('stripe_payment_intent_id', piIds)
      for (const b of bookings ?? []) {
        if (b.stripe_payment_intent_id) bookingByPi.set(b.stripe_payment_intent_id, b)
      }
    }

    const profileIds = [...new Set([...bookingByPi.values()].flatMap(b => [b.restaurant_id, b.musician_id]).filter(Boolean))]
    const { data: profiles } = profileIds.length
      ? await supabase.from('profiles').select('id, full_name, username').in('id', profileIds)
      : { data: [] as { id: string; full_name: string | null; username: string | null }[] }
    const pMap = new Map((profiles ?? []).map(p => [p.id, p]))

    const disputes = list.data.map(d => {
      const pi = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id
      const booking = pi ? bookingByPi.get(pi) : undefined
      const restaurant = booking ? pMap.get(booking.restaurant_id) : undefined
      const musician = booking ? pMap.get(booking.musician_id) : undefined
      return {
        id: d.id,
        amount: d.amount / 100,
        currency: d.currency.toUpperCase(),
        reason: d.reason,
        status: d.status,
        created: new Date(d.created * 1000).toISOString(),
        evidence_due_by: d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString() : null,
        evidence_submitted: !!d.evidence_details?.submission_count,
        is_refundable: d.is_charge_refundable,
        payment_intent: pi ?? null,
        booking_id: booking?.id ?? null,
        restaurant_name: restaurant ? (restaurant.full_name || (restaurant.username ? '@' + restaurant.username : '—')) : null,
        musician_name: musician ? (musician.full_name || (musician.username ? '@' + musician.username : '—')) : null,
      }
    })

    const openStatuses = ['warning_needs_response', 'needs_response', 'warning_under_review', 'under_review']
    const openCount = disputes.filter(d => openStatuses.includes(d.status)).length
    const totalDisputed = disputes.reduce((s, d) => s + d.amount, 0)

    return NextResponse.json({ disputes, openCount, totalDisputed })
  } catch (err) {
    console.error('[Admin disputes] error:', err)
    return NextResponse.json({ error: 'Failed to load disputes from Stripe' }, { status: 500 })
  }
}
