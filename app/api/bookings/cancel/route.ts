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
      .select('id, musician_id, restaurant_id, payment_status, pay_amount, stripe_payment_intent_id, availability_id, status')
      .eq('id', bookingId)
      .maybeSingle()

    if (bookingErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 400 })
    if (booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed bookings can be cancelled this way' }, { status: 400 })
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
    const platformFeeInCents = Math.round(payAmount * 0.08 * 100)
    const paymentIntentId = booking.stripe_payment_intent_id as string | null
    const paymentStatus = booking.payment_status as string | null

    if (paymentIntentId && paymentStatus) {
      if (cancelledBy === 'musician') {
        if (paymentStatus === 'authorized') {
          await stripe.paymentIntents.cancel(paymentIntentId)
        } else if (paymentStatus === 'paid') {
          await stripe.refunds.create({ payment_intent: paymentIntentId })
        }
      } else {
        // Restaurant cancels: keep 8% platform fee, return the rest
        if (paymentStatus === 'authorized') {
          if (platformFeeInCents > 0) {
            // Partial capture of just the fee; Stripe auto-releases the remainder
            await stripe.paymentIntents.capture(paymentIntentId, {
              amount_to_capture: platformFeeInCents,
            })
          } else {
            await stripe.paymentIntents.cancel(paymentIntentId)
          }
        } else if (paymentStatus === 'paid') {
          const refundAmount = Math.round(payAmount * 0.92 * 100)
          if (refundAmount > 0) {
            await stripe.refunds.create({
              payment_intent: paymentIntentId,
              amount: refundAmount,
            })
          }
        }
      }
    }

    await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

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
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
