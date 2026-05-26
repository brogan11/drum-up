import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { GigReminderEmail } from '@/emails/GigReminderEmail'

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

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  let sent = 0
  let errors = 0

  try {
    const { data: bookings, error: fetchErr } = await supabaseAdmin
      .from('bookings')
      .select('id, availability_id, restaurant_id, musician_id, pay_amount')
      .eq('status', 'confirmed')

    if (fetchErr) throw fetchErr
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No confirmed bookings.' })
    }

    const availIds = bookings.map(b => b.availability_id)
    const { data: avails } = await supabaseAdmin
      .from('availability')
      .select('id, date, start_time, end_time')
      .in('id', availIds)
      .eq('date', tomorrowStr)

    if (!avails || avails.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No gigs tomorrow.' })
    }

    const tomorrowAvailIds = new Set(avails.map(a => a.id))
    const tomorrowBookings = bookings.filter(b => tomorrowAvailIds.has(b.availability_id))

    const restaurantIds = [...new Set(tomorrowBookings.map(b => b.restaurant_id))]
    const musicianIds = [...new Set(tomorrowBookings.map(b => b.musician_id))]

    const [{ data: restaurants }, { data: musicians }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, role_metadata, location_text').in('id', restaurantIds),
      supabaseAdmin.from('profiles').select('id, full_name').in('id', musicianIds),
    ])

    const restaurantById = new Map((restaurants ?? []).map(r => [r.id, r]))
    const musicianById = new Map((musicians ?? []).map(m => [m.id, m]))
    const availById = new Map(avails.map(a => [a.id, a]))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    for (const booking of tomorrowBookings) {
      const avail = availById.get(booking.availability_id)
      const restaurant = restaurantById.get(booking.restaurant_id)
      const musician = musicianById.get(booking.musician_id)
      if (!avail || !restaurant || !musician) continue

      const restMeta = (restaurant.role_metadata ?? {}) as Record<string, unknown>
      const restaurantName = (restMeta.venue_name as string | undefined) ?? restaurant.full_name ?? 'The Venue'
      const musicianName = musician.full_name ?? 'Musician'
      const restaurantAddress = (restaurant as Record<string, unknown>).location_text as string ?? ''

      const gigDate = new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      })
      const gigTime = `${fmtTime(avail.start_time?.slice(0, 5) ?? '')} – ${fmtTime(avail.end_time?.slice(0, 5) ?? '')}`

      try {
        const [
          { data: { user: restaurantAuth } },
          { data: { user: musicianAuth } },
        ] = await Promise.all([
          supabaseAdmin.auth.admin.getUserById(booking.restaurant_id),
          supabaseAdmin.auth.admin.getUserById(booking.musician_id),
        ])

        const reminderSends: Promise<unknown>[] = []

        if (restaurantAuth?.email) {
          reminderSends.push(
            sendEmail({
              to: restaurantAuth.email,
              subject: `Reminder: ${musicianName} performs tomorrow`,
              emailComponent: (
                <GigReminderEmail
                  recipientName={restaurantName}
                  recipientType="restaurant"
                  otherPartyName={musicianName}
                  gigDate={gigDate}
                  gigTime={gigTime}
                  restaurantAddress={restaurantAddress}
                  dashboardUrl={`${appUrl}/dashboard`}
                />
              ),
            }),
          )
        }

        if (musicianAuth?.email) {
          reminderSends.push(
            sendEmail({
              to: musicianAuth.email,
              subject: `Reminder: Your gig at ${restaurantName} is tomorrow`,
              emailComponent: (
                <GigReminderEmail
                  recipientName={musicianName}
                  recipientType="musician"
                  otherPartyName={restaurantName}
                  gigDate={gigDate}
                  gigTime={gigTime}
                  restaurantAddress={restaurantAddress}
                  dashboardUrl={`${appUrl}/dashboard`}
                />
              ),
            }),
          )
        }

        await Promise.all(reminderSends)
        sent += reminderSends.length
      } catch (err) {
        console.error(`[GigReminder] Failed for booking ${booking.id}:`, err)
        errors++
      }
    }

    return NextResponse.json({ sent, errors, message: `Sent ${sent} reminder(s).` })
  } catch (err) {
    console.error('[GigReminder] Cron error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}

export async function GET(request: Request) {
  return POST(request)
}
