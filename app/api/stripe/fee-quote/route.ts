import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { feeCents, effectiveFeePct } from '@/lib/fees'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'

// Returns the effective fee for a booking BEFORE charging, so the payment modal
// can show accurate numbers (incl. any admin-granted waiver). Computed
// server-side so we don't expose other users' raw fee-override columns.
export async function POST(request: Request) {
  const rl = await checkRateLimit(request, standardLimiter)
  if (rl.limited) return rl.response!

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { booking_id } = await request.json() as { booking_id: string }
    if (!booking_id) return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })

    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('restaurant_id, musician_id, availability_id')
      .eq('id', booking_id)
      .maybeSingle()
    if (!booking || booking.restaurant_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: slot } = await supabaseAdmin
      .from('availability').select('pay').eq('id', booking.availability_id).maybeSingle()
    const totalCents = Math.round((Number(slot?.pay) || 0) * 100)

    const [{ data: musician }, { data: restaurant }] = await Promise.all([
      supabaseAdmin.from('profiles').select('platform_fee_pct, fee_waiver_until').eq('id', booking.musician_id).maybeSingle(),
      supabaseAdmin.from('profiles').select('platform_fee_pct, fee_waiver_until').eq('id', user.id).maybeSingle(),
    ])

    const fee = feeCents(totalCents, musician, restaurant)
    return NextResponse.json({
      totalCents,
      feeCents: fee,
      feePct: effectiveFeePct(musician, restaurant),
      musicianReceivesCents: totalCents - fee,
    })
  } catch {
    return NextResponse.json({ error: 'Could not load fee.' }, { status: 500 })
  }
}
