import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'

// In-app notification only — no email. A popular gig can draw many applications;
// venues see them in the bell and on their dashboard instead of one email each.

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
      .select('id, availability_id, restaurant_id, musician_id')
      .eq('id', booking_id)
      .maybeSingle()

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

    const [
      { data: avail },
      { data: musician },
    ] = await Promise.all([
      supabaseAdmin.from('availability').select('date').eq('id', booking.availability_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name').eq('id', booking.musician_id).maybeSingle(),
    ])

    const musicianName = musician?.full_name ?? 'A Musician'

    const gigDate = avail
      ? new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'TBD'

    await supabaseAdmin.from('notifications').insert({
      user_id: booking.restaurant_id,
      type: 'new_application',
      title: `New application from ${musicianName}`,
      body: `${musicianName} applied for your ${gigDate} slot`,
      link: '/dashboard',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[new-application] error:', err)
    return NextResponse.json({ success: false })
  }
}
