import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, strictLimiter } from '@/lib/ratelimit'

// Confirms a booking AFTER the restaurant has authorized payment client-side.
// The booking lifecycle/payment columns are locked to the service role by DB
// trigger (see 2026_06_02_security_hardening.sql), so this route is the ONLY way
// a booking becomes 'confirmed'/'authorized'. It re-verifies the PaymentIntent
// with Stripe so the client can't fake a payment.
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

    const { booking_id, payment_intent_id } = await request.json() as {
      booking_id: string
      payment_intent_id: string
    }
    if (!booking_id || !payment_intent_id) {
      return NextResponse.json({ error: 'booking_id and payment_intent_id are required' }, { status: 400 })
    }

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, restaurant_id, musician_id, availability_id, status, payment_status')
      .eq('id', booking_id)
      .maybeSingle()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.restaurant_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'This booking has been cancelled.' }, { status: 409 })
    }
    if (booking.status === 'confirmed' && booking.payment_status === 'authorized') {
      // Idempotent: already confirmed (e.g. a double-submit).
      return NextResponse.json({ success: true, alreadyConfirmed: true })
    }

    // Authoritative price from the slot the restaurant owns.
    const { data: slot } = await supabaseAdmin
      .from('availability')
      .select('pay, restaurant_id')
      .eq('id', booking.availability_id)
      .maybeSingle()
    if (!slot || slot.restaurant_id !== user.id) {
      return NextResponse.json({ error: 'Slot not found for this booking.' }, { status: 404 })
    }
    const expectedAmount = Math.round((Number(slot.pay) || 0) * 100)

    const { data: musician } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', booking.musician_id)
      .maybeSingle()

    // Verify the PaymentIntent really belongs to this booking, is a held
    // authorization (manual capture), and pays the right amount to the right
    // musician. This is what stops a client claiming payment without paying.
    const pi = await stripe.paymentIntents.retrieve(payment_intent_id)
    if (pi.metadata?.booking_id !== booking_id) {
      return NextResponse.json({ error: 'Payment does not match this booking.' }, { status: 400 })
    }
    if (pi.status !== 'requires_capture') {
      return NextResponse.json({ error: 'Payment has not been authorized.' }, { status: 400 })
    }
    if (pi.amount !== expectedAmount) {
      return NextResponse.json({ error: 'Payment amount mismatch.' }, { status: 400 })
    }
    // Persist the fee the PaymentIntent actually used (0 if fully waived).
    const platformFee = (pi.application_fee_amount ?? 0) / 100
    const destination = typeof pi.transfer_data?.destination === 'string'
      ? pi.transfer_data.destination
      : pi.transfer_data?.destination?.id
    if (musician?.stripe_account_id && destination && destination !== musician.stripe_account_id) {
      return NextResponse.json({ error: 'Payout destination mismatch.' }, { status: 400 })
    }

    // Atomically claim the confirmation (guards against double-submit races).
    const { data: confirmed, error: confirmErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'confirmed',
        payment_status: 'authorized',
        stripe_payment_intent_id: payment_intent_id,
        platform_fee: platformFee,
      })
      .eq('id', booking_id)
      .neq('status', 'cancelled')
      .neq('payment_status', 'authorized')
      .select('id')
      .maybeSingle()

    if (confirmErr) throw confirmErr
    if (!confirmed) {
      return NextResponse.json({ success: true, alreadyConfirmed: true })
    }

    // Fill the slot and decline the other pending applicants for it.
    await supabaseAdmin.from('availability').update({ status: 'filled' }).eq('id', booking.availability_id)
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('availability_id', booking.availability_id)
      .eq('status', 'pending')
      .neq('id', booking_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Confirm Booking] Error:', err)
    return NextResponse.json({ error: 'Could not confirm the booking. Please try again.' }, { status: 500 })
  }
}
