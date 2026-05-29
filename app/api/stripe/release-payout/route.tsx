import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { PayoutReleasedEmail } from '@/emails/PayoutReleasedEmail'
import { checkRateLimit, strictLimiter } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, strictLimiter)
  if (rl.limited) return rl.response!

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const authHeader = request.headers.get('authorization') ?? ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // A gig has truly ended only after its wall-clock end time, but no timezone is
  // stored for the gig or venue (see availability schema: date + start_time +
  // end_time are all naive local values). We therefore treat the wall-clock end
  // as UTC and require it to be this far in the past before releasing. Since every
  // US zone is BEHIND UTC, the real end instant is always LATER than the treat-as-
  // UTC value — by at most ~10h (Hawaii, UTC-10). A 12h margin guarantees we never
  // capture before a gig has ended anywhere in the US, while still being small
  // enough that the once-daily noon-UTC cron catches the prior night's gigs.
  const SAFETY_MARGIN_MS = 12 * 60 * 60 * 1000
  const nowMs = Date.now()
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
      .select('id, date, start_time, end_time')
      .in('id', availIds)

    if (availErr) throw availErr
    const availById = new Map((avails ?? []).map(a => [a.id, a]))

    // Absolute (treat-as-UTC) instant the gig ended, or null if undeterminable.
    const gigEndedMs = (a: { date?: string | null; end_time?: string | null } | undefined): number | null => {
      if (!a?.date) return null
      const endTime = a.end_time ?? '23:59:59' // missing end => latest plausible, never pays early
      const ms = Date.parse(`${a.date}T${endTime}Z`)
      return Number.isNaN(ms) ? null : ms
    }

    // Only gigs whose end time (+ safety margin) is in the past are due for payout.
    const due = bookings.filter(b => {
      const endedMs = gigEndedMs(availById.get(b.availability_id))
      return endedMs != null && endedMs + SAFETY_MARGIN_MS <= nowMs
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    for (const booking of due) {
      try {
        const availDate = availById.get(booking.availability_id)?.date
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

export async function GET(request: Request) {
  return POST(request)
}
