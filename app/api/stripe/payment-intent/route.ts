import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
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

    const body = await request.json() as {
      booking_id: string
      availability_id: string
      musician_id: string
      amount: number // in cents
    }
    const { booking_id, availability_id, musician_id, amount } = body

    // Prevent duplicate payment intents
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('stripe_payment_intent_id, payment_status')
      .eq('id', booking_id)
      .maybeSingle()

    if (existingBooking?.payment_status === 'authorized') {
      return NextResponse.json(
        { error: 'A payment for this booking is already authorized.' },
        { status: 409 },
      )
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

    const totalAmount = amount
    const platformFee = Math.round(totalAmount * 0.08)

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

    return NextResponse.json({ client_secret: paymentIntent.client_secret })
  } catch (err) {
    console.error('Payment intent error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
