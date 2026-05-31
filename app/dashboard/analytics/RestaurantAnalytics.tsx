'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AreaChart, BarChart, Donut, HBars, Radar, CHART, type Slice, type HBarRow } from '@/components/Charts'
import { Kpi, Card, EmptyCard, RangeTabs, AnalyticsHeader, InsightsCard } from '@/components/AnalyticsUI'
import { ratingDistribution, aspectAverages, topTags } from '@/lib/reviews'
import { DollarSign, Hourglass, Calendar, Inbox, Eye, Star } from '@/components/Icons'
import { type Range, money, moneyAxis, pctDelta, DASH_BG, buildBuckets, series } from '@/lib/analytics'

// A restaurant is charged the full agreed slot pay (the 8% platform fee is taken from the
// musician's side — see app/api/stripe/payment-intent/route.ts), so a venue's outflow is
// the full pay_amount.
interface BookingRow {
  id: string
  availability_id: string | null
  musician_id: string | null
  status: string
  pay_amount: number | null
  payment_status: string | null
  created_at: string
}
interface SlotRow { id: string; date: string | null; status: string | null; created_at: string }
interface ReviewRow { rating: number; aspects: Record<string, number> | null; tags: string[] | null; created_at: string }

export default function RestaurantAnalytics() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('90d')
  const [name, setName] = useState('')

  const [views, setViews] = useState<Date[]>([])
  const [followers, setFollowers] = useState<Date[]>([])
  const [slots, setSlots] = useState<SlotRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [gigDates, setGigDates] = useState<Map<string, Date>>(new Map())
  const [talentNames, setTalentNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { router.push('/auth/login'); return }

        const { data: profile } = await supabase
          .from('profiles').select('id, full_name, role_metadata').eq('id', user.id).maybeSingle()
        const meta = (profile?.role_metadata ?? {}) as Record<string, unknown>
        setName((meta.venue_name as string) || profile?.full_name || 'Your venue')

        const uid = user.id
        const [vRes, fRes, sRes, bRes, rRes] = await Promise.all([
          supabase.from('profile_views').select('viewed_at').eq('profile_id', uid),
          supabase.from('follows').select('created_at').eq('following_id', uid),
          supabase.from('availability').select('id, date, status, created_at').eq('restaurant_id', uid),
          supabase.from('bookings')
            .select('id, availability_id, musician_id, status, pay_amount, payment_status, created_at')
            .eq('restaurant_id', uid),
          supabase.from('reviews').select('rating, aspects, tags, created_at').eq('reviewee_id', uid),
        ])

        setViews((vRes.data ?? []).map(r => new Date(r.viewed_at as string)))
        setFollowers((fRes.data ?? []).map(r => new Date(r.created_at as string)))
        const slotRows = (sRes.data ?? []) as SlotRow[]
        setSlots(slotRows)
        const bks = (bRes.data ?? []) as BookingRow[]
        setBookings(bks)
        setReviews((rRes.data ?? []) as ReviewRow[])

        const gd = new Map<string, Date>()
        for (const a of slotRows) if (a.date) gd.set(a.id, new Date(a.date + 'T00:00:00'))
        setGigDates(gd)

        const musIds = [...new Set(bks.map(b => b.musician_id).filter(Boolean))] as string[]
        if (musIds.length) {
          const { data: musProfiles } = await supabase.from('profiles').select('id, full_name, role_metadata').in('id', musIds)
          const tn = new Map<string, string>()
          for (const p of (musProfiles ?? []) as { id: string; full_name: string; role_metadata: Record<string, unknown> | null }[]) {
            const mt = (p.role_metadata ?? {}) as Record<string, unknown>
            tn.set(p.id, (mt.stage_name as string) || p.full_name || 'Musician')
          }
          setTalentNames(tn)
        }
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
    const spendPaid = paid.reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)
    const committed = confirmed.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)

    const gigsHosted = confirmed.filter(b => gigDateFor(b).getTime() < now).length
    const upcoming = confirmed.filter(b => gigDateFor(b).getTime() >= now).length

    const totalSlots = slots.length
    const filled = slots.filter(s => s.status === 'filled').length
    const open = slots.filter(s => s.status === 'open').length
    const cancelledSlots = slots.filter(s => s.status === 'cancelled').length
    const decided = filled + open
    const fillRate = decided > 0 ? (filled / decided) * 100 : 0

    const totalApps = bookings.length
    const cancelled = bookings.filter(b => b.status === 'cancelled').length
    const pendingCount = bookings.filter(b => b.status === 'pending').length
    const appsPerSlot = totalSlots > 0 ? totalApps / totalSlots : 0
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0

    const views30 = views.filter(d => d.getTime() >= d30).length
    const viewsPrev30 = views.filter(d => d.getTime() >= d60 && d.getTime() < d30).length
    const viewsDelta = pctDelta(views30, viewsPrev30)
    const followersNew30 = followers.filter(d => d.getTime() >= d30).length

    const spend30 = paid.filter(b => gigDateFor(b).getTime() >= d30).reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)
    const spendPrev30 = paid.filter(b => { const t = gigDateFor(b).getTime(); return t >= d60 && t < d30 }).reduce((s, b) => s + (Number(b.pay_amount) || 0), 0)
    const spendDelta = pctDelta(spend30, spendPrev30)

    const talentAgg = new Map<string, number>()
    for (const b of confirmed) {
      if (!b.musician_id) continue
      talentAgg.set(b.musician_id, (talentAgg.get(b.musician_id) ?? 0) + 1)
    }
    const topTalent = [...talentAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([id, gigs]) => ({ name: talentNames.get(id) ?? 'Musician', gigs }))

    return { spendPaid, committed, gigsHosted, upcoming, totalSlots, filled, open, cancelledSlots, fillRate, totalApps, cancelled, pendingCount, confirmedCount: confirmed.length, appsPerSlot, avgRating, reviewCount: reviews.length, views30, viewsDelta, followersTotal: followers.length, followersNew30, spendDelta, topTalent }
  }, [bookings, slots, reviews, views, followers, gigDates, talentNames])

  const charts = useMemo(() => {
    const allDates = [...views, ...followers, ...bookings.map(b => new Date(b.created_at)), ...slots.map(s => new Date(s.created_at))]
    const earliest = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
    const buckets = buildBuckets(range, earliest)
    const gigDateFor = (b: BookingRow) => (b.availability_id && gigDates.get(b.availability_id)) || new Date(b.created_at)
    const viewsSeries = series(views.map(d => ({ date: d, value: 1 })), buckets)
    const followerSeries = series(followers.map(d => ({ date: d, value: 1 })), buckets, true)
    const appsSeries = series(bookings.map(b => ({ date: new Date(b.created_at), value: 1 })), buckets)
    const spendItems = bookings.filter(b => b.payment_status === 'paid').map(b => ({ date: gigDateFor(b), value: Number(b.pay_amount) || 0 }))
    const spendSeries = series(spendItems, buckets)
    return { viewsSeries, followerSeries, appsSeries, spendSeries }
  }, [range, views, followers, bookings, slots, gigDates])

  const ratingRows: HBarRow[] = useMemo(() => {
    const dist = ratingDistribution(reviews)
    const max = Math.max(...dist.map(d => d.count), 1)
    return dist.map(d => ({ label: '★'.repeat(d.stars), value: d.count, max, display: String(d.count) }))
  }, [reviews])
  const aspectAxes = useMemo(() => aspectAverages(reviews, 'restaurant').map(a => ({ label: a.label, value: a.avg })), [reviews])
  const tags = useMemo(() => topTags(reviews, 8), [reviews])

  const slotSlices: Slice[] = [
    { label: 'Filled', value: m.filled, color: CHART.teal },
    { label: 'Open', value: m.open, color: CHART.chestnut },
    { label: 'Cancelled', value: m.cancelledSlots, color: CHART.charcoal },
  ]

  const insights = useMemo(() => {
    const out: string[] = []
    if (m.totalSlots > 0) {
      out.push(m.fillRate >= 50
        ? `You've filled ${Math.round(m.fillRate)}% of your live slots — strong demand for your dates.`
        : `Only ${Math.round(m.fillRate)}% of your live slots are filled. ${m.open} still open — adjusting pay or dates can attract more musicians.`)
    }
    if (m.appsPerSlot > 0) out.push(`Each slot you post attracts about ${m.appsPerSlot.toFixed(1)} application${m.appsPerSlot >= 2 ? 's' : ''} on average.`)
    if (m.viewsDelta != null && Math.abs(m.viewsDelta) >= 5)
      out.push(m.viewsDelta >= 0 ? `Profile views are up ${Math.round(m.viewsDelta)}% vs the previous 30 days.` : `Profile views are down ${Math.round(Math.abs(m.viewsDelta))}% vs the previous 30 days.`)
    if (aspectAxes.length) {
      const best = [...aspectAxes].sort((a, b) => b.value - a.value)[0]
      const worst = [...aspectAxes].sort((a, b) => a.value - b.value)[0]
      out.push(`Musicians rate your venue highest on ${best.label} (${best.value.toFixed(1)}/5).`)
      if (worst.value < 4 && worst.label !== best.label) out.push(`Your lowest-rated area is ${worst.label} (${worst.value.toFixed(1)}/5).`)
    }
    if (m.topTalent.length && m.topTalent[0].gigs > 1) out.push(`${m.topTalent[0].name} is your most-booked act with ${m.topTalent[0].gigs} gigs.`)
    if (m.committed > 0) out.push(`You have ${money(m.committed)} committed to upcoming or unpaid gigs.`)
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
          <Kpi icon={<DollarSign className="w-4 h-4" />} label="Talent spend" value={money(m.spendPaid)} sub="Paid out to musicians" delta={m.spendDelta} spark={charts.spendSeries.map(p => p.value)} sparkColor={CHART.chestnut} />
          <Kpi icon={<Hourglass className="w-4 h-4" />} label="Committed" value={money(m.committed)} sub={`${m.upcoming} upcoming gig${m.upcoming === 1 ? '' : 's'}`} accent={CHART.teal} />
          <Kpi icon={<Calendar className="w-4 h-4" />} label="Fill rate" value={m.totalSlots ? `${Math.round(m.fillRate)}%` : '—'} sub={`${m.filled} of ${m.filled + m.open} slots filled`} accent={CHART.teal} />
          <Kpi icon={<Inbox className="w-4 h-4" />} label="Applications" value={String(m.totalApps)} sub={m.totalSlots ? `${m.appsPerSlot.toFixed(1)} per slot` : 'Across all slots'} spark={charts.appsSeries.map(p => p.value)} sparkColor={CHART.teal} />
          <Kpi icon={<Eye className="w-4 h-4" />} label="Profile views" value={String(m.views30)} sub="Last 30 days" delta={m.viewsDelta} spark={charts.viewsSeries.map(p => p.value)} sparkColor={CHART.chestnut} />
          <Kpi icon={<Star className="w-4 h-4" />} label="Venue rating" value={m.reviewCount ? m.avgRating.toFixed(1) : '—'} sub={`${m.reviewCount} review${m.reviewCount === 1 ? '' : 's'}`} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-charcoal/60 text-xs font-bold uppercase tracking-[0.2em]">Trends</p>
          <RangeTabs value={range} onChange={setRange} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Talent spend over time" subtitle={`${money(charts.spendSeries.reduce((s, p) => s + p.value, 0))} in range`}>
            <BarChart data={charts.spendSeries} color={CHART.chestnut} format={moneyAxis} valueFormat={money} />
          </Card>
          <Card title="Applications received" subtitle="From musicians, per period">
            <AreaChart data={charts.appsSeries} color={CHART.teal} />
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Profile views" subtitle="Unique viewers per period">
            <AreaChart data={charts.viewsSeries} color={CHART.chestnut} />
          </Card>
          <Card title="Follower growth" subtitle={`${m.followersTotal} total followers`}>
            <AreaChart data={charts.followerSeries} color={CHART.teal} showDots={false} />
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Slot status" subtitle={`${m.totalSlots} slots posted`}>
            {m.totalSlots === 0 ? <EmptyCard label="No slots posted yet" /> : <Donut slices={slotSlices} centerTop={`${Math.round(m.fillRate)}%`} centerBottom="fill rate" />}
          </Card>
          <Card title="How musicians rate you" subtitle="Venue score by aspect (out of 5)">
            {aspectAxes.length === 0 ? <EmptyCard label="No aspect ratings yet" /> : aspectAxes.length < 3 ? <HBars rows={aspectAxes.map(a => ({ label: a.label, value: a.value, max: 5, display: a.value.toFixed(1) }))} color={CHART.teal} /> : <Radar axes={aspectAxes} color={CHART.chestnut} />}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          <Card title="Rating distribution" subtitle={m.reviewCount ? `${m.avgRating.toFixed(1)} average` : undefined}>
            {m.reviewCount === 0 ? <EmptyCard label="No reviews yet" /> : <HBars rows={ratingRows} color={CHART.chestnut} />}
          </Card>
          <Card title="Top talent" subtitle="Acts you book most">
            {m.topTalent.length === 0 ? <EmptyCard label="No confirmed gigs yet" /> : <HBars rows={m.topTalent.map(t => ({ label: t.name, value: t.gigs, display: `${t.gigs}` }))} color={CHART.teal} />}
          </Card>
        </div>

        <div className="mb-4">
          <Card title="What musicians say" subtitle="Most-mentioned highlights from reviews">
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
