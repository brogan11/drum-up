'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AreaChart, CHART } from '@/components/Charts'

// ---- Types ----

interface Win { d7: number; p7: number; d30: number; p30: number }
interface Pulse {
  signups: Win; bookings: Win; gmv: Win; revenue: Win
  seriesBookings: { label: string; value: number }[]
  seriesGmv: { label: string; value: number }[]
}
interface Money {
  gmvRealized: number; revenueRealized: number; stripeFeesRealized: number; netRevenue: number
  takeRatePct: number; netTakeRatePct: number; avgBookingValue: number
  pendingPayoutGross: number; pendingPayoutCount: number; pendingRevenue: number
}
interface Attention { unonboardedWithGigs: number; overduePayouts: number; openReports: number }

interface Stats {
  totalUsers: number
  usersByType: Record<string, number>
  totalBookings: number
  bookingsByStatus: Record<string, number>
  totalRevenue: number
  openReports: number
  money: Money
  pulse: Pulse
  attention: Attention
}

interface AdminUser {
  id: string
  username: string
  full_name: string
  user_type: string
  created_at: string
  is_banned: boolean
}

interface AdminBooking {
  id: string
  pay_amount: number
  platform_fee: number
  status: string
  payment_status: string | null
  payout_released: boolean
  created_at: string
  restaurant_username: string
  restaurant_name: string
  musician_username: string
  musician_name: string
}

interface AdminReport {
  id: string
  reason: string
  details: string | null
  created_at: string
  resolved: boolean
  conversation_id: string | null
  reporter_username: string
  reporter_name: string
  reported_username: string
  reported_name: string
}

interface AttentionData {
  unonboarded: { musician_id: string; name: string; username: string; confirmedGigs: number }[]
  overdue: { bookingId: string; musician_name: string; restaurant_name: string; gigDate: string; pay_amount: number }[]
}

interface UserDetail {
  profile: {
    id: string; username: string | null; full_name: string | null; user_type: string
    created_at: string; is_banned: boolean; location_text: string | null; bio: string | null
    stripe_onboarded: boolean | null
    platform_fee_pct: number | null; fee_waiver_until: string | null
  }
  stats: { ltv: number; paidGigs: number; totalBookings: number; reviewsReceived: number; avgRating: number | null; reportsAgainst: number }
  bookings: {
    id: string; role: string; counterpart: string; counterpart_username: string
    pay_amount: number; status: string; payment_status: string | null; gig_date: string | null; created_at: string
  }[]
}

interface Insights {
  health: {
    fillRate: number; filledSlots: number; openSlots: number; cancelledSlots: number; openFutureGigs: number
    appConversion: number; applications: number; appConfirmed: number; avgTimeToFillDays: number | null
    repeatVenuePct: number; repeatMusicianPct: number; activeVenues: number; activeMusicians: number
  }
  referrals: {
    total: number; accepted: number; pending: number; conversion: number
    topInviters: { name: string; username: string; total: number; accepted: number }[]
  }
  markets: { location: string; users: number }[]
}

interface AdminReview {
  id: string; rating: number; review_text: string | null; verified: boolean; created_at: string
  reviewer_name: string; reviewer_username: string; reviewee_name: string; reviewee_username: string
}

interface ConvoMessage { id: string; content: string; created_at: string; sender_name: string; sender_username: string }

// ---- Helpers ----

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0)
const fmtCompact = (n: number) =>
  n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n)
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const fmtDay = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : '—')
const timeAgo = (iso: string) => {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Small components ----

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-charcoal mb-1">{label}</p>
      <p className={`text-3xl font-black leading-none ${accent ?? 'text-graphite'}`}>{value}</p>
      {sub && <p className="text-xs text-charcoal mt-1">{sub}</p>}
    </div>
  )
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0 && cur === 0) return <span className="text-charcoal/40 text-xs font-semibold">no change</span>
  const d = prev === 0 ? 100 : ((cur - prev) / prev) * 100
  const up = d >= 0
  return (
    <span className={`text-xs font-bold ${up ? 'text-teal' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(Math.round(d))}%
    </span>
  )
}

function KpiCard({ label, value, cur, prev }: { label: string; value: string; cur: number; prev: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-charcoal mb-1">{label}</p>
      <p className="text-3xl font-black text-graphite leading-none mb-1.5">{value}</p>
      <div className="flex items-center gap-1.5">
        <Delta cur={cur} prev={prev} />
        <span className="text-[11px] text-charcoal">vs prior 30d</span>
      </div>
    </div>
  )
}

function Badge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    confirmed: 'bg-teal/15 text-teal',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-600',
    captured: 'bg-teal/15 text-teal',
    paid: 'bg-teal/15 text-teal',
    authorized: 'bg-blue-100 text-blue-700',
    refunded: 'bg-purple-100 text-purple-700',
    failed: 'bg-red-100 text-red-600',
    open: 'bg-blue-100 text-blue-700',
    restaurant: 'bg-chestnut/10 text-chestnut',
    musician: 'bg-teal/15 text-teal',
    fan: 'bg-purple-100 text-purple-700',
  }
  const cls = colors[value] ?? 'bg-charcoal/10 text-charcoal'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{capitalize(value)}</span>
}

// ---- Main ----

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'growth' | 'attention' | 'users' | 'bookings' | 'reviews' | 'reports'>('overview')

  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])
  const [attention, setAttention] = useState<AttentionData | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [adminReviews, setAdminReviews] = useState<AdminReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewActingId, setReviewActingId] = useState<string | null>(null)
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [convo, setConvo] = useState<{ id: string; messages: ConvoMessage[] | null } | null>(null)
  const [globalQuery, setGlobalQuery] = useState('')

  const [statsLoading, setStatsLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [attentionLoading, setAttentionLoading] = useState(false)

  const [userSearch, setUserSearch] = useState('')
  const [bookingStatusFilter, setBookingStatusFilter] = useState('all')
  const [bookingSearch, setBookingSearch] = useState('')
  const [banningId, setBanningId] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [chartMetric, setChartMetric] = useState<'bookings' | 'gmv'>('bookings')

  const [drawerUserId, setDrawerUserId] = useState<string | null>(null)
  const [drawerData, setDrawerData] = useState<UserDetail | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [feePctInput, setFeePctInput] = useState('')
  const [feeUntilInput, setFeeUntilInput] = useState('')
  const [savingFee, setSavingFee] = useState(false)

  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null)
  const showFlash = (msg: string, ok = true) => {
    setFlash({ msg, ok })
    setTimeout(() => setFlash(null), 3500)
  }

  // ---- Data fetching ----
  const loadStats = useCallback(() => {
    setStatsLoading(true)
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {}).finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const loadUsers = useCallback((force = false) => {
    if (users.length > 0 && !force) return
    setUsersLoading(true)
    fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? [])).catch(() => {}).finally(() => setUsersLoading(false))
  }, [users.length])

  const loadBookings = useCallback((force = false) => {
    if (bookings.length > 0 && !force) return
    setBookingsLoading(true)
    fetch('/api/admin/bookings').then(r => r.json()).then(d => setBookings(d.bookings ?? [])).catch(() => {}).finally(() => setBookingsLoading(false))
  }, [bookings.length])

  const loadReports = useCallback(() => {
    if (reports.length > 0) return
    setReportsLoading(true)
    fetch('/api/admin/reports').then(r => r.json()).then(d => setReports(d.reports ?? [])).catch(() => {}).finally(() => setReportsLoading(false))
  }, [reports.length])

  const loadAttention = useCallback(() => {
    setAttentionLoading(true)
    fetch('/api/admin/attention').then(r => r.json()).then(setAttention).catch(() => {}).finally(() => setAttentionLoading(false))
  }, [])

  const loadInsights = useCallback(() => {
    if (insights) return
    setInsightsLoading(true)
    fetch('/api/admin/insights').then(r => r.json()).then(setInsights).catch(() => {}).finally(() => setInsightsLoading(false))
  }, [insights])

  const loadReviews = useCallback(() => {
    if (adminReviews.length > 0) return
    setReviewsLoading(true)
    fetch('/api/admin/reviews').then(r => r.json()).then(d => setAdminReviews(d.reviews ?? [])).catch(() => {}).finally(() => setReviewsLoading(false))
  }, [adminReviews.length])

  // For the overview activity feed, pull the (cached) users + bookings on mount.
  useEffect(() => { loadUsers(); loadBookings() }, [loadUsers, loadBookings])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'bookings') loadBookings()
    if (tab === 'reports') loadReports()
    if (tab === 'attention') loadAttention()
    if (tab === 'growth') loadInsights()
    if (tab === 'reviews') loadReviews()
  }, [tab, loadUsers, loadBookings, loadReports, loadAttention, loadInsights, loadReviews])

  // ---- Actions ----
  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const handleBan = async (userId: string, ban: boolean) => {
    setBanningId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ban }),
      })
      if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: ban } : u))
    } finally { setBanningId(null) }
  }

  const handleResolve = async (reportId: string) => {
    setResolvingId(reportId)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (res.ok) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, resolved: true } : r))
        setStats(prev => prev ? { ...prev, openReports: Math.max(0, prev.openReports - 1) } : prev)
      }
    } finally { setResolvingId(null) }
  }

  const handleBookingAction = async (bookingId: string, action: 'refund' | 'release_payout' | 'cancel_hold') => {
    const labels = { refund: 'Refund this paid booking (reverses the payout)?', release_payout: 'Capture & release this payout now?', cancel_hold: 'Cancel this authorization hold (no charge)?' }
    if (!window.confirm(labels[action])) return
    setActingId(bookingId)
    try {
      const res = await fetch('/api/admin/booking-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Action failed')
      showFlash(action === 'refund' ? 'Refunded.' : action === 'release_payout' ? 'Payout released.' : 'Hold cancelled.')
      loadBookings(true); loadStats(); if (attention) loadAttention()
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Action failed', false)
    } finally { setActingId(null) }
  }

  const openDrawer = async (userId: string) => {
    setDrawerUserId(userId); setDrawerData(null); setDrawerLoading(true)
    try {
      const d = await fetch(`/api/admin/user-detail?id=${userId}`).then(r => r.json()) as UserDetail
      setDrawerData(d)
      setFeePctInput(d.profile?.platform_fee_pct != null ? String(d.profile.platform_fee_pct) : '')
      setFeeUntilInput(d.profile?.fee_waiver_until ? d.profile.fee_waiver_until.slice(0, 10) : '')
    } finally { setDrawerLoading(false) }
  }

  const handleSetFee = async (reset: boolean) => {
    if (!drawerData) return
    setSavingFee(true)
    try {
      const pct = reset ? null : (feePctInput.trim() === '' ? null : Number(feePctInput))
      const waiverUntil = reset ? null : (feeUntilInput ? new Date(feeUntilInput + 'T23:59:59').toISOString() : null)
      const res = await fetch('/api/admin/user-fee', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: drawerData.profile.id, pct, waiverUntil }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed')
      setDrawerData(d => d ? { ...d, profile: { ...d.profile, platform_fee_pct: pct, fee_waiver_until: waiverUntil } } : d)
      if (reset) { setFeePctInput(''); setFeeUntilInput('') }
      showFlash(reset ? 'Fee reset to default.' : 'Fee override saved.')
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed to save fee', false)
    } finally { setSavingFee(false) }
  }

  const handleReviewAction = async (reviewId: string, action: 'remove' | 'verify' | 'unverify') => {
    if (action === 'remove' && !window.confirm('Permanently delete this review?')) return
    setReviewActingId(reviewId)
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, action }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Failed')
      if (action === 'remove') setAdminReviews(prev => prev.filter(r => r.id !== reviewId))
      else setAdminReviews(prev => prev.map(r => r.id === reviewId ? { ...r, verified: action === 'verify' } : r))
      showFlash(action === 'remove' ? 'Review removed.' : action === 'verify' ? 'Marked verified.' : 'Unverified.')
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Failed', false)
    } finally { setReviewActingId(null) }
  }

  const handleRunJob = async (job: 'payouts' | 'reminders') => {
    if (!window.confirm(job === 'payouts' ? 'Run the payout-release job now?' : 'Send gig reminders now?')) return
    setRunningJob(job)
    try {
      const res = await fetch('/api/admin/run-job', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job }),
      })
      const data = await res.json() as { success?: boolean; result?: Record<string, unknown>; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Job failed')
      const r = data.result ?? {}
      showFlash(job === 'payouts' ? `Released ${r.released ?? 0} payout(s).` : `Sent ${r.sent ?? 0} reminder(s).`)
      if (job === 'payouts') { loadStats(); loadBookings(true) }
    } catch (e) {
      showFlash(e instanceof Error ? e.message : 'Job failed', false)
    } finally { setRunningJob(null) }
  }

  const openConversation = async (conversationId: string) => {
    setConvo({ id: conversationId, messages: null })
    try {
      const d = await fetch(`/api/admin/conversation?id=${conversationId}`).then(r => r.json())
      setConvo({ id: conversationId, messages: d.messages ?? [] })
    } catch {
      setConvo({ id: conversationId, messages: [] })
    }
  }

  // ---- Derived ----
  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return !q || u.username?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q) || u.user_type?.toLowerCase().includes(q)
  })

  const filteredBookings = bookings.filter(b => {
    if (bookingStatusFilter !== 'all' && b.status !== bookingStatusFilter) return false
    const q = bookingSearch.toLowerCase()
    return !q || b.restaurant_name?.toLowerCase().includes(q) || b.musician_name?.toLowerCase().includes(q)
      || b.restaurant_username?.toLowerCase().includes(q) || b.musician_username?.toLowerCase().includes(q)
  })

  const attentionTotal = stats ? stats.attention.unonboardedWithGigs + stats.attention.overduePayouts + stats.attention.openReports : 0

  const gq = globalQuery.trim().toLowerCase()
  const globalResults = gq.length >= 2 ? {
    users: users.filter(u => u.full_name?.toLowerCase().includes(gq) || u.username?.toLowerCase().includes(gq)).slice(0, 5),
    bookings: bookings.filter(b => b.musician_name?.toLowerCase().includes(gq) || b.restaurant_name?.toLowerCase().includes(gq)
      || b.musician_username?.toLowerCase().includes(gq) || b.restaurant_username?.toLowerCase().includes(gq)).slice(0, 5),
  } : null

  type Activity = { id: string; kind: 'signup' | 'booking' | 'cancel'; text: string; sub: string; at: string }
  const activity: Activity[] = [
    ...users.slice(0, 12).map<Activity>(u => ({
      id: 'u' + u.id, kind: 'signup', text: `${u.full_name || '@' + u.username} joined`, sub: capitalize(u.user_type), at: u.created_at,
    })),
    ...bookings.slice(0, 12).map<Activity>(b => ({
      id: 'b' + b.id,
      kind: b.status === 'cancelled' ? 'cancel' : 'booking',
      text: `${b.musician_name} ${b.status === 'cancelled' ? 'cancelled with' : '↔'} ${b.restaurant_name}`,
      sub: `${capitalize(b.status)}${b.pay_amount ? ' · ' + fmt(b.pay_amount) : ''}`,
      at: b.created_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10)

  const TabBtn = ({ id, label, badge }: { id: typeof tab; label: string; badge?: number }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
        tab === id ? 'bg-chestnut text-white shadow-sm' : 'text-charcoal hover:bg-charcoal/10'
      }`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-white/25 text-white' : 'bg-red-100 text-red-600'}`}>{badge}</span>
      )}
    </button>
  )

  const m = stats?.money
  const p = stats?.pulse

  // ---- Render ----
  return (
    <div className="min-h-screen" style={{ background: '#FCFAF9' }}>

      {/* Flash */}
      {flash && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${flash.ok ? 'bg-teal text-white' : 'bg-red-500 text-white'}`}>
          {flash.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-graphite shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            <span className="text-snow font-black text-lg tracking-tight">Drum Up</span>
            <span className="text-chestnut text-xs font-semibold uppercase tracking-widest ml-1">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Global search */}
            <div className="relative hidden sm:block">
              <input
                value={globalQuery}
                onChange={e => setGlobalQuery(e.target.value)}
                placeholder="Search users or bookings…"
                className="w-56 px-3 py-1.5 rounded-lg bg-white/10 text-snow placeholder-snow/40 text-sm focus:outline-none focus:bg-white/15"
              />
              {globalResults && (globalResults.users.length > 0 || globalResults.bookings.length > 0) && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
                  {globalResults.users.map(u => (
                    <button key={'gu' + u.id} onClick={() => { openDrawer(u.id); setGlobalQuery('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-snow/60 border-b border-charcoal/5">
                      <p className="text-sm font-semibold text-graphite">{u.full_name || '@' + u.username}</p>
                      <p className="text-xs text-charcoal">User · {capitalize(u.user_type)}</p>
                    </button>
                  ))}
                  {globalResults.bookings.map(b => (
                    <button key={'gb' + b.id} onClick={() => { setTab('bookings'); setBookingSearch(b.musician_name || b.restaurant_name); setGlobalQuery('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-snow/60 border-b border-charcoal/5">
                      <p className="text-sm font-semibold text-graphite truncate">{b.musician_name} ↔ {b.restaurant_name}</p>
                      <p className="text-xs text-charcoal">Booking · {capitalize(b.status)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleLogout} className="text-snow/70 hover:text-snow text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Pulse KPI cards (30d with deltas) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {statsLoading || !p ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
                <div className="h-3 w-24 bg-charcoal/10 rounded mb-3" />
                <div className="h-8 w-16 bg-charcoal/10 rounded" />
              </div>
            ))
          ) : (
            <>
              <KpiCard label="New Signups · 30d" value={p.signups.d30.toLocaleString()} cur={p.signups.d30} prev={p.signups.p30} />
              <KpiCard label="New Bookings · 30d" value={p.bookings.d30.toLocaleString()} cur={p.bookings.d30} prev={p.bookings.p30} />
              <KpiCard label="Booked GMV · 30d" value={fmtCompact(p.gmv.d30)} cur={p.gmv.d30} prev={p.gmv.p30} />
              <KpiCard label="Platform Revenue · 30d" value={fmtCompact(p.revenue.d30)} cur={p.revenue.d30} prev={p.revenue.p30} />
            </>
          )}
        </div>

        {/* Money snapshot cards (all-time realized + pending) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statsLoading || !m ? null : (
            <>
              <StatCard label="Gross Fees" value={fmt(m.revenueRealized)} sub={`${m.takeRatePct.toFixed(1)}% take · before Stripe`} />
              <StatCard label="Net Profit (after Stripe)" value={fmt(m.netRevenue)} sub={`−${fmt(m.stripeFeesRealized)} Stripe · ${m.netTakeRatePct.toFixed(1)}% net`} accent="text-teal" />
              <StatCard label="GMV (realized)" value={fmt(m.gmvRealized)} sub={`Avg ${fmt(m.avgBookingValue)} / gig`} />
              <StatCard label="Pending Payouts" value={fmt(m.pendingPayoutGross)} sub={`${m.pendingPayoutCount} held · ${fmt(m.pendingRevenue)} future fees`} accent="text-chestnut" />
            </>
          )}
        </div>

        {/* Attention banner */}
        {stats && attentionTotal > 0 && tab !== 'attention' && (
          <button
            onClick={() => setTab('attention')}
            className="w-full mb-6 text-left bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-center justify-between hover:bg-red-100/70 transition-colors"
          >
            <div>
              <p className="text-red-700 font-bold text-sm">{attentionTotal} item{attentionTotal === 1 ? '' : 's'} need attention</p>
              <p className="text-red-600/80 text-xs mt-0.5">
                {stats.attention.overduePayouts > 0 && `${stats.attention.overduePayouts} overdue payout(s) · `}
                {stats.attention.unonboardedWithGigs > 0 && `${stats.attention.unonboardedWithGigs} unpaid-ready musician(s) · `}
                {stats.attention.openReports > 0 && `${stats.attention.openReports} open report(s)`}
              </p>
            </div>
            <span className="text-red-600 font-bold text-sm">Review →</span>
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabBtn id="overview" label="Overview" />
          <TabBtn id="growth" label="Growth" />
          <TabBtn id="attention" label="Attention" badge={stats?.attention ? attentionTotal : 0} />
          <TabBtn id="users" label="Users" />
          <TabBtn id="bookings" label="Bookings" />
          <TabBtn id="reviews" label="Reviews" />
          <TabBtn id="reports" label="Reports" badge={stats?.openReports} />
        </div>

        {/* ---- OVERVIEW ---- */}
        {tab === 'overview' && stats && p && (
          <div className="space-y-6">

            {/* Growth chart */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-black text-graphite uppercase tracking-widest">Last 30 Days</h2>
                <div className="flex gap-1 bg-snow rounded-lg p-1">
                  {(['bookings', 'gmv'] as const).map(mk => (
                    <button key={mk} onClick={() => setChartMetric(mk)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${chartMetric === mk ? 'bg-chestnut text-white' : 'text-charcoal hover:bg-charcoal/10'}`}>
                      {mk === 'bookings' ? 'Bookings' : 'Booked GMV'}
                    </button>
                  ))}
                </div>
              </div>
              <AreaChart
                data={chartMetric === 'bookings' ? p.seriesBookings : p.seriesGmv}
                color={chartMetric === 'bookings' ? CHART.teal : CHART.chestnut}
                valueFormat={chartMetric === 'gmv' ? (n) => fmt(n) : undefined}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Users by type */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Users by Type</h2>
                <div className="space-y-3">
                  {[
                    { label: 'Restaurants / Venues', key: 'restaurant', color: 'bg-chestnut' },
                    { label: 'Musicians', key: 'musician', color: 'bg-teal' },
                    { label: 'Fans', key: 'fan', color: 'bg-purple-400' },
                  ].map(({ label, key, color }) => {
                    const count = stats.usersByType[key] ?? 0
                    const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-charcoal">{label}</span>
                          <span className="font-bold text-graphite">{count.toLocaleString()} <span className="text-charcoal font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-charcoal/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bookings by status */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Bookings by Status</h2>
                <div className="space-y-3">
                  {['confirmed', 'pending', 'cancelled'].map(status => {
                    const count = stats.bookingsByStatus[status] ?? 0
                    const pct = stats.totalBookings > 0 ? Math.round((count / stats.totalBookings) * 100) : 0
                    const barColor = status === 'confirmed' ? 'bg-teal' : status === 'pending' ? 'bg-yellow-400' : 'bg-red-400'
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-charcoal capitalize">{status}</span>
                          <span className="font-bold text-graphite">{count.toLocaleString()} <span className="text-charcoal font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-charcoal/10 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Activity feed */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Recent Activity</h2>
              {activity.length === 0 ? (
                <p className="text-charcoal text-sm">No activity yet.</p>
              ) : (
                <div className="space-y-1">
                  {activity.map(a => (
                    <div key={a.id} className="flex items-center gap-3 py-2 border-b border-charcoal/5 last:border-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${a.kind === 'signup' ? 'bg-purple-400' : a.kind === 'cancel' ? 'bg-red-400' : 'bg-teal'}`} />
                      <p className="text-sm text-graphite flex-1 truncate">{a.text}</p>
                      <span className="text-xs text-charcoal shrink-0">{a.sub}</span>
                      <span className="text-xs text-charcoal/50 shrink-0 w-16 text-right">{timeAgo(a.at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Operator tools */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-1">Operator Tools</h2>
              <p className="text-xs text-charcoal mb-4">Manually run a scheduled job — handy if the daily cron failed.</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => handleRunJob('payouts')} disabled={runningJob === 'payouts'}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-teal text-white hover:opacity-90 disabled:opacity-50">
                  {runningJob === 'payouts' ? 'Releasing…' : '💸 Release payouts now'}
                </button>
                <button onClick={() => handleRunJob('reminders')} disabled={runningJob === 'reminders'}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-chestnut text-white hover:opacity-90 disabled:opacity-50">
                  {runningJob === 'reminders' ? 'Sending…' : '🔔 Send gig reminders now'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ---- GROWTH ---- */}
        {tab === 'growth' && (
          <div className="space-y-6">
            {insightsLoading || !insights ? (
              <div className="bg-white rounded-2xl shadow-sm px-6 py-12 text-center text-charcoal text-sm">Loading insights…</div>
            ) : (
              <>
                {/* Marketplace health */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Fill Rate" value={`${insights.health.fillRate.toFixed(0)}%`} sub={`${insights.health.filledSlots} filled · ${insights.health.openSlots} open`} accent="text-teal" />
                  <StatCard label="Application → Confirm" value={`${insights.health.appConversion.toFixed(0)}%`} sub={`${insights.health.appConfirmed}/${insights.health.applications} applications`} />
                  <StatCard label="Avg Time to Fill" value={insights.health.avgTimeToFillDays != null ? `${insights.health.avgTimeToFillDays.toFixed(1)}d` : '—'} sub="Slot posted → booked" />
                  <StatCard label="Open Future Gigs" value={insights.health.openFutureGigs} sub="Unfilled upcoming slots" accent="text-chestnut" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Repeat Venues" value={`${insights.health.repeatVenuePct.toFixed(0)}%`} sub={`of ${insights.health.activeVenues} booking venues`} />
                  <StatCard label="Repeat Musicians" value={`${insights.health.repeatMusicianPct.toFixed(0)}%`} sub={`of ${insights.health.activeMusicians} booked musicians`} />
                  <StatCard label="Cancelled Slots" value={insights.health.cancelledSlots} sub="All-time" />
                  <StatCard label="Invite Conversion" value={`${insights.referrals.conversion.toFixed(0)}%`} sub={`${insights.referrals.accepted}/${insights.referrals.total} accepted`} accent="text-teal" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Referral funnel */}
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Referrals</h2>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div><p className="text-2xl font-black text-graphite">{insights.referrals.total}</p><p className="text-xs text-charcoal">Sent</p></div>
                      <div><p className="text-2xl font-black text-teal">{insights.referrals.accepted}</p><p className="text-xs text-charcoal">Accepted</p></div>
                      <div><p className="text-2xl font-black text-charcoal">{insights.referrals.pending}</p><p className="text-xs text-charcoal">Pending</p></div>
                    </div>
                    <p className="text-[11px] uppercase tracking-widest text-charcoal mb-2">Top inviters</p>
                    {insights.referrals.topInviters.length === 0 ? (
                      <p className="text-charcoal text-sm">No invites yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {insights.referrals.topInviters.map((t, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-graphite font-medium truncate">{t.name}</span>
                            <span className="text-charcoal">{t.accepted}/{t.total}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top markets */}
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Top Markets</h2>
                    {insights.markets.length === 0 ? (
                      <p className="text-charcoal text-sm">No location data yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {insights.markets.map((mk, i) => {
                          const max = insights.markets[0].users || 1
                          return (
                            <div key={i}>
                              <div className="flex justify-between text-sm mb-0.5">
                                <span className="font-medium text-charcoal truncate">{mk.location}</span>
                                <span className="font-bold text-graphite">{mk.users}</span>
                              </div>
                              <div className="h-1.5 bg-charcoal/10 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-chestnut" style={{ width: `${(mk.users / max) * 100}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ---- ATTENTION ---- */}
        {tab === 'attention' && (
          <div className="space-y-6">
            {attentionLoading ? (
              <div className="bg-white rounded-2xl shadow-sm px-6 py-12 text-center text-charcoal text-sm">Loading…</div>
            ) : (
              <>
                {/* Overdue payouts */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-charcoal/10">
                    <h2 className="text-sm font-black text-graphite uppercase tracking-widest">Overdue Payouts</h2>
                    <p className="text-xs text-charcoal mt-0.5">Gig ended but the payout was never captured — the cron may have failed. Release manually.</p>
                  </div>
                  {!attention?.overdue.length ? (
                    <div className="px-6 py-8 text-center text-teal text-sm font-semibold">✓ All payouts up to date</div>
                  ) : (
                    <div className="divide-y divide-charcoal/5">
                      {attention.overdue.map(o => (
                        <div key={o.bookingId} className="px-6 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-graphite truncate">{o.musician_name} @ {o.restaurant_name}</p>
                            <p className="text-xs text-charcoal">Gig {fmtDay(o.gigDate)} · {fmt(o.pay_amount)}</p>
                          </div>
                          <button
                            onClick={() => handleBookingAction(o.bookingId, 'release_payout')}
                            disabled={actingId === o.bookingId}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {actingId === o.bookingId ? '…' : 'Release payout'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unonboarded musicians */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-charcoal/10">
                    <h2 className="text-sm font-black text-graphite uppercase tracking-widest">Musicians Not Payout-Ready</h2>
                    <p className="text-xs text-charcoal mt-0.5">Have confirmed gigs but haven&apos;t finished Stripe onboarding — they can&apos;t be paid.</p>
                  </div>
                  {!attention?.unonboarded.length ? (
                    <div className="px-6 py-8 text-center text-teal text-sm font-semibold">✓ Everyone with a gig is payout-ready</div>
                  ) : (
                    <div className="divide-y divide-charcoal/5">
                      {attention.unonboarded.map(u => (
                        <div key={u.musician_id} className="px-6 py-3 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-graphite truncate">{u.name}</p>
                            <p className="text-xs text-charcoal">@{u.username} · {u.confirmedGigs} confirmed gig{u.confirmedGigs === 1 ? '' : 's'}</p>
                          </div>
                          <button onClick={() => openDrawer(u.musician_id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-charcoal/20">
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open reports shortcut */}
                <button onClick={() => setTab('reports')} className="w-full bg-white rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between hover:bg-snow/60 transition-colors">
                  <span className="text-sm font-black text-graphite uppercase tracking-widest">Open Reports</span>
                  <span className={`font-bold text-sm ${stats && stats.openReports > 0 ? 'text-red-500' : 'text-teal'}`}>
                    {stats?.openReports ?? 0} {stats && stats.openReports > 0 ? 'to review →' : 'all clear'}
                  </span>
                </button>
              </>
            )}
          </div>
        )}

        {/* ---- USERS ---- */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest">
                All Users {users.length > 0 && <span className="text-charcoal font-normal normal-case tracking-normal">({users.length.toLocaleString()})</span>}
              </h2>
              <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text" placeholder="Search name, username, type…" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  className="flex-1 sm:w-64 px-3 py-2 rounded-lg bg-snow text-sm text-graphite placeholder-charcoal/40 shadow-sm focus:shadow-md focus:outline-none transition-shadow"
                />
                <button onClick={() => downloadCsv('users.csv', filteredUsers as unknown as Record<string, unknown>[])} className="px-3 py-2 rounded-lg text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-charcoal/20 whitespace-nowrap">Export CSV</button>
              </div>
            </div>
            {usersLoading ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading users…</div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">{userSearch ? 'No users match your search.' : 'No users yet.'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-charcoal/10 bg-snow/60">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">User</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Joined</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Status</th>
                      <th className="text-right px-6 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5">
                    {filteredUsers.map(user => (
                      <tr key={user.id} className={`hover:bg-snow/40 transition-colors cursor-pointer ${user.is_banned ? 'opacity-60' : ''}`} onClick={() => openDrawer(user.id)}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-graphite">{user.full_name || '—'}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{user.username || 'no-username'}</p>
                        </td>
                        <td className="px-4 py-4"><Badge value={user.user_type} /></td>
                        <td className="px-4 py-4 text-charcoal">{fmtDate(user.created_at)}</td>
                        <td className="px-4 py-4">
                          {user.is_banned
                            ? <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Banned</span>
                            : <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded-full">Active</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleBan(user.id, !user.is_banned) }}
                            disabled={banningId === user.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity disabled:opacity-50 ${user.is_banned ? 'bg-teal/15 text-teal hover:bg-teal/25' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                          >
                            {banningId === user.id ? '…' : user.is_banned ? 'Unban' : 'Ban'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---- BOOKINGS ---- */}
        {tab === 'bookings' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest">
                Bookings {bookings.length > 0 && <span className="text-charcoal font-normal normal-case tracking-normal">({filteredBookings.length.toLocaleString()}/{bookings.length.toLocaleString()})</span>}
              </h2>
              <div className="sm:ml-auto flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <select value={bookingStatusFilter} onChange={e => setBookingStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-snow text-sm text-graphite shadow-sm focus:outline-none">
                  <option value="all">All statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <input type="text" placeholder="Search venue or musician…" value={bookingSearch} onChange={e => setBookingSearch(e.target.value)}
                  className="flex-1 sm:w-56 px-3 py-2 rounded-lg bg-snow text-sm text-graphite placeholder-charcoal/40 shadow-sm focus:shadow-md focus:outline-none transition-shadow" />
                <button onClick={() => downloadCsv('bookings.csv', filteredBookings as unknown as Record<string, unknown>[])} className="px-3 py-2 rounded-lg text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-charcoal/20 whitespace-nowrap">Export CSV</button>
              </div>
            </div>
            {bookingsLoading ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading bookings…</div>
            ) : filteredBookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">No bookings match.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-charcoal/10 bg-snow/60">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Restaurant</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Musician</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Pay</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Fee</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Payment</th>
                      <th className="text-right px-6 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5">
                    {filteredBookings.map(b => (
                      <tr key={b.id} className="hover:bg-snow/40 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-graphite truncate max-w-[140px]">{b.restaurant_name}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{b.restaurant_username}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-graphite truncate max-w-[120px]">{b.musician_name}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{b.musician_username}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-graphite">{b.pay_amount ? fmt(b.pay_amount) : '—'}</td>
                        <td className="px-4 py-4 text-charcoal">{b.platform_fee ? fmt(b.platform_fee) : '—'}</td>
                        <td className="px-4 py-4"><Badge value={b.status} /></td>
                        <td className="px-4 py-4">{b.payment_status ? <Badge value={b.payment_status} /> : <span className="text-charcoal text-xs">—</span>}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {b.payment_status === 'authorized' && (
                            <>
                              <button onClick={() => handleBookingAction(b.id, 'release_payout')} disabled={actingId === b.id} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-teal/15 text-teal hover:bg-teal/25 disabled:opacity-50 mr-1.5">Release</button>
                              <button onClick={() => handleBookingAction(b.id, 'cancel_hold')} disabled={actingId === b.id} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-charcoal/20 disabled:opacity-50">Void</button>
                            </>
                          )}
                          {b.payment_status === 'paid' && (
                            <button onClick={() => handleBookingAction(b.id, 'refund')} disabled={actingId === b.id} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50">Refund</button>
                          )}
                          {(b.payment_status === 'refunded' || b.payment_status === 'failed' || !b.payment_status) && (
                            <span className="text-charcoal/40 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---- REVIEWS ---- */}
        {tab === 'reviews' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest">
                Reviews {adminReviews.length > 0 && <span className="text-charcoal font-normal normal-case tracking-normal">({adminReviews.length})</span>}
              </h2>
              <p className="text-xs text-charcoal mt-0.5">Remove abusive reviews, or mark trustworthy ones as verified (shows a badge on profiles).</p>
            </div>
            {reviewsLoading ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading reviews…</div>
            ) : adminReviews.length === 0 ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">No reviews yet.</div>
            ) : (
              <div className="divide-y divide-charcoal/5">
                {adminReviews.map(r => (
                  <div key={r.id} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-chestnut font-bold text-sm">{'★'.repeat(r.rating)}<span className="text-charcoal/30">{'★'.repeat(5 - r.rating)}</span></span>
                        {r.verified && <span className="text-[10px] font-bold text-teal bg-teal/10 px-1.5 py-0.5 rounded-full">Verified</span>}
                        <span className="text-xs text-charcoal">{fmtDate(r.created_at)}</span>
                      </div>
                      <p className="text-sm text-graphite">{r.review_text || <span className="text-charcoal/50 italic">No written review</span>}</p>
                      <p className="text-xs text-charcoal mt-1">{r.reviewer_name} → {r.reviewee_name}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => handleReviewAction(r.id, r.verified ? 'unverify' : 'verify')} disabled={reviewActingId === r.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal/15 text-teal hover:bg-teal/25 disabled:opacity-50">
                        {r.verified ? 'Unverify' : 'Verify'}
                      </button>
                      <button onClick={() => handleReviewAction(r.id, 'remove')} disabled={reviewActingId === r.id}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---- REPORTS ---- */}
        {tab === 'reports' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest">
                All Reports {reports.length > 0 && <span className="text-charcoal font-normal normal-case tracking-normal">({reports.length.toLocaleString()})</span>}
              </h2>
            </div>
            {reportsLoading ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading reports…</div>
            ) : reports.length === 0 ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">No reports yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-charcoal/10 bg-snow/60">
                      <th className="text-left px-6 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Reporter</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Reported</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Reason</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Details</th>
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Date</th>
                      <th className="text-right px-6 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5">
                    {reports.map(report => (
                      <tr key={report.id} className={`hover:bg-snow/40 transition-colors ${report.resolved ? 'opacity-50' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-graphite">{report.reporter_name}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{report.reporter_username}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-graphite">{report.reported_name}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{report.reported_username}</p>
                        </td>
                        <td className="px-4 py-4"><span className="font-medium text-graphite capitalize">{report.reason}</span></td>
                        <td className="px-4 py-4 max-w-[200px]"><p className="text-charcoal text-xs truncate">{report.details || '—'}</p></td>
                        <td className="px-4 py-4 text-charcoal">{fmtDate(report.created_at)}</td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {report.conversation_id && (
                            <button onClick={() => openConversation(report.conversation_id!)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-charcoal/20 mr-1.5">
                              View thread
                            </button>
                          )}
                          {report.resolved ? (
                            <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded-full">Resolved</span>
                          ) : (
                            <button onClick={() => handleResolve(report.id)} disabled={resolvingId === report.id} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-chestnut/10 text-chestnut hover:bg-chestnut/20 transition-opacity disabled:opacity-50">
                              {resolvingId === report.id ? '…' : 'Resolve'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ---- CONVERSATION VIEWER ---- */}
      {convo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConvo(null)}>
          <div className="absolute inset-0 bg-graphite/50" />
          <div className="relative bg-snow w-full max-w-lg max-h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-graphite px-5 py-3 flex items-center justify-between">
              <span className="text-snow font-black text-sm">Reported conversation</span>
              <button onClick={() => setConvo(null)} className="text-snow/60 hover:text-snow text-xl leading-none">×</button>
            </div>
            <div className="p-5 overflow-y-auto space-y-3">
              {convo.messages === null ? (
                <p className="text-charcoal text-sm text-center py-8">Loading…</p>
              ) : convo.messages.length === 0 ? (
                <p className="text-charcoal text-sm text-center py-8">No messages in this conversation.</p>
              ) : (
                convo.messages.map(msg => (
                  <div key={msg.id} className="bg-white rounded-xl shadow-sm px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-graphite">{msg.sender_name} <span className="text-charcoal font-normal">@{msg.sender_username}</span></span>
                      <span className="text-[10px] text-charcoal/50">{new Date(msg.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-graphite whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- USER DETAIL DRAWER ---- */}
      {drawerUserId && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setDrawerUserId(null)}>
          <div className="absolute inset-0 bg-graphite/40" />
          <div className="relative bg-snow w-full max-w-md h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-graphite px-6 py-4 flex items-center justify-between">
              <span className="text-snow font-black">User detail</span>
              <button onClick={() => setDrawerUserId(null)} className="text-snow/60 hover:text-snow text-xl leading-none">×</button>
            </div>
            {drawerLoading || !drawerData ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading…</div>
            ) : (
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xl font-black text-graphite">{drawerData.profile.full_name || '—'}</p>
                  <p className="text-charcoal text-sm">@{drawerData.profile.username} · <Badge value={drawerData.profile.user_type} /></p>
                  <p className="text-charcoal text-xs mt-1">{drawerData.profile.location_text || 'No location'} · Joined {fmtDate(drawerData.profile.created_at)}</p>
                  {drawerData.profile.is_banned && <p className="text-red-500 text-xs font-bold mt-1">⛔ Banned</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl shadow-sm p-3">
                    <p className="text-[10px] uppercase tracking-widest text-charcoal">Lifetime GMV</p>
                    <p className="text-lg font-black text-graphite">{fmt(drawerData.stats.ltv)}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-3">
                    <p className="text-[10px] uppercase tracking-widest text-charcoal">Paid gigs</p>
                    <p className="text-lg font-black text-graphite">{drawerData.stats.paidGigs}</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-3">
                    <p className="text-[10px] uppercase tracking-widest text-charcoal">Avg rating</p>
                    <p className="text-lg font-black text-graphite">{drawerData.stats.avgRating != null ? drawerData.stats.avgRating.toFixed(1) + '★' : '—'} <span className="text-xs font-normal text-charcoal">({drawerData.stats.reviewsReceived})</span></p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm p-3">
                    <p className="text-[10px] uppercase tracking-widest text-charcoal">Reports against</p>
                    <p className={`text-lg font-black ${drawerData.stats.reportsAgainst > 0 ? 'text-red-500' : 'text-graphite'}`}>{drawerData.stats.reportsAgainst}</p>
                  </div>
                </div>
                {drawerData.profile.user_type === 'musician' && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${drawerData.profile.stripe_onboarded ? 'bg-teal/10 text-teal' : 'bg-red-50 text-red-600'}`}>
                    {drawerData.profile.stripe_onboarded ? '✓ Stripe payout ready' : '⚠ Stripe not onboarded — cannot be paid'}
                  </div>
                )}

                {/* Platform fee override */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <p className="text-xs font-black text-graphite uppercase tracking-widest mb-2">Platform Fee</p>
                  {(() => {
                    const pct = drawerData.profile.platform_fee_pct
                    const until = drawerData.profile.fee_waiver_until
                    const expired = until ? new Date(until).getTime() < Date.now() : false
                    const current = pct == null || expired
                      ? 'Default (8%)'
                      : `${pct}%${until ? ` until ${fmtDate(until)}` : ' (no expiry)'}`
                    return (
                      <p className={`text-sm font-semibold mb-3 ${pct != null && !expired ? 'text-chestnut' : 'text-charcoal'}`}>
                        Current: {current}{expired && pct != null ? ' — override expired' : ''}
                      </p>
                    )
                  })()}
                  <div className="flex items-end gap-2">
                    <div className="w-20">
                      <label className="text-[10px] uppercase tracking-widest text-charcoal">Fee %</label>
                      <input type="number" min={0} max={100} value={feePctInput} onChange={e => setFeePctInput(e.target.value)} placeholder="8"
                        className="w-full px-2 py-1.5 rounded-lg bg-snow text-sm text-graphite shadow-sm focus:outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] uppercase tracking-widest text-charcoal">Until (optional)</label>
                      <input type="date" value={feeUntilInput} onChange={e => setFeeUntilInput(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-snow text-sm text-graphite shadow-sm focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleSetFee(false)} disabled={savingFee} className="flex-1 py-2 rounded-lg text-xs font-bold bg-chestnut text-white hover:opacity-90 disabled:opacity-50">
                      {savingFee ? '…' : 'Save override'}
                    </button>
                    <button onClick={() => { setFeePctInput('0'); }} className="px-3 py-2 rounded-lg text-xs font-bold bg-teal/15 text-teal hover:bg-teal/25" title="Set to 0% then Save">
                      Waive (0%)
                    </button>
                    <button onClick={() => handleSetFee(true)} disabled={savingFee} className="px-3 py-2 rounded-lg text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-charcoal/20 disabled:opacity-50">
                      Reset
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-graphite uppercase tracking-widest mb-2">Bookings ({drawerData.bookings.length})</p>
                  <div className="space-y-2">
                    {drawerData.bookings.length === 0 && <p className="text-charcoal text-sm">None yet.</p>}
                    {drawerData.bookings.map(b => (
                      <div key={b.id} className="bg-white rounded-xl shadow-sm px-3 py-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-graphite truncate">{b.counterpart}</p>
                          <p className="text-xs text-charcoal">{b.gig_date ? fmtDay(b.gig_date) : fmtDate(b.created_at)} · {fmt(b.pay_amount)}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge value={b.status} />
                          {b.payment_status && <span className="text-[10px] text-charcoal">{b.payment_status}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => { handleBan(drawerData.profile.id, !drawerData.profile.is_banned); setDrawerData(d => d ? { ...d, profile: { ...d.profile, is_banned: !d.profile.is_banned } } : d) }}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold ${drawerData.profile.is_banned ? 'bg-teal/15 text-teal hover:bg-teal/25' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                >
                  {drawerData.profile.is_banned ? 'Unban user' : 'Ban user'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
