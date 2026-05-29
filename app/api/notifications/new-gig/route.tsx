import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'
import { milesBetween } from '@/lib/distance'

// Gig alerts are in-app only (notification bell). No emails are sent here —
// fanning out one email per nearby musician/fan was by far our largest email
// source. Discovery happens in-app instead.
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

    const { availability_id } = await request.json() as { availability_id: string }
    if (!availability_id) return NextResponse.json({ error: 'Missing availability_id' }, { status: 400 })

    const { data: slot } = await supabaseAdmin
      .from('availability')
      .select('id, restaurant_id, date, start_time, end_time, pay, genres, latitude, longitude')
      .eq('id', availability_id)
      .maybeSingle()

    if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    // Only the venue that owns the slot can fan out alerts for it.
    if (slot.restaurant_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: venue } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role_metadata, location_text')
      .eq('id', slot.restaurant_id)
      .maybeSingle()

    const venueMeta = (venue?.role_metadata ?? {}) as Record<string, unknown>
    const venueName = (venueMeta.venue_name as string | undefined) ?? venue?.full_name ?? 'A venue'
    const slotGenres = Array.isArray(slot.genres) ? (slot.genres as string[]) : []
    const slotLat = slot.latitude as number | null
    const slotLon = slot.longitude as number | null

    const gigDate = new Date(slot.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
    })

    // ---- Musicians: within their radius + genre overlap ----
    const { data: musicians } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role_metadata, latitude, longitude, max_distance_miles, notify_gig_alerts')
      .eq('user_type', 'musician')

    const musicianMatches = (musicians ?? []).filter(m => {
      if (m.notify_gig_alerts === false) return false
      if (m.latitude == null || m.longitude == null || slotLat == null || slotLon == null) return false
      const radius = Number(m.max_distance_miles) || 25
      if (milesBetween(slotLat, slotLon, m.latitude as number, m.longitude as number) > radius) return false
      if (slotGenres.length === 0) return true
      const mGenres = Array.isArray((m.role_metadata as Record<string, unknown>)?.genres)
        ? ((m.role_metadata as Record<string, unknown>).genres as string[])
        : []
      return mGenres.some(g => slotGenres.includes(g))
    })

    // ---- Fans following this venue ----
    const { data: followRows } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('following_id', slot.restaurant_id)

    const followerIds = [...new Set((followRows ?? []).map(f => f.follower_id as string))]
    let fanMatches: { id: string; full_name: string | null }[] = []
    if (followerIds.length > 0) {
      const { data: fans } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, notify_gig_alerts')
        .in('id', followerIds)
        .eq('user_type', 'fan')
      fanMatches = (fans ?? [])
        .filter(f => f.notify_gig_alerts !== false)
        .map(f => ({ id: f.id as string, full_name: f.full_name as string | null }))
    }

    const genreLabel = slotGenres.length > 0 ? ` · ${slotGenres.slice(0, 3).join(', ')}` : ''

    // ---- In-app notifications (bulk, uncapped) ----
    const notifRows = [
      ...musicianMatches.map(m => ({
        user_id: m.id,
        type: 'new_gig',
        title: `New gig near you: ${venueName}`,
        body: `${gigDate}${genreLabel}`,
        link: '/dashboard',
      })),
      ...fanMatches.map(f => ({
        user_id: f.id,
        type: 'new_gig',
        title: `${venueName} posted a new show`,
        body: `${gigDate}${genreLabel}`,
        link: '/dashboard',
      })),
    ]
    if (notifRows.length > 0) {
      await supabaseAdmin.from('notifications').insert(notifRows)
    }

    return NextResponse.json({
      success: true,
      notified: notifRows.length,
    })
  } catch (err) {
    console.error('[new-gig] error:', err)
    return NextResponse.json({ success: false })
  }
}
