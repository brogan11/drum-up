import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

// Admin-only booking remediation. Guarded by middleware.ts (admin cookie) — this
// route sits under /api/admin/*. Uses the service role, so the DB write triggers
// are bypassed.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type Action = 'refund' | 'release_payout' | 'cancel_hold'

export async function POST(request: Request) {
  const supabase = adminClient()
  try {
    const { bookingId, action } = await request.json() as { bookingId: string; action: Action }
    if (!bookingId || !['refund', 'release_payout', 'cancel_hold'].includes(action)) {
      return NextResponse.json({ error: 'bookingId and a valid action are required' }, { status: 400 })
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, payment_status, stripe_payment_intent_id, availability_id, payout_released')
      .eq('id', bookingId)
      .maybeSingle()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    const pi = booking.stripe_payment_intent_id as string | null
    if (!pi) return NextResponse.json({ error: 'No payment intent on this booking' }, { status: 400 })

    if (action === 'refund') {
      // Full refund of a captured/paid gig. reverse_transfer pulls the funds back
      // from the musician's connected account; refund_application_fee returns our
      // platform fee — everyone is made whole.
      if (booking.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Only paid bookings can be refunded.' }, { status: 409 })
      }
      await stripe.refunds.create(
        { payment_intent: pi, reverse_transfer: true, refund_application_fee: true },
        { idempotencyKey: `admin_refund_${bookingId}` },
      )
      await supabase.from('bookings')
        .update({ status: 'cancelled', payment_status: 'refunded' })
        .eq('id', bookingId)
      return NextResponse.json({ success: true, action })
    }

    if (action === 'release_payout') {
      // Manually capture an authorized hold (e.g. if the daily cron failed).
      if (booking.payment_status !== 'authorized') {
        return NextResponse.json({ error: 'Only authorized holds can be released.' }, { status: 409 })
      }
      await stripe.paymentIntents.capture(pi, undefined, { idempotencyKey: `admin_capture_${bookingId}` })
      await supabase.from('bookings')
        .update({ payment_status: 'paid', payout_released: true, payout_released_at: new Date().toISOString() })
        .eq('id', bookingId)
      return NextResponse.json({ success: true, action })
    }

    // cancel_hold — release an authorized hold without charging, cancel the booking.
    if (booking.payment_status !== 'authorized') {
      return NextResponse.json({ error: 'Only authorized holds can be cancelled.' }, { status: 409 })
    }
    await stripe.paymentIntents.cancel(pi, undefined, { idempotencyKey: `admin_void_${bookingId}` })
    await supabase.from('bookings')
      .update({ status: 'cancelled', payment_status: 'failed' })
      .eq('id', bookingId)
    if (booking.availability_id) {
      await supabase.from('availability').update({ status: 'open' }).eq('id', booking.availability_id)
    }
    return NextResponse.json({ success: true, action })
  } catch (err) {
    console.error('[Admin booking-action] error:', err)
    return NextResponse.json({ error: 'Action failed. Check the booking in Stripe.' }, { status: 500 })
  }
}
