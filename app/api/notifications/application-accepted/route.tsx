import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { ApplicationAcceptedEmail } from '@/emails/ApplicationAcceptedEmail'
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
      .select('id, availability_id, restaurant_id, musician_id, pay_amount')
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

    const { data: { user: musicianAuth } } = await supabaseAdmin.auth.admin.getUserById(booking.musician_id)
    const musicianEmail = musicianAuth?.email
    if (!musicianEmail) {
      console.error('[Email] application-accepted: musician has no email')
      return NextResponse.json({ success: false, error: 'No musician email' })
    }

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    await Promise.all([
      sendEmail({
        to: musicianEmail,
        subject: `You're booked at ${restaurantName}! 🎉`,
        emailComponent: (
          <ApplicationAcceptedEmail
            musicianName={musicianName}
            restaurantName={restaurantName}
            gigDate={gigDate}
            gigTime={gigTime}
            payAmount={payAmount}
            platformFee={platformFee}
            musicianReceives={musicianReceives}
            restaurantAddress={restaurantAddress}
            dashboardUrl={`${appUrl}/dashboard`}
          />
        ),
      }),
      supabaseAdmin.from('notifications').insert({
        user_id: booking.musician_id,
        type: 'application_accepted',
        title: 'Application accepted!',
        body: `You're booked at ${restaurantName} on ${gigDate}`,
        link: '/dashboard',
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Email] application-accepted error:', err)
    return NextResponse.json({ success: false })
  }
}

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}
