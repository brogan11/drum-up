'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ---- Types ----

interface Stats {
  totalUsers: number
  usersByType: Record<string, number>
  totalBookings: number
  bookingsByStatus: Record<string, number>
  totalRevenue: number
  openReports: number
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
  reporter_username: string
  reporter_name: string
  reported_username: string
  reported_name: string
}

// ---- Helpers ----

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : '—'
}

// ---- Stat Card ----

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-charcoal mb-1">{label}</p>
      <p className="text-3xl font-black text-graphite leading-none">{value}</p>
      {sub && <p className="text-xs text-charcoal mt-1">{sub}</p>}
    </div>
  )
}

// ---- Status Badge ----

function Badge({ value }: { value: string }) {
  const colors: Record<string, string> = {
    confirmed: 'bg-teal/15 text-teal',
    pending: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-600',
    captured: 'bg-teal/15 text-teal',
    paid: 'bg-teal/15 text-teal',
    failed: 'bg-red-100 text-red-600',
    open: 'bg-blue-100 text-blue-700',
    restaurant: 'bg-chestnut/10 text-chestnut',
    musician: 'bg-teal/15 text-teal',
    fan: 'bg-purple-100 text-purple-700',
  }
  const cls = colors[value] ?? 'bg-charcoal/10 text-charcoal'
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>
      {capitalize(value)}
    </span>
  )
}

// ---- Main Component ----

export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'overview' | 'users' | 'bookings' | 'reports'>('overview')

  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])

  const [statsLoading, setStatsLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [reportsLoading, setReportsLoading] = useState(false)

  const [userSearch, setUserSearch] = useState('')
  const [banningId, setBanningId] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // ---- Data fetching ----

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }, [])

  const loadUsers = useCallback(() => {
    if (users.length > 0) return
    setUsersLoading(true)
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
      .finally(() => setUsersLoading(false))
  }, [users.length])

  const loadBookings = useCallback(() => {
    if (bookings.length > 0) return
    setBookingsLoading(true)
    fetch('/api/admin/bookings')
      .then(r => r.json())
      .then(d => setBookings(d.bookings ?? []))
      .catch(() => {})
      .finally(() => setBookingsLoading(false))
  }, [bookings.length])

  const loadReports = useCallback(() => {
    if (reports.length > 0) return
    setReportsLoading(true)
    fetch('/api/admin/reports')
      .then(r => r.json())
      .then(d => setReports(d.reports ?? []))
      .catch(() => {})
      .finally(() => setReportsLoading(false))
  }, [reports.length])

  useEffect(() => {
    if (tab === 'users') loadUsers()
    if (tab === 'bookings') loadBookings()
    if (tab === 'reports') loadReports()
  }, [tab, loadUsers, loadBookings, loadReports])

  // ---- Actions ----

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const handleBan = async (userId: string, ban: boolean) => {
    setBanningId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ban }),
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: ban } : u))
      }
    } finally {
      setBanningId(null)
    }
  }

  const handleResolve = async (reportId: string) => {
    setResolvingId(reportId)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId }),
      })
      if (res.ok) {
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, resolved: true } : r))
        // Update open reports count
        setStats(prev => prev ? { ...prev, openReports: Math.max(0, prev.openReports - 1) } : prev)
      }
    } finally {
      setResolvingId(null)
    }
  }

  // ---- Filtered users ----

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase()
    return (
      !q ||
      u.username?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.user_type?.toLowerCase().includes(q)
    )
  })

  // ---- Tab button ----

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        tab === id
          ? 'bg-chestnut text-white shadow-sm'
          : 'text-charcoal hover:bg-charcoal/10'
      }`}
    >
      {label}
    </button>
  )

  // ---- Render ----

  return (
    <div className="min-h-screen" style={{ background: '#FCFAF9' }}>

      {/* Header */}
      <header className="bg-graphite shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            <span className="text-snow font-black text-lg tracking-tight">Drum Up</span>
            <span className="text-chestnut text-xs font-semibold uppercase tracking-widest ml-1">Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-snow/70 hover:text-snow text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
                <div className="h-3 w-24 bg-charcoal/10 rounded mb-3" />
                <div className="h-8 w-16 bg-charcoal/10 rounded" />
              </div>
            ))
          ) : stats ? (
            <>
              <StatCard
                label="Total Users"
                value={stats.totalUsers.toLocaleString()}
                sub={`${stats.usersByType.restaurant ?? 0} venues · ${stats.usersByType.musician ?? 0} musicians · ${stats.usersByType.fan ?? 0} fans`}
              />
              <StatCard
                label="Total Bookings"
                value={stats.totalBookings.toLocaleString()}
                sub={`${stats.bookingsByStatus.confirmed ?? 0} confirmed · ${stats.bookingsByStatus.pending ?? 0} pending`}
              />
              <StatCard
                label="Revenue Collected"
                value={fmt(stats.totalRevenue)}
                sub="Platform fees captured"
              />
              <StatCard
                label="Open Reports"
                value={stats.openReports}
                sub={stats.openReports === 0 ? 'All clear' : 'Needs review'}
              />
            </>
          ) : (
            <p className="col-span-4 text-charcoal text-sm">Failed to load stats.</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <TabBtn id="overview" label="Overview" />
          <TabBtn id="users" label="Users" />
          <TabBtn id="bookings" label="Bookings" />
          <TabBtn id="reports" label="Reports" />
        </div>

        {/* ---- OVERVIEW TAB ---- */}
        {tab === 'overview' && stats && (
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

            {/* Revenue summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Revenue Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-charcoal/10">
                  <span className="text-sm text-charcoal">Total platform fees collected</span>
                  <span className="font-bold text-graphite">{fmt(stats.totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-charcoal/10">
                  <span className="text-sm text-charcoal">Confirmed bookings</span>
                  <span className="font-bold text-graphite">{(stats.bookingsByStatus.confirmed ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-charcoal">Avg fee per confirmed booking</span>
                  <span className="font-bold text-graphite">
                    {stats.bookingsByStatus.confirmed
                      ? fmt(stats.totalRevenue / stats.bookingsByStatus.confirmed)
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Reports summary */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest mb-4">Reports Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-charcoal/10">
                  <span className="text-sm text-charcoal">Open reports</span>
                  <span className={`font-bold ${stats.openReports > 0 ? 'text-red-500' : 'text-teal'}`}>
                    {stats.openReports}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-charcoal">Status</span>
                  <span className={`text-sm font-semibold ${stats.openReports === 0 ? 'text-teal' : 'text-red-500'}`}>
                    {stats.openReports === 0 ? 'All clear' : `${stats.openReports} need attention`}
                  </span>
                </div>
                {stats.openReports > 0 && (
                  <button
                    onClick={() => setTab('reports')}
                    className="w-full mt-1 py-2 rounded-xl bg-chestnut text-white text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    Review Reports
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

        {tab === 'overview' && !stats && !statsLoading && (
          <p className="text-charcoal text-sm">Failed to load overview data.</p>
        )}

        {/* ---- USERS TAB ---- */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10 flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest">
                All Users {users.length > 0 && <span className="text-charcoal font-normal normal-case tracking-normal">({users.length.toLocaleString()})</span>}
              </h2>
              <input
                type="text"
                placeholder="Search by name, username, or type…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="sm:ml-auto w-full sm:w-72 px-3 py-2 rounded-lg bg-snow text-sm text-graphite placeholder-charcoal/40 shadow-sm focus:shadow-md focus:outline-none transition-shadow"
              />
            </div>

            {usersLoading ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading users…</div>
            ) : filteredUsers.length === 0 ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">
                {userSearch ? 'No users match your search.' : 'No users yet.'}
              </div>
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
                      <tr key={user.id} className={`hover:bg-snow/40 transition-colors ${user.is_banned ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-graphite">{user.full_name || '—'}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{user.username || 'no-username'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <Badge value={user.user_type} />
                        </td>
                        <td className="px-4 py-4 text-charcoal">{fmtDate(user.created_at)}</td>
                        <td className="px-4 py-4">
                          {user.is_banned
                            ? <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Banned</span>
                            : <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded-full">Active</span>
                          }
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleBan(user.id, !user.is_banned)}
                            disabled={banningId === user.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-opacity disabled:opacity-50 ${
                              user.is_banned
                                ? 'bg-teal/15 text-teal hover:bg-teal/25'
                                : 'bg-red-100 text-red-600 hover:bg-red-200'
                            }`}
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

        {/* ---- BOOKINGS TAB ---- */}
        {tab === 'bookings' && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10">
              <h2 className="text-sm font-black text-graphite uppercase tracking-widest">
                All Bookings {bookings.length > 0 && <span className="text-charcoal font-normal normal-case tracking-normal">({bookings.length.toLocaleString()})</span>}
              </h2>
            </div>

            {bookingsLoading ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">Loading bookings…</div>
            ) : bookings.length === 0 ? (
              <div className="px-6 py-12 text-center text-charcoal text-sm">No bookings yet.</div>
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
                      <th className="text-left px-4 py-3 text-[11px] font-semibold text-charcoal uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-charcoal/5">
                    {bookings.map(booking => (
                      <tr key={booking.id} className="hover:bg-snow/40 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-graphite truncate max-w-[140px]">{booking.restaurant_name}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{booking.restaurant_username}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-graphite truncate max-w-[120px]">{booking.musician_name}</p>
                          <p className="text-charcoal text-xs mt-0.5">@{booking.musician_username}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-graphite">{booking.pay_amount ? fmt(booking.pay_amount) : '—'}</td>
                        <td className="px-4 py-4 text-charcoal">{booking.platform_fee ? fmt(booking.platform_fee) : '—'}</td>
                        <td className="px-4 py-4"><Badge value={booking.status} /></td>
                        <td className="px-4 py-4">
                          {booking.payment_status
                            ? <Badge value={booking.payment_status} />
                            : <span className="text-charcoal text-xs">—</span>
                          }
                        </td>
                        <td className="px-4 py-4 text-charcoal">{fmtDate(booking.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---- REPORTS TAB ---- */}
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
                        <td className="px-4 py-4">
                          <span className="font-medium text-graphite capitalize">{report.reason}</span>
                        </td>
                        <td className="px-4 py-4 max-w-[200px]">
                          <p className="text-charcoal text-xs truncate">{report.details || '—'}</p>
                        </td>
                        <td className="px-4 py-4 text-charcoal">{fmtDate(report.created_at)}</td>
                        <td className="px-6 py-4 text-right">
                          {report.resolved ? (
                            <span className="text-xs font-semibold text-teal bg-teal/10 px-2 py-0.5 rounded-full">Resolved</span>
                          ) : (
                            <button
                              onClick={() => handleResolve(report.id)}
                              disabled={resolvingId === report.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-chestnut/10 text-chestnut hover:bg-chestnut/20 transition-opacity disabled:opacity-50"
                            >
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
    </div>
  )
}
