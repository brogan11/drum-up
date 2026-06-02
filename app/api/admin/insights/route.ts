import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const venueName = (p: { full_name: string | null; role_metadata: unknown } | undefined) => {
  const m = (p?.role_metadata ?? {}) as Record<string, unknown>
  return (m.venue_name as string | undefined) ?? p?.full_name ?? '—'
}

export async function GET() {
  const supabase = adminClient()
  const today = new Date().toISOString().slice(0, 10)

  const [availRes, bookingsRes, invitesRes, profilesRes] = await Promise.all([
    supabase.from('availability').select('id, status, created_at, date, restaurant_id'),
    supabase.from('bookings').select('id, status, source, created_at, availability_id, restaurant_id, musician_id'),
    supabase.from('invitations').select('inviter_id, status'),
    supabase.from('profiles').select('id, location_text, full_name, username, role_metadata, user_type'),
  ])

  const avails = availRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const invites = invitesRes.data ?? []
  const profiles = profilesRes.data ?? []
  const pMap = new Map(profiles.map(p => [p.id, p]))

  // ---- Marketplace health ----
  const filled = avails.filter(a => a.status === 'filled').length
  const open = avails.filter(a => a.status === 'open').length
  const cancelledSlots = avails.filter(a => a.status === 'cancelled').length
  const fillRate = filled + open > 0 ? (filled / (filled + open)) * 100 : 0
  const openFutureGigs = avails.filter(a => a.status === 'open' && (a.date ?? '') >= today).length

  const applications = bookings.filter(b => (b.source ?? 'application') === 'application')
  const appConfirmed = applications.filter(b => b.status === 'confirmed').length
  const appConversion = applications.length > 0 ? (appConfirmed / applications.length) * 100 : 0

  // Avg time-to-fill: slot posted → its confirmed booking created.
  const availCreated = new Map(avails.map(a => [a.id, a.created_at]))
  const fillDurations = bookings
    .filter(b => b.status === 'confirmed' && b.availability_id && availCreated.has(b.availability_id))
    .map(b => {
      const posted = Date.parse(availCreated.get(b.availability_id) as string)
      const booked = Date.parse(b.created_at)
      return Number.isNaN(posted) || Number.isNaN(booked) ? null : (booked - posted) / 86400000
    })
    .filter((d): d is number => d != null && d >= 0)
  const avgTimeToFillDays = fillDurations.length
    ? fillDurations.reduce((s, d) => s + d, 0) / fillDurations.length
    : null

  // Repeat rates (confirmed bookings).
  const confirmed = bookings.filter(b => b.status === 'confirmed')
  const countBy = (key: 'restaurant_id' | 'musician_id') => {
    const m = new Map<string, number>()
    for (const b of confirmed) { const id = b[key]; if (id) m.set(id, (m.get(id) ?? 0) + 1) }
    return m
  }
  const repeatRate = (m: Map<string, number>) => {
    const total = m.size
    const repeat = [...m.values()].filter(c => c > 1).length
    return total > 0 ? (repeat / total) * 100 : 0
  }
  const venueCounts = countBy('restaurant_id')
  const musicianCounts = countBy('musician_id')

  // ---- Referrals ----
  const acceptedInv = invites.filter(i => i.status === 'accepted').length
  const inviterAgg = new Map<string, { total: number; accepted: number }>()
  for (const i of invites) {
    if (!i.inviter_id) continue
    const cur = inviterAgg.get(i.inviter_id) ?? { total: 0, accepted: 0 }
    cur.total++
    if (i.status === 'accepted') cur.accepted++
    inviterAgg.set(i.inviter_id, cur)
  }
  const topInviters = [...inviterAgg.entries()]
    .map(([id, v]) => ({
      name: venueName(pMap.get(id)) !== '—' ? venueName(pMap.get(id)) : (pMap.get(id)?.full_name ?? '—'),
      username: pMap.get(id)?.username ?? '',
      total: v.total,
      accepted: v.accepted,
    }))
    .sort((a, b) => b.accepted - a.accepted || b.total - a.total)
    .slice(0, 8)

  // ---- Top markets (by user home location) ----
  const marketAgg = new Map<string, number>()
  for (const p of profiles) {
    const loc = (p.location_text ?? '').trim()
    if (!loc) continue
    marketAgg.set(loc, (marketAgg.get(loc) ?? 0) + 1)
  }
  const topMarkets = [...marketAgg.entries()]
    .map(([location, users]) => ({ location, users }))
    .sort((a, b) => b.users - a.users)
    .slice(0, 8)

  return NextResponse.json({
    health: {
      fillRate,
      filledSlots: filled,
      openSlots: open,
      cancelledSlots,
      openFutureGigs,
      appConversion,
      applications: applications.length,
      appConfirmed,
      avgTimeToFillDays,
      repeatVenuePct: repeatRate(venueCounts),
      repeatMusicianPct: repeatRate(musicianCounts),
      activeVenues: venueCounts.size,
      activeMusicians: musicianCounts.size,
    },
    referrals: {
      total: invites.length,
      accepted: acceptedInv,
      pending: invites.length - acceptedInv,
      conversion: invites.length > 0 ? (acceptedInv / invites.length) * 100 : 0,
      topInviters,
    },
    markets: topMarkets,
  })
}
