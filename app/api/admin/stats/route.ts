import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = adminClient()

  const [profilesRes, bookingsRes, revenueRes, reportsRes] = await Promise.all([
    // User counts by type
    supabase.from('profiles').select('user_type'),

    // Booking counts by status
    supabase.from('bookings').select('status'),

    // Revenue: sum platform_fee where payment_status = 'captured' or 'paid'
    supabase
      .from('bookings')
      .select('platform_fee')
      .in('payment_status', ['captured', 'paid']),

    // Open (unresolved) reports
    supabase.from('reports').select('id').eq('resolved', false),
  ])

  const profiles = profilesRes.data ?? []
  const bookings = bookingsRes.data ?? []
  const revenueRows = revenueRes.data ?? []
  const openReports = reportsRes.data ?? []

  const usersByType = profiles.reduce<Record<string, number>>((acc, p) => {
    const t = p.user_type ?? 'unknown'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {})

  const bookingsByStatus = bookings.reduce<Record<string, number>>((acc, b) => {
    const s = b.status ?? 'unknown'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  const totalRevenue = revenueRows.reduce((sum, r) => sum + (Number(r.platform_fee) || 0), 0)

  return NextResponse.json({
    totalUsers: profiles.length,
    usersByType,
    totalBookings: bookings.length,
    bookingsByStatus,
    totalRevenue,
    openReports: openReports.length,
  })
}
