import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { PayoutReleasedEmail } from '@/emails/PayoutReleasedEmail'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  let released = 0
  let errors = 0

  try {
    const { data: bookings, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('id, stripe_payment_intent_id, availability_id, pay_amount, musician_id, restaurant_id')
      .eq('payment_status', 'authorized')
      .eq('payout_released', false)
      .eq('status', 'confirmed')

    if (fetchErr) throw fetchErr
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ released: 0, message: 'No payouts due.' })
    }

    const availIds = bookings.map(b => b.availability_id)
    const { data: avails, error: availErr } = await supabaseAdmin
      .from('availability')
      .select('id, date')
      .in('id', availIds)
      .lt('date', today)

    if (availErr) throw availErr
    const pastAvailIds = new Set((avails ?? []).map(a => a.id))
    const due = bookings.filter(b => pastAvailIds.has(b.availability_id))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    for (const booking of due) {
      try {
        const availDate = avails?.find(a => a.id === booking.availability_id)?.date
        console.log('[Payout] Processing booking:', {
          bookingId: booking.id,
          paymentIntentId: booking.stripe_payment_intent_id,
          gigDate: availDate,
          amount: booking.pay_amount,
        })
        const captured = await stripe.paymentIntents.capture(booking.stripe_payment_intent_id as string)
        console.log('[Payout] Capture result:', {
          id: captured.id,
          status: captured.status,
          amountCaptured: captured.amount_received / 100,
        })
        await supabaseAdmin
          .from('bookings')
          .update({ payment_status: 'paid', payout_released: true })
          .eq('id', booking.id)
        released++

        // Send payout released email to musician (fire and forget)
        void (async () => {
          try {
            const [
              { data: { user: musicianAuth } },
              { data: musician },
              { data: restaurant },
            ] = await Promise.all([
              supabaseAdmin.auth.admin.getUserById(booking.musician_id as string),
              supabaseAdmin.from('profiles').select('full_name').eq('id', booking.musician_id).maybeSingle(),
              supabaseAdmin.from('profiles').select('full_name, role_metadata').eq('id', booking.restaurant_id).maybeSingle(),
            ])

            if (!musicianAuth?.email) return

            const restMeta = (restaurant?.role_metadata ?? {}) as Record<string, unknown>
            const restaurantName = (restMeta.venue_name as string | undefined) ?? restaurant?.full_name ?? 'The Venue'
            const musicianName = musician?.full_name ?? 'Musician'
            const payAmount = Number(booking.pay_amount) || 0
            const platformFee = Math.round(payAmount * 0.08 * 100) / 100
            const musicianReceives = Math.round((payAmount - platformFee) * 100) / 100

            const gigDate = availDate
              ? new Date(availDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric',
                })
              : 'your gig'

            await sendEmail({
              to: musicianAuth.email,
              subject: `💸 Your payment of $${musicianReceives.toFixed(2)} is on the way!`,
              emailComponent: (
                <PayoutReleasedEmail
                  musicianName={musicianName}
                  restaurantName={restaurantName}
                  gigDate={gigDate}
                  amount={musicianReceives}
                  dashboardUrl={`${appUrl}/dashboard`}
                />
              ),
            })
          } catch (emailErr) {
            console.error(`[Email] payout-released email failed for booking ${booking.id}:`, emailErr)
          }
        })()
      } catch (captureErr) {
        console.error(`Failed to capture payout for booking ${booking.id}:`, captureErr)
        errors++
      }
    }

    return NextResponse.json({ released, errors, message: `Released ${released} payout(s).` })
  } catch (err) {
    console.error('Release payout error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
