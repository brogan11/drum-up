import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

    const { booking_id, response } = await request.json() as {
      booking_id: string
      response: 'accept' | 'decline'
    }

    if (!booking_id || !response || !['accept', 'decline'].includes(response)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .select('id, musician_id, restaurant_id, availability_id, status, source, invite_accepted')
      .eq('id', booking_id)
      .maybeSingle()

    if (bookingErr || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    if (booking.musician_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if ((booking.source as string) !== 'invite') return NextResponse.json({ error: 'Not an invite' }, { status: 400 })
    if (booking.status !== 'pending' || booking.invite_accepted !== null) {
      return NextResponse.json({ error: 'Invite already responded to' }, { status: 409 })
    }

    if (response === 'accept') {
      await supabaseAdmin
        .from('bookings')
        .update({ invite_accepted: true })
        .eq('id', booking_id)
    } else {
      await supabaseAdmin
        .from('bookings')
        .update({ invite_accepted: false, status: 'cancelled' })
        .eq('id', booking_id)

      // Cancel the private slot so it doesn't stay open/orphaned
      await supabaseAdmin
        .from('availability')
        .update({ status: 'cancelled' })
        .eq('id', booking.availability_id)
        .eq('is_private', true)
    }

    return NextResponse.json({ success: true, response })
  } catch (err) {
    console.error('[Respond Invite] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
