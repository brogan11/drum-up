import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, strictLimiter } from '@/lib/ratelimit'

/*
 * Required Supabase migrations (run once in the SQL editor):
 *
 *   ALTER TABLE availability ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;
 *   ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source text DEFAULT 'application';
 *   ALTER TABLE bookings ADD COLUMN IF NOT EXISTS invite_accepted boolean;
 */

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, strictLimiter)
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

    const { data: caller } = await supabaseAdmin
      .from('profiles')
      .select('user_type, latitude, longitude')
      .eq('id', user.id)
      .maybeSingle()

    if (caller?.user_type !== 'restaurant') {
      return NextResponse.json({ error: 'Only restaurants can send gig invites.' }, { status: 403 })
    }

    const body = await request.json() as {
      musician_id: string
      availability_id?: string
      date?: string
      start_time?: string
      end_time?: string
      pay?: number
      note?: string
    }

    const { musician_id, availability_id, date, start_time, end_time, pay, note } = body

    if (!musician_id) return NextResponse.json({ error: 'musician_id is required' }, { status: 400 })

    const { data: musician } = await supabaseAdmin
      .from('profiles')
      .select('id, user_type')
      .eq('id', musician_id)
      .maybeSingle()

    if (!musician || musician.user_type !== 'musician') {
      return NextResponse.json({ error: 'Musician not found' }, { status: 404 })
    }

    let slotId = availability_id
    let payAmount = pay ?? 0

    if (slotId) {
      const { data: existingSlot } = await supabaseAdmin
        .from('availability')
        .select('id, status, pay')
        .eq('id', slotId)
        .eq('restaurant_id', user.id)
        .maybeSingle()

      if (!existingSlot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
      if (existingSlot.status === 'filled' || existingSlot.status === 'cancelled') {
        return NextResponse.json({ error: 'Slot is no longer available' }, { status: 409 })
      }
      payAmount = Number(existingSlot.pay) || 0
    } else {
      if (!date || !start_time || !end_time || !pay) {
        return NextResponse.json(
          { error: 'date, start_time, end_time, and pay are required for new slots' },
          { status: 400 },
        )
      }

      const { data: newSlot, error: slotErr } = await supabaseAdmin
        .from('availability')
        .insert({
          restaurant_id: user.id,
          date,
          start_time,
          end_time,
          pay,
          status: 'open',
          is_private: true,
          description: note ?? null,
          latitude: caller.latitude,
          longitude: caller.longitude,
        })
        .select('id')
        .single()

      if (slotErr) throw slotErr
      slotId = newSlot.id
    }

    // Prevent duplicate pending invites for the same slot + musician
    const { data: existingInvite } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('availability_id', slotId)
      .eq('musician_id', musician_id)
      .eq('restaurant_id', user.id)
      .eq('source', 'invite')
      .neq('status', 'cancelled')
      .maybeSingle()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An active invite already exists for this slot.' },
        { status: 409 },
      )
    }

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from('bookings')
      .insert({
        availability_id: slotId,
        restaurant_id: user.id,
        musician_id,
        status: 'pending',
        pay_amount: payAmount,
        note: note ?? null,
        source: 'invite',
      })
      .select('id')
      .single()

    if (bookingErr) throw bookingErr

    return NextResponse.json({ booking_id: booking.id, availability_id: slotId })
  } catch (err) {
    console.error('[Invite] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
