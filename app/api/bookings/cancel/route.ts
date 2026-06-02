import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { checkRateLimit, strictLimiter } from '@/lib/ratelimit'

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, strictLimiter)
  if (rl.limited) return rl.response!

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { bookingId, cancelledBy } = await request.json() as {
      bookingId: string
      cancelledBy: 'musician' | 'restaurant'
    }
    if (!bookingId || !cancelledBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, musician_id, restaurant_id, payment_status, pay_amount, platform_fee, stripe_payment_intent_id, availability_id, status')
      .eq('id', bookingId)
      .maybeSingle()

    if (bookingErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 400 })
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed bookings can be cancelled this way' }, { status: 400 })
    }
    // A 'paid' booking means the gig already ended and the payout was captured &
    // transferred to the musician. A self-serve refund here would either leave the
    // platform out of pocket (the transfer isn't reversed) or claw back money the
    // musician earned for a gig they played. Route these through support instead.
    if (booking.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'This gig has already been completed and paid out. Please contact support for any disputes.' },
        { status: 409 },
      )
    }

    if (cancelledBy === 'musician' && booking.musician_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (cancelledBy === 'restaurant' && booking.restaurant_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: avail } = await supabaseAdmin
      .from('availability')
      .select('date, start_time')
      .eq('id', booking.availability_id)
      .maybeSingle()

    const gigDatetime = avail
      ? new Date(`${avail.date}T${avail.start_time ?? '00:00:00'}`)
      : null
    const hoursUntilGig = gigDatetime ? (gigDatetime.getTime() - Date.now()) / 3600000 : null
    const within48h = hoursUntilGig !== null && hoursUntilGig <= 48

    const payAmount = Number(booking.pay_amount) || 0
    // Use the fee actually charged on this booking (respects any waiver); fall
    // back to 8% for legacy rows where it wasn't persisted.
    const platformFeeInCents = booking.platform_fee != null
      ? Math.round(Number(booking.platform_fee) * 100)
      : Math.round(payAmount * 0.08 * 100)
    const paymentIntentId = booking.stripe_payment_intent_id as string | null
    const paymentStatus = booking.payment_status as string | null

    // The payment is still just an authorization hold (never captured), so no
    // money has moved yet. Cancel or partially-capture the hold. Idempotency keys
    // make concurrent/duplicate cancel requests collapse to a single Stripe op.
    if (paymentIntentId && paymentStatus === 'authorized') {
      const idem = `cancel_${bookingId}`
      if (cancelledBy === 'musician') {
        // Musician backs out before the gig — release the whole hold.
        await stripe.paymentIntents.cancel(paymentIntentId, undefined, { idempotencyKey: idem })
      } else {
        // Restaurant cancels — keep the 8% platform fee, release the rest.
        if (platformFeeInCents > 0) {
          await stripe.paymentIntents.capture(
            paymentIntentId,
            { amount_to_capture: platformFeeInCents },
            { idempotencyKey: idem },
          )
        } else {
          await stripe.paymentIntents.cancel(paymentIntentId, undefined, { idempotencyKey: idem })
        }
      }
    }

    // Atomically claim the cancellation: only the request that flips
    // confirmed → cancelled proceeds to reopen the slot / apply the ban. A
    // concurrent second request sees no row and returns idempotently.
    const { data: claimed } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('status', 'confirmed')
      .select('id')
      .maybeSingle()

    if (!claimed) {
      return NextResponse.json({ success: true, banned: false })
    }

    // Re-open the slot so it can be filled again
    await supabaseAdmin
      .from('availability')
      .update({ status: 'open' })
      .eq('id', booking.availability_id)

    let banned = false
    if (cancelledBy === 'musician' && within48h) {
      await supabaseAdmin
        .from('profiles')
        .update({ is_banned: true })
        .eq('id', booking.musician_id)
      banned = true
    }

    return NextResponse.json({ success: true, banned })
  } catch (err) {
    console.error('[Cancel Booking] Error:', err)
    return NextResponse.json(
      { error: 'Could not cancel the booking. Please try again.' },
      { status: 500 },
    )
  }
}
