import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('stripe_payment_intent_id')
      .eq('payment_status', 'authorized')
      .not('stripe_payment_intent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!booking?.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'No authorized bookings with a payment intent found.' }, { status: 404 })
    }

    const pi = await stripe.paymentIntents.retrieve(booking.stripe_payment_intent_id)

    return NextResponse.json({
      paymentIntentId: pi.id,
      totalCharged: pi.amount / 100,
      applicationFee: (pi.application_fee_amount ?? 0) / 100,
      applicationFeePercent: (((pi.application_fee_amount ?? 0) / pi.amount) * 100).toFixed(2) + '%',
      transferDestination: pi.transfer_data?.destination,
      captureMethod: pi.capture_method,
      status: pi.status,
      musicianReceives: (pi.amount - (pi.application_fee_amount ?? 0)) / 100,
      currency: pi.currency,
      metadata: pi.metadata,
    })
  } catch (err) {
    console.error('Stripe verify error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
