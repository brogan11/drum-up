import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'

// In-app notification only — no email. A "not selected" message is low-urgency,
// so it lives in the bell rather than the inbox to conserve the email budget.

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
      { data: restaurant },
    ] = await Promise.all([
      supabaseAdmin.from('availability').select('date').eq('id', booking.availability_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('full_name, role_metadata').eq('id', booking.restaurant_id).maybeSingle(),
    ])

    const restMeta = (restaurant?.role_metadata ?? {}) as Record<string, unknown>
    const restaurantName = (restMeta.venue_name as string | undefined) ?? restaurant?.full_name ?? 'The Venue'

    const gigDate = avail
      ? new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'the requested date'

    await supabaseAdmin.from('notifications').insert({
      user_id: booking.musician_id,
      type: 'application_declined',
      title: 'Application not selected',
      body: `${restaurantName} filled the ${gigDate} slot with another musician`,
      link: '/dashboard',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[application-declined] error:', err)
    return NextResponse.json({ success: false })
  }
}
