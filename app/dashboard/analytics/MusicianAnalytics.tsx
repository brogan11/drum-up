'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AreaChart, BarChart, Donut, HBars, Radar, CHART, type Slice, type HBarRow } from '@/components/Charts'
import { Kpi, Card, EmptyCard, RangeTabs, AnalyticsHeader, InsightsCard } from '@/components/AnalyticsUI'
import { ratingDistribution, aspectAverages, topTags } from '@/lib/reviews'
import { DollarSign, MusicNote, Star, User, Eye, Hourglass } from '@/components/Icons'
import { type Range, money, moneyAxis, pctDelta, DASH_BG, buildBuckets, series } from '@/lib/analytics'
import { musicianNet } from '@/lib/fees'

// Earnings are net to the musician. We use the fee actually charged on each
// booking (bookings.platform_fee, 0 when waived); legacy rows fall back to 8%.
interface BookingRow {
  id: string
  availability_id: string | null
  restaurant_id: string | null
  status: string
  pay_amount: number | null
  platform_fee: number | null
  payment_status: string | null
  payout_released: boolean | null
  created_at: string
}
interface ReviewRow {
  rating: number
  aspects: Record<string, number> | null
  tags: string[] | null
  created_at: string
}

export default function MusicianAnalytics() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('90d')
  const [name, setName] = useState('')

  const [views, setViews] = useState<Date[]>([])
  const [followers, setFollowers] = useState<Date[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [gigDates, setGigDates] = useState<Map<string, Date>>(new Map())
  const [venueNames, setVenueNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { router.push('/auth/login'); return }

        const { data: profile } = await supabase
          .from('profiles').select('id, full_name, role_metadata').eq('id', user.id).maybeSingle()
        const meta = (profile?.role_metadata ?? {}) as Record<string, unknown>
        setName((meta.stage_name as string) || profile?.full_name || 'You')

        const uid = user.id
        const [vRes, fRes, bRes, rRes] = await Promise.all([
          supabase.from('profile_views').select('viewed_at').eq('profile_id', uid),
          supabase.from('follows').select('created_at').eq('following_id', uid),
          supabase.from('bookings')
            .select('id, availability_id, restaurant_id, status, pay_amount, platform_fee, payment_status, payout_released, created_at')
            .eq('musician_id', uid),
          supabase.from('reviews').select('rating, aspects, tags, created_at').eq('reviewee_id', uid),
        ])

        setViews((vRes.data ?? []).map(r => new Date(r.viewed_at as string)))
        setFollowers((fRes.data ?? []).map(r => new Date(r.created_at as string)))
        const bks = (bRes.data ?? []) as BookingRow[]
        setBookings(bks)
        setReviews((rRes.data ?? []) as ReviewRow[])

        const availIds = [...new Set(bks.map(b => b.availability_id).filter(Boolean))] as string[]
        const restIds = [...new Set(bks.map(b => b.restaurant_id).filter(Boolean))] as string[]
        const [aRes, pRes] = await Promise.all([
          availIds.length ? supabase.from('availability').select('id, date').in('id', availIds) : Promise.resolve({ data: [] as { id: string; date: string }[] }),
          restIds.length ? supabase.from('profiles').select('id, full_name, role_metadata').in('id', restIds) : Promise.resolve({ data: [] as { id: string; full_name: string; role_metadata: Record<string, unknown> | null }[] }),
        ])
        const gd = new Map<string, Date>()
        for (const a of (aRes.data ?? []) as { id: string; date: string }[]) if (a.date) gd.set(a.id, new Date(a.date + 'T00:00:00'))
        setGigDates(gd)
        const vn = new Map<string, string>()
        for (const p of (pRes.data ?? []) as { id: string; full_name: string; role_metadata: Record<string, unknown> | null }[]) {
          const mt = (p.role_metadata ?? {}) as Record<string, unknown>
          vn.set(p.id, (mt.venue_name as string) || p.full_name || 'Venue')
        }
        setVenueNames(vn)
      } catch (err) {
        console.error('Analytics load failed:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const m = useMemo(() => {
    const now = Date.now()
    const d30 = now - 30 * 86400000
    const d60 = now - 60 * 86400000
    const gigDateFor = (b: BookingRow) => (b.availability_id && gigDates.get(b.availability_id)) || new Date(b.created_at)

    const confirmed = bookings.filter(b => b.status === 'confirmed')
    const paid = bookings.filter(b => b.payment_status === 'paid')
    const netEarned = paid.reduce((s, b) => s + musicianNet(Number(b.pay_amount) || 0, b.platform_fee), 0)
    const pending = confirmed.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + musicianNet(Number(b.pay_amount) || 0, b.platform_fee), 0)

    const gigsPlayed = confirmed.filter(b => gigDateFor(b).getTime() < now).length
    const upcoming = confirmed.filter(b => gigDateFor(b).getTime() >= now).length

    const totalApps = bookings.length
    const cancelled = bookings.filter(b => b.status === 'cancelled').length
    const pendingCount = bookings.filter(b => b.status === 'pending').length
    const confRate = totalApps > 0 ? (confirmed.length / totalApps) * 100 : 0
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

    const views30 = views.filter(d => d.getTime() >= d30).length
    const viewsPrev30 = views.filter(d => d.getTime() >= d60 && d.getTime() < d30).length
    const viewsDelta = pctDelta(views30, viewsPrev30)
    const followersNew30 = followers.filter(d => d.getTime() >= d30).length

    const earn30 = paid.filter(b => gigDateFor(b).getTime() >= d30).reduce((s, b) => s + musicianNet(Number(b.pay_amount) || 0, b.platform_fee), 0)
    const earnPrev30 = paid.filter(b => { const t = gigDateFor(b).getTime(); return t >= d60 && t < d30 }).reduce((s, b) => s + musicianNet(Number(b.pay_amount) || 0, b.platform_fee), 0)
    const earnDelta = pctDelta(earn30, earnPrev30)

    const venueAgg = new Map<string, { gigs: number; earned: number }>()
    for (const b of confirmed) {
      if (!b.restaurant_id) continue
      const cur = venueAgg.get(b.restaurant_id) ?? { gigs: 0, earned: 0 }
      cur.gigs += 1
      cur.earned += musicianNet(Number(b.pay_amount) || 0, b.platform_fee)
      venueAgg.set(b.restaurant_id, cur)
    }
    const topVenues = [...venueAgg.entries()].sort((a, b) => b[1].gigs - a[1].gigs).slice(0, 6)
      .map(([id, v]) => ({ name: venueNames.get(id) ?? 'Venue', gigs: v.gigs, earned: v.earned }))

    return { netEarned, pending, gigsPlayed, upcoming, totalApps, cancelled, pendingCount, confirmedCount: confirmed.length, confRate, avgRating, reviewCount: reviews.length, views30, viewsDelta, followersTotal: followers.length, followersNew30, earnDelta, topVenues }
  }, [bookings, reviews, views, followers, gigDates, venueNames])

  const charts = useMemo(() => {
    const allDates = [...views, ...followers, ...bookings.map(b => new Date(b.created_at))]
    const earliest = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
    const buckets = buildBuckets(range, earliest)
    const gigDateFor = (b: BookingRow) => (b.availability_id && gigDates.get(b.availability_id)) || new Date(b.created_at)
    const viewsSeries = series(views.map(d => ({ date: d, value: 1 })), buckets)
    const followerSeries = series(followers.map(d => ({ date: d, value: 1 })), buckets, true)
    const earnItems = bookings.filter(b => b.payment_status === 'paid').map(b => ({ date: gigDateFor(b), value: musicianNet(Number(b.pay_amount) || 0, b.platform_fee) }))
    const earnSeries = series(earnItems, buckets)
    return { viewsSeries, followerSeries, earnSeries }
  }, [range, views, followers, bookings, gigDates])

  const ratingRows: HBarRow[] = useMemo(() => {
    const dist = ratingDistribution(reviews)
    const max = Math.max(...dist.map(d => d.count), 1)
    return dist.map(d => ({ label: '★'.repeat(d.stars), value: d.count, max, display: String(d.count) }))
  }, [reviews])
  const aspectAxes = useMemo(() => aspectAverages(reviews, 'musician').map(a => ({ label: a.label, value: a.avg })), [reviews])
  const tags = useMemo(() => topTags(reviews, 8), [reviews])

  const statusSlices: Slice[] = [
    { label: 'Confirmed', value: m.confirmedCount, color: CHART.teal },
    { label: 'Pending', value: m.pendingCount, color: CHART.chestnut },
    { label: 'Cancelled', value: m.cancelled, color: CHART.charcoal },
  ]

  const insights = useMemo(() => {
    const out: string[] = []
    if (m.viewsDelta != null && Math.abs(m.viewsDelta) >= 5)
      out.push(m.viewsDelta >= 0 ? `Profile views are up ${Math.round(m.viewsDelta)}% vs the previous 30 days — your visibility is growing.` : `Profile views are down ${Math.round(Math.abs(m.viewsDelta))}% vs the previous 30 days. Posting new availability or videos can help.`)
    if (aspectAxes.length) {
      const best = [...aspectAxes].sort((a, b) => b.value - a.value)[0]
      const worst = [...aspectAxes].sort((a, b) => a.value - b.value)[0]
      out.push(`Venues rate you highest on ${best.label} (${best.value.toFixed(1)}/5).`)
      if (worst.value < 4 && worst.label !== best.label) out.push(`Your lowest-rated area is ${worst.label} (${worst.value.toFixed(1)}/5) — a chance to level up.`)
    }
    if (m.topVenues.length && m.topVenues[0].gigs > 1) out.push(`${m.topVenues[0].name} is your top repeat venue with ${m.topVenues[0].gigs} gigs booked.`)
    if (m.totalApps >= 3) out.push(`${Math.round(m.confRate)}% of your applications & invites turn into confirmed gigs.`)
    if (m.pending > 0) out.push(`You have ${money(m.pending)} in pending payouts from upcoming or unpaid gigs.`)
    if (m.followersNew30 > 0) out.push(`You gained ${m.followersNew30} new follower${m.followersNew30 > 1 ? 's' : ''} in the last 30 days.`)
    return out.slice(0, 5)
  }, [m, aspectAxes])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={DASH_BG}>
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={DASH_BG}>
      <AnalyticsHeader title="Analytics" subtitle={name} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-5">
          <Kpi icon={<DollarSign className="w-4 h-4" />} label="Net earnings" value={money(m.netEarned)} sub="After platform fee" delta={m.earnDelta} spark={charts.earnSeries.map(p => p.value)} sparkColor={CHART.chestnut} />
          <Kpi icon={<Hourglass className="w-4 h-4" />} label="Pending payouts" value={money(m.pending)} sub={`${m.upcoming} upcoming gig${m.upcoming === 1 ? '' : 's'}`} accent={CHART.teal} />
          <Kpi icon={<MusicNote className="w-4 h-4" />} label="Gigs played" value={String(m.gigsPlayed)} sub={`${m.confirmedCount} confirmed total`} />
          <Kpi icon={<Eye className="w-4 h-4" />} label="Profile views" value={String(m.views30)} sub="Last 30 days" delta={m.viewsDelta} spark={charts.viewsSeries.map(p => p.value)} sparkColor={CHART.teal} />
          <Kpi icon={<Star className="w-4 h-4" />} label="Avg rating" value={m.reviewCount ? m.avgRating.toFixed(1) : '—'} sub={`${m.reviewCount} review${m.reviewCount === 1 ? '' : 's'}`} />
          <Kpi icon={<User className="w-4 h-4" />} label="Followers" value={String(m.followersTotal)} sub={m.followersNew30 > 0 ? `+${m.followersNew30} this month` : 'All time'} spark={charts.followerSeries.map(p => p.value)} sparkColor={CHART.chestnut} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-charcoal/60 text-xs font-bold uppercase tracking-[0.2em]">Trends</p>
          <RangeTabs value={range} onChange={setRange} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Earnings over time" subtitle={`${money(charts.earnSeries.reduce((s, p) => s + p.value, 0))} in range`}>
            <BarChart data={charts.earnSeries} color={CHART.chestnut} format={moneyAxis} valueFormat={money} />
          </Card>
          <Card title="Profile views" subtitle="Unique viewers per period">
            <AreaChart data={charts.viewsSeries} color={CHART.teal} />
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Follower growth" subtitle={`${m.followersTotal} total followers`}>
            <AreaChart data={charts.followerSeries} color={CHART.chestnut} showDots={false} />
          </Card>
          <Card title="Booking breakdown" subtitle={`${m.totalApps} applications & invites`}>
            {m.totalApps === 0 ? <EmptyCard label="No bookings yet" /> : <Donut slices={statusSlices} centerTop={`${Math.round(m.confRate)}%`} centerBottom="confirmed rate" />}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Rating distribution" subtitle={m.reviewCount ? `${m.avgRating.toFixed(1)} average` : undefined}>
            {m.reviewCount === 0 ? <EmptyCard label="No reviews yet" /> : <HBars rows={ratingRows} color={CHART.chestnut} />}
          </Card>
          <Card title="Performance by aspect" subtitle="How venues rate you (out of 5)">
            {aspectAxes.length === 0 ? <EmptyCard label="No aspect ratings yet" /> : aspectAxes.length < 3 ? <HBars rows={aspectAxes.map(a => ({ label: a.label, value: a.value, max: 5, display: a.value.toFixed(1) }))} color={CHART.teal} /> : <Radar axes={aspectAxes} color={CHART.chestnut} />}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Top venues" subtitle="Where you play most">
            {m.topVenues.length === 0 ? <EmptyCard label="No confirmed gigs yet" /> : <HBars rows={m.topVenues.map(v => ({ label: v.name, value: v.gigs, display: `${v.gigs}` }))} color={CHART.teal} />}
          </Card>
          <Card title="What venues say" subtitle="Most-mentioned highlights">
            {tags.length === 0 ? <EmptyCard label="No review tags yet" /> : (
              <div className="flex flex-wrap gap-2 pt-1">
                {tags.map(t => (
                  <span key={t.tag} className="inline-flex items-center gap-1.5 bg-chestnut/10 text-chestnut text-sm font-bold px-3 py-1.5 rounded-full">
                    {t.tag}<span className="bg-chestnut/20 rounded-full px-1.5 text-xs">{t.count}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </div>

        <InsightsCard insights={insights} />
      </main>
    </div>
  )
}
