import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
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

    const body = await request.json() as { booking_id: string }
    const { booking_id } = body
    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
    }

    // Authoritative source of truth: never trust an amount / musician / slot supplied by
    // the client. A restaurant could otherwise underpay the musician (and the platform
    // fee) or redirect the payout. Everything is derived from the booking row, and the
    // caller must be the restaurant on that booking.
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, restaurant_id, musician_id, availability_id, status, payment_status, stripe_payment_intent_id')
      .eq('id', booking_id)
      .maybeSingle()

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    if (booking.restaurant_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'This booking has been cancelled.' }, { status: 409 })
    }
    if (booking.payment_status === 'authorized' || booking.payment_status === 'paid') {
      return NextResponse.json(
        { error: 'A payment for this booking is already authorized.' },
        { status: 409 },
      )
    }

    const musician_id = booking.musician_id as string
    const availability_id = booking.availability_id as string

    // Price comes from the availability slot, whose `pay` only the owning restaurant can
    // set — NOT from booking.pay_amount, which a musician sets client-side when applying
    // and could inflate. Cross-check the slot belongs to this restaurant.
    const { data: slot } = await supabaseAdmin
      .from('availability')
      .select('pay, restaurant_id')
      .eq('id', availability_id)
      .maybeSingle()

    if (!slot || slot.restaurant_id !== user.id) {
      return NextResponse.json({ error: 'Slot not found for this booking.' }, { status: 404 })
    }

    const totalAmount = Math.round((Number(slot.pay) || 0) * 100) // cents
    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'Booking has no payable amount.' }, { status: 400 })
    }

    // Fetch musician's Stripe account
    const { data: musician } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', musician_id)
      .maybeSingle()

    if (!musician?.stripe_onboarded || !musician.stripe_account_id) {
      return NextResponse.json(
        { error: "Musician hasn't set up their payout account yet. Ask them to connect their bank account before confirming." },
        { status: 422 },
      )
    }

    // Reconcile the stored amount to the authoritative slot price so payout capture,
    // refunds, and emails (all of which read bookings.pay_amount) agree with what we
    // actually charge here.
    const payDollars = totalAmount / 100
    await supabaseAdmin
      .from('bookings')
      .update({ pay_amount: payDollars })
      .eq('id', booking_id)

    const platformFee = Math.round(totalAmount * 0.08)

    console.log('[Stripe] Creating payment intent:', {
      totalAmountCents: totalAmount,
      applicationFeeCents: platformFee,
      musicianReceivesCents: totalAmount - platformFee,
      destination: musician.stripe_account_id,
      bookingId: booking_id,
    })

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      capture_method: 'manual',
      application_fee_amount: platformFee,
      transfer_data: {
        destination: musician.stripe_account_id as string,
      },
      metadata: {
        booking_id,
        availability_id,
        musician_id,
        restaurant_id: user.id,
      },
    })

    console.log('[Stripe] Payment intent created:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      applicationFeeAmount: paymentIntent.application_fee_amount,
      transferDestination: paymentIntent.transfer_data?.destination,
      captureMethod: paymentIntent.capture_method,
      status: paymentIntent.status,
    })

    return NextResponse.json({ client_secret: paymentIntent.client_secret })
  } catch (err) {
    console.error('Payment intent error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
