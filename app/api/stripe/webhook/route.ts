import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (bookingId) {
          await supabaseAdmin
            .from('bookings')
            .update({ payment_status: 'authorized' })
            .eq('id', bookingId)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const bookingId = pi.metadata?.booking_id
        if (bookingId) {
          await supabaseAdmin
            .from('bookings')
            .update({ status: 'cancelled', payment_status: 'failed' })
            .eq('id', bookingId)
          const availId = pi.metadata?.availability_id
          if (availId) {
            await supabaseAdmin
              .from('availability')
              .update({ status: 'open' })
              .eq('id', availId)
          }
        }
        break
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const onboarded =
          account.details_submitted === true &&
          account.charges_enabled === true &&
          account.payouts_enabled === true
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_onboarded: onboarded })
          .eq('stripe_account_id', account.id)
        break
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
