import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { NewApplicationEmail } from '@/emails/NewApplicationEmail'

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

    const { booking_id } = await request.json() as { booking_id: string }
    if (!booking_id) return NextResponse.json({ error: 'Missing booking_id' }, { status: 400 })

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id, availability_id, restaurant_id, musician_id, pay_amount, note, status')
      .eq('id', booking_id)
      .maybeSingle()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const [
      { data: avail },
      { data: restaurant },
      { data: musician },
    ] = await Promise.all([
      supabaseAdmin.from('availability').select('date, start_time, end_time').eq('id', booking.availability_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, role_metadata').eq('id', booking.restaurant_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('id, full_name, performer_type').eq('id', booking.musician_id).maybeSingle(),
    ])

    const { data: { user: restaurantAuth } } = await supabaseAdmin.auth.admin.getUserById(booking.restaurant_id)
    const restaurantEmail = restaurantAuth?.email
    if (!restaurantEmail) {
      console.error('[Email] new-application: restaurant has no email')
      return NextResponse.json({ success: false, error: 'No restaurant email' })
    }

    const restMeta = (restaurant?.role_metadata ?? {}) as Record<string, unknown>
    const restaurantName = (restMeta.venue_name as string | undefined) ?? restaurant?.full_name ?? 'Your Venue'
    const musicianName = musician?.full_name ?? 'A Musician'
    const performerType = ((musician as Record<string, unknown>)?.performer_type as string | null) === 'band' ? 'band' : 'solo'

    const gigDate = avail
      ? new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'TBD'
    const gigTime = avail
      ? `${fmtTime(avail.start_time?.slice(0, 5) ?? '')} – ${fmtTime(avail.end_time?.slice(0, 5) ?? '')}`
      : 'TBD'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    await sendEmail({
      to: restaurantEmail,
      subject: `New application from ${musicianName}`,
      emailComponent: (
        <NewApplicationEmail
          restaurantName={restaurantName}
          musicianName={musicianName}
          performerType={performerType as 'solo' | 'band'}
          applicationNote={booking.note ?? ''}
          gigDate={gigDate}
          gigTime={gigTime}
          payAmount={Number(booking.pay_amount) || 0}
          dashboardUrl={`${appUrl}/dashboard`}
        />
      ),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Email] new-application error:', err)
    return NextResponse.json({ success: false })
  }
}

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}
