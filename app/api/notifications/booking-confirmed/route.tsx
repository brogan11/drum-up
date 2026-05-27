import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { BookingConfirmedEmail } from '@/emails/BookingConfirmedEmail'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, standardLimiter)
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

    const { booking_id } = await request.json() as { booking_id: string }
    if (!booking_id) return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, availability_id, restaurant_id, musician_id, pay_amount, stripe_payment_intent_id')
      .eq('id', booking_id)
      .maybeSingle()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const [
      { data: avail },
      { data: restaurant },
      { data: musician },
    ] = await Promise.all([
      supabaseAdmin.from('availability').select('date, start_time, end_time').eq('id', booking.availability_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, role_metadata, location_text').eq('id', booking.restaurant_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name').eq('id', booking.musician_id).maybeSingle(),
    ])

    const [
      { data: { user: restaurantAuth } },
      { data: { user: musicianAuth } },
    ] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(booking.restaurant_id),
      supabaseAdmin.auth.admin.getUserById(booking.musician_id),
    ])

    const restMeta = (restaurant?.role_metadata ?? {}) as Record<string, unknown>
    const restaurantName = (restMeta.venue_name as string | undefined) ?? restaurant?.full_name ?? 'The Venue'
    const musicianName = musician?.full_name ?? 'Musician'
    const restaurantAddress = (restaurant as Record<string, unknown>)?.location_text as string ?? ''

    const gigDate = avail
      ? new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'TBD'
    const gigTime = avail
      ? `${fmtTime(avail.start_time?.slice(0, 5) ?? '')} – ${fmtTime(avail.end_time?.slice(0, 5) ?? '')}`
      : 'TBD'

    const payAmount = Number(booking.pay_amount) || 0
    const platformFee = Math.round(payAmount * 0.08 * 100) / 100
    const musicianReceives = Math.round((payAmount - platformFee) * 100) / 100
    const stripePaymentIntentId = (booking as Record<string, unknown>).stripe_payment_intent_id as string ?? ''
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    const sharedProps = {
      musicianName,
      restaurantName,
      gigDate,
      gigTime,
      restaurantAddress,
      payAmount,
      platformFee,
      musicianReceives,
      stripePaymentIntentId,
      dashboardUrl: `${appUrl}/dashboard`,
    }

    const sends: Promise<unknown>[] = []

    if (restaurantAuth?.email) {
      sends.push(
        sendEmail({
          to: restaurantAuth.email,
          subject: `Booking Confirmed — ${musicianName} · ${gigDate}`,
          emailComponent: (
            <BookingConfirmedEmail
              recipientName={restaurantName}
              recipientType="restaurant"
              {...sharedProps}
            />
          ),
        }),
      )
    }

    if (musicianAuth?.email) {
      sends.push(
        sendEmail({
          to: musicianAuth.email,
          subject: `Booking Confirmed — ${restaurantName} · ${gigDate}`,
          emailComponent: (
            <BookingConfirmedEmail
              recipientName={musicianName}
              recipientType="musician"
              {...sharedProps}
            />
          ),
        }),
      )
    }

    await Promise.all(sends)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Email] booking-confirmed error:', err)
    return NextResponse.json({ success: false })
  }
}

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}
