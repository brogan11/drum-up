import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { CancellationEmail } from '@/emails/CancellationEmail'

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

    const { booking_id, cancelled_by } = await request.json() as {
      booking_id: string
      cancelled_by: 'musician' | 'restaurant'
    }
    if (!booking_id || !cancelled_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

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
      supabaseAdmin.from('availability').select('date').eq('id', booking.availability_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name, role_metadata').eq('id', booking.restaurant_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', booking.musician_id).maybeSingle(),
    ])

    const restMeta = (restaurant?.role_metadata ?? {}) as Record<string, unknown>
    const restaurantName = (restMeta.venue_name as string | undefined) ?? restaurant?.full_name ?? 'The Venue'
    const musicianName = musician?.full_name ?? 'Musician'
    const payAmount = Number(booking.pay_amount) || 0

    const gigDate = avail
      ? new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        })
      : 'your upcoming gig'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    // Email the party who did NOT cancel
    const recipientId = cancelled_by === 'musician' ? booking.restaurant_id : booking.musician_id
    const recipientName = cancelled_by === 'musician' ? restaurantName : musicianName

    const { data: { user: recipientAuth } } = await supabaseAdmin.auth.admin.getUserById(recipientId as string)
    if (!recipientAuth?.email) return NextResponse.json({ success: true, sent: false })

    const subject = cancelled_by === 'musician'
      ? `Booking Cancelled — ${musicianName} · ${gigDate}`
      : `Your Gig Was Cancelled — ${restaurantName} · ${gigDate}`

    await sendEmail({
      to: recipientAuth.email,
      subject,
      emailComponent: (
        <CancellationEmail
          recipientName={recipientName}
          cancelledBy={cancelled_by}
          musicianName={musicianName}
          restaurantName={restaurantName}
          gigDate={gigDate}
          amount={payAmount}
          dashboardUrl={`${appUrl}/dashboard`}
        />
      ),
    })

    return NextResponse.json({ success: true, sent: true })
  } catch (err) {
    console.error('[Email] cancellation notification error:', err)
    return NextResponse.json({ success: false })
  }
}
