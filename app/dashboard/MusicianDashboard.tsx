'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'
import MessagingTab, { MessagingTabRef } from '@/components/MessagingTab'
import { useToast } from '@/components/Toast'
import {
  SkeletonStatCard,
  SkeletonBookingCard,
  SkeletonMusicianCard,
} from '@/components/Skeleton'

// ---- Types ----

type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

interface Venue {
  id: string
  name: string
  type: string
  distance: string
  avatar: string
}

interface Gig {
  id: string
  venue: Venue
  date: string
  rawDate: string
  rawEndDatetime: string
  time: string
  genres: string[]
  budget: number
  description: string
}

interface Booking {
  id: string
  gig: Gig
  status: BookingStatus
  price: number
  note: string
  paymentStatus: string | null
  payoutReleased: boolean
}

interface MusicianProfile {
  name: string
  bio: string
  avatar: string
  genres: string[]
  instagram: string
  youtube: string
  spotify: string
  website: string
  legalName: string
  performerType: 'solo' | 'band' | ''
  bandMembers: number | null
}

// ---- Constants ----

const GENRES = ['Jazz', 'Blues', 'Acoustic', 'Folk', 'R&B', 'Soul', 'Rock', 'Country', 'Pop', 'Classical']

const INITIAL_PROFILE: MusicianProfile = {
  name: 'Your Name',
  bio: '',
  avatar: '',
  genres: [],
  instagram: '',
  youtube: '',
  spotify: '',
  website: '',
  legalName: '',
  performerType: '',
  bandMembers: null,
}

// ---- Helpers ----

function fmt(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
}

function BookingBadge({ status }: { status: BookingStatus }) {
  if (status === 'confirmed')
    return <span className="bg-teal/10 text-teal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Confirmed</span>
  if (status === 'pending')
    return <span className="bg-chestnut/10 text-chestnut text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Pending</span>
  return <span className="bg-charcoal/10 text-charcoal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Cancelled</span>
}

// ---- Main Component ----

export default function MusicianDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('home')
  const [gigs, setGigs] = useState<Gig[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [profile, setProfile] = useState<MusicianProfile>(INITIAL_PROFILE)

  // Loading states
  const [dataLoading, setDataLoading] = useState(true)
  const [gigsLoading, setGigsLoading] = useState(true)

  // Gig browsing
  const [gigSearch, setGigSearch] = useState('')
  const [gigGenreFilter, setGigGenreFilter] = useState<string | null>(null)
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null)

  // Apply modal
  const [applyGigId, setApplyGigId] = useState<string | null>(null)
  const [applyNote, setApplyNote] = useState('')

  // Messaging
  const messagingRef = useRef<MessagingTabRef>(null)
  const [msgUnread, setMsgUnread] = useState(0)

  // Newly confirmed gigs (unseen acceptances)
  const [newlyConfirmed, setNewlyConfirmed] = useState(0)

  // Profile
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<MusicianProfile>(INITIAL_PROFILE)
  const [userId, setUserId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

  // Analytics
  const [analyticsViews7d, setAnalyticsViews7d] = useState<number | null>(null)
  const [analyticsViews30d, setAnalyticsViews30d] = useState<number | null>(null)
  const [analyticsFollowers, setAnalyticsFollowers] = useState<number | null>(null)
  const [analyticsGigs, setAnalyticsGigs] = useState<number | null>(null)
  const [analyticsRating, setAnalyticsRating] = useState<number | null>(null)
  const [analyticsReviewCount, setAnalyticsReviewCount] = useState<number | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)

  // Stripe Connect
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null)
  const [stripeConnecting, setStripeConnecting] = useState(false)
  const [stripeSuccess, setStripeSuccess] = useState(false)
  const [showStripeExplainModal, setShowStripeExplainModal] = useState(false)
  const [showStripeRefreshModal, setShowStripeRefreshModal] = useState(false)

  // ---- Data loading ----

  const loadMyBookings = async (uid: string, myLat: number | null, myLon: number | null) => {
    try {
      const { data: myBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('id, availability_id, restaurant_id, status, pay_amount, note, created_at, payment_status, payout_released')
        .eq('musician_id', uid)
        .order('created_at', { ascending: false })

      if (bookingsErr) throw bookingsErr
      if (!myBookings || myBookings.length === 0) { setBookings([]); return }

      const availIds = myBookings.map(b => b.availability_id)
      const restaurantIds = [...new Set(myBookings.map(b => b.restaurant_id))]

      const [{ data: avails, error: availsErr }, { data: restaurants, error: restErr }] = await Promise.all([
        supabase.from('availability').select('id, date, start_time, end_time, genres, pay').in('id', availIds),
        supabase.from('profiles').select('id, full_name, avatar_url, role_metadata, latitude, longitude').in('id', restaurantIds),
      ])

      if (availsErr) throw availsErr
      if (restErr) throw restErr

      const availById = new Map((avails ?? []).map(a => [a.id, a]))
      const restaurantById = new Map((restaurants ?? []).map(r => [r.id, r]))

      const mapped: Booking[] = myBookings.map(b => {
        const avail = availById.get(b.availability_id)
        const restaurant = restaurantById.get(b.restaurant_id)
        const meta = (restaurant?.role_metadata ?? {}) as Record<string, unknown>
        const venueName = (meta.venue_name as string | undefined) ?? restaurant?.full_name ?? 'Venue'
        const dateLabel = avail
          ? new Date(avail.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : '—'
        const timeStr = avail
          ? `${fmt(avail.start_time?.slice(0, 5) ?? '')} – ${fmt(avail.end_time?.slice(0, 5) ?? '')}`
          : '—'

        let distanceStr = '—'
        if (myLat != null && myLon != null && restaurant?.latitude != null && restaurant?.longitude != null) {
          distanceStr = `${milesBetween(myLat, myLon, restaurant.latitude, restaurant.longitude).toFixed(1)} mi`
        }

        return {
          id: b.id,
          gig: {
            id: b.availability_id,
            venue: {
              id: b.restaurant_id,
              name: venueName,
              type: (meta.cuisine_type as string | undefined) ?? '',
              distance: distanceStr,
              avatar: restaurant?.avatar_url ?? '',
            },
            date: dateLabel,
            rawDate: avail?.date ?? '',
            rawEndDatetime: avail ? `${avail.date}T${avail.end_time ?? '23:59:00'}` : '',
            time: timeStr,
            genres: Array.isArray(avail?.genres) ? avail.genres : [],
            budget: Number(avail?.pay) || 0,
            description: '',
          },
          status: b.status as BookingStatus,
          price: Number(b.pay_amount) || 0,
          note: b.note ?? '',
          paymentStatus: (b as Record<string, unknown>).payment_status as string | null ?? null,
          payoutReleased: ((b as Record<string, unknown>).payout_released as boolean | null) ?? false,
        }
      })
      setBookings(mapped)
    } catch (err) {
      console.error('Failed to load bookings:', err)
      toast.error('Could not load your bookings. Pull to refresh.')
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        if (!user) return

        setUserId(user.id)

        const { data, error: profileErr } = await supabase
          .from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (profileErr) throw profileErr
        if (!data) return

        const meta = (data.role_metadata ?? {}) as Record<string, unknown>
        const pt = (data as Record<string, unknown>).performer_type as string | null
        setProfile({
          name: data.full_name ?? '',
          bio: data.bio ?? '',
          avatar: data.avatar_url ?? '',
          genres: Array.isArray(meta.genres) ? meta.genres as string[] : [],
          instagram: data.instagram_url ?? '',
          youtube: data.youtube_url ?? '',
          spotify: data.spotify_url ?? '',
          website: data.website ?? '',
          legalName: (data as Record<string, unknown>).legal_name as string ?? '',
          performerType: pt === 'solo' || pt === 'band' ? pt : '',
          bandMembers: (data as Record<string, unknown>).band_members as number | null ?? null,
        })
        setStripeOnboarded((data as Record<string, unknown>).stripe_onboarded as boolean | null ?? false)

        const myLat = data.latitude as number | null
        const myLon = data.longitude as number | null
        const maxMiles = (data.max_distance_miles as number | null) ?? 20

        await loadMyBookings(user.id, myLat, myLon)
        setDataLoading(false)

        if (myLat == null || myLon == null) {
          setGigsLoading(false)
          return
        }

        const today = new Date().toISOString().slice(0, 10)

        const { data: existingBookings, error: existErr } = await supabase
          .from('bookings')
          .select('availability_id')
          .eq('musician_id', user.id)
        if (existErr) throw existErr

        const appliedIds = new Set((existingBookings ?? []).map(b => b.availability_id))

        const { data: slots, error: slotsErr } = await supabase
          .from('availability')
          .select('id, restaurant_id, date, start_time, end_time, description, pay, genres, latitude, longitude')
          .eq('status', 'open')
          .gte('date', today)
          .order('date', { ascending: true })

        if (slotsErr) throw slotsErr

        if (!slots || slots.length === 0) {
          setGigsLoading(false)
          return
        }

        const unapplied = slots.filter(s => !appliedIds.has(s.id))
        if (unapplied.length === 0) { setGigs([]); setGigsLoading(false); return }

        const inRange = unapplied
          .filter(s => s.latitude != null && s.longitude != null)
          .map(s => ({
            slot: s,
            distance: milesBetween(myLat, myLon, s.latitude as number, s.longitude as number),
          }))
          .filter(x => x.distance <= maxMiles)
          .sort((a, b) => a.distance - b.distance)

        if (inRange.length === 0) { setGigs([]); setGigsLoading(false); return }

        const venueIds = Array.from(new Set(inRange.map(x => x.slot.restaurant_id)))
        const { data: venues, error: venuesErr } = await supabase
          .from('profiles')
          .select('id, full_name, role_metadata, avatar_url')
          .in('id', venueIds)
        if (venuesErr) throw venuesErr

        const venueById = new Map((venues ?? []).map(v => [v.id, v]))

        const nearby: Gig[] = inRange.map(({ slot: s, distance }) => {
          const v = venueById.get(s.restaurant_id)
          const vMeta = (v?.role_metadata ?? {}) as Record<string, unknown>
          const name = (vMeta.venue_name as string | undefined) ?? v?.full_name ?? 'Venue'
          const dateLabel = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return {
            id: s.id,
            venue: {
              id: s.restaurant_id,
              name,
              type: (vMeta.cuisine_type as string | undefined) ?? '',
              distance: `${distance.toFixed(1)} mi`,
              avatar: v?.avatar_url || '🍽',
            },
            date: dateLabel,
            rawDate: s.date,
            rawEndDatetime: `${s.date}T${s.end_time ?? '23:59:00'}`,
            time: `${fmt(s.start_time?.slice(0, 5) ?? '')} – ${fmt(s.end_time?.slice(0, 5) ?? '')}`,
            genres: Array.isArray(s.genres) ? s.genres : [],
            budget: Number(s.pay) || 0,
            description: s.description ?? '',
          }
        })
        setGigs(nearby)
      } catch (err) {
        console.error('Failed to load musician dashboard:', err)
        toast.error('Failed to load your dashboard. Please refresh.')
        setDataLoading(false)
      } finally {
        setGigsLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load analytics when profile tab is first opened
  useEffect(() => {
    if (activeTab === 'profile' && userId) loadAnalytics(userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId])

  // Clear newly-confirmed badge when musician opens bookings tab
  useEffect(() => {
    if (activeTab === 'bookings') setNewlyConfirmed(0)
  }, [activeTab])

  // Realtime: bookings table changes
  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel(`bookings-musician-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `musician_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as { status?: string }
        if (updated.status === 'confirmed') {
          setNewlyConfirmed(n => n + 1)
          toast.success('Gig confirmed! A restaurant accepted your application.')
        }
        supabase.from('profiles').select('latitude, longitude, max_distance_miles').eq('id', userId).maybeSingle().then(({ data }) => {
          loadMyBookings(userId, (data?.latitude as number | null) ?? null, (data?.longitude as number | null) ?? null)
        })
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `musician_id=eq.${userId}`,
      }, () => {
        supabase.from('profiles').select('latitude, longitude, max_distance_miles').eq('id', userId).maybeSingle().then(({ data }) => {
          loadMyBookings(userId, (data?.latitude as number | null) ?? null, (data?.longitude as number | null) ?? null)
        })
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // ---- Actions ----

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('profiles').select('role_metadata').eq('id', userId).maybeSingle()
      if (fetchErr) throw fetchErr

      const meta = { ...(existing?.role_metadata ?? {}), genres: profileDraft.genres }
      const { error: upErr } = await supabase.from('profiles').update({
        full_name: profileDraft.name || null,
        bio: profileDraft.bio || null,
        instagram_url: profileDraft.instagram || null,
        youtube_url: profileDraft.youtube || null,
        spotify_url: profileDraft.spotify || null,
        website: profileDraft.website || null,
        legal_name: profileDraft.legalName || null,
        performer_type: profileDraft.performerType || null,
        band_name: profileDraft.performerType === 'band' ? (profileDraft.name || null) : null,
        band_members: profileDraft.performerType === 'band' ? (profileDraft.bandMembers ?? null) : null,
        role_metadata: meta,
      }).eq('id', userId)

      if (upErr) throw upErr

      setProfile(profileDraft)
      setEditingProfile(false)
      toast.success('Profile saved!')
    } catch (err) {
      console.error('Profile save failed:', err)
      toast.error('Could not save your profile. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('Logout failed:', err)
      toast.error('Logout failed. Please try again.')
    }
  }

  const checkStripeStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/stripe/connect/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json() as { onboarded: boolean }
      if (res.ok) setStripeOnboarded(data.onboarded)
    } catch (err) {
      console.error('Stripe status check failed:', err)
    }
  }

  const connectStripe = async () => {
    setStripeConnecting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Please log in again.'); return }
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to start Stripe setup')
      window.location.href = data.url
    } catch (err) {
      console.error('Stripe connect failed:', err)
      toast.error(err instanceof Error ? err.message : 'Could not start Stripe setup.')
      setStripeConnecting(false)
    }
  }

  // Handle Stripe redirect back from onboarding
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const stripeParam = params.get('stripe')
    if (stripeParam === 'success') {
      checkStripeStatus().then(() => setStripeSuccess(true))
      window.history.replaceState({}, '', window.location.pathname)
    } else if (stripeParam === 'refresh') {
      setShowStripeRefreshModal(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadAnalytics = async (uid: string) => {
    if (analyticsLoaded) return
    setAnalyticsLoading(true)
    try {
      const now = Date.now()
      const d7 = new Date(now - 7 * 86400000).toISOString()
      const d30 = new Date(now - 30 * 86400000).toISOString()
      const [v7, v30, fol, bks, revs] = await Promise.all([
        supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('profile_id', uid).gte('viewed_at', d7),
        supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('profile_id', uid).gte('viewed_at', d30),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('musician_id', uid).eq('status', 'confirmed'),
        supabase.from('reviews').select('rating').eq('reviewee_id', uid),
      ])
      setAnalyticsViews7d(v7.count ?? 0)
      setAnalyticsViews30d(v30.count ?? 0)
      setAnalyticsFollowers(fol.count ?? 0)
      setAnalyticsGigs(bks.count ?? 0)
      if (revs.data && revs.data.length > 0) {
        const avg = revs.data.reduce((s, r) => s + r.rating, 0) / revs.data.length
        setAnalyticsRating(parseFloat(avg.toFixed(1)))
        setAnalyticsReviewCount(revs.data.length)
      } else {
        setAnalyticsRating(null)
        setAnalyticsReviewCount(0)
      }
      setAnalyticsLoaded(true)
    } catch (err) {
      console.error('Analytics load failed:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')

  const openApply = (gigId: string) => {
    if (stripeOnboarded === false) {
      setShowStripeExplainModal(true)
      return
    }
    setApplyGigId(gigId)
  }

  const handleApply = async () => {
    if (!applyGigId || !userId) return
    const gig = gigs.find(g => g.id === applyGigId)
    if (!gig) return
    setApplying(true)
    setApplyError('')
    try {
      const { data: newBooking, error: insertErr } = await supabase
        .from('bookings')
        .insert({
          availability_id: gig.id,
          restaurant_id: gig.venue.id,
          musician_id: userId,
          status: 'pending',
          pay_amount: gig.budget,
          note: applyNote || null,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      const booking: Booking = {
        id: newBooking.id,
        gig,
        status: 'pending',
        price: gig.budget,
        note: applyNote,
        paymentStatus: null,
        payoutReleased: false,
      }
      setBookings(prev => [booking, ...prev])
      setGigs(prev => prev.filter(g => g.id !== gig.id))
      setApplyGigId(null)
      setApplyNote('')
      setActiveTab('bookings')
      toast.success('Application sent!')
    } catch (err) {
      console.error('Apply failed:', err)
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setApplyError(msg)
      toast.error('Failed to send application. Please try again.')
    } finally {
      setApplying(false)
    }
  }

  const handleCancelApplication = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .eq('musician_id', userId)
      if (error) throw error

      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'cancelled' } : b))
      if (booking) {
        setGigs(prev => {
          if (prev.some(g => g.id === booking.gig.id)) return prev
          return [...prev, booking.gig].sort((a, b) => a.rawDate.localeCompare(b.rawDate))
        })
      }
      toast.success('Application cancelled.')
    } catch (err) {
      console.error('Failed to cancel application:', err)
      toast.error('Could not cancel application. Please try again.')
    }
  }

  const openConversationWithVenue = (gig: Gig) => {
    if (!gig.venue.id) return
    setSelectedGig(null)
    setActiveTab('messages')
    setTimeout(() => {
      messagingRef.current?.openWith(gig.venue.id, gig.venue.name, gig.venue.avatar)
    }, 0)
  }

  // ---- Derived ----

  const now = new Date()
  const upcomingGigs = bookings.filter(b => b.status === 'confirmed' && new Date(b.gig.rawEndDatetime || b.gig.rawDate + 'T23:59') >= now).length
  const pendingApps = bookings.filter(b => b.status === 'pending').length
  const totalEarned = bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.price, 0)
  const filteredGigs = gigs.filter(g => {
    const q = gigSearch.toLowerCase()
    const matchSearch = !q || g.venue.name.toLowerCase().includes(q) || g.genres.some(x => x.toLowerCase().includes(q))
    const matchGenre = !gigGenreFilter || g.genres.includes(gigGenreFilter)
    return matchSearch && matchGenre
  })
  const applyGig = gigs.find(g => g.id === applyGigId)

  return (
    <div className="min-h-screen pb-24" style={{ background: 'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0' }}>

      {/* HEADER */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-graphite/95 border-b border-charcoal/30">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg p-1">
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-6 h-6 object-contain" />
            </div>
            <h1 className="text-snow text-lg font-black tracking-tight">Drum Up</h1>
            <span className="relative flex h-2 w-2 ml-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chestnut opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-chestnut" />
            </span>
          </div>
          <div className="relative">
            <button
              onClick={() => setHeaderMenuOpen(o => !o)}
              className="flex items-center gap-2 group"
            >
              {profile.avatar
                ? <img src={profile.avatar} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-chestnut/40 group-hover:border-chestnut transition-colors" />
                : <div className="w-8 h-8 rounded-full bg-graphite border-2 border-chestnut/40 group-hover:border-chestnut transition-colors flex items-center justify-center text-snow text-xs font-black">
                    {profile.name.slice(0, 2).toUpperCase() || 'DU'}
                  </div>}
            </button>
            {headerMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl z-50 overflow-hidden border border-charcoal/10">
                  <button onClick={() => { router.push('/profile/' + userId); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                    <span>👤</span> View Profile
                  </button>
                  <button onClick={() => { setActiveTab('profile'); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                    <span>✏️</span> Edit Profile
                  </button>
                  <button onClick={() => { router.push('/settings'); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                    <span>⚙️</span> Settings
                  </button>
                  <div className="border-t border-charcoal/10" />
                  <button onClick={() => { handleLogout(); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-medium text-charcoal hover:bg-snow transition-colors flex items-center gap-2">
                    <span>🚪</span> Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* Payout setup banner */}
        {stripeOnboarded === false && (
          <div className="bg-chestnut rounded-2xl px-4 py-4 mb-4 flex items-center gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-snow font-bold text-sm leading-snug">Set up payouts to receive payment for your gigs</p>
              <p className="text-snow/70 text-xs mt-0.5">You won't be paid until your bank account is connected.</p>
            </div>
            <button
              onClick={() => setShowStripeExplainModal(true)}
              disabled={stripeConnecting}
              className="shrink-0 bg-snow text-chestnut font-bold text-xs px-3 py-2 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
            >
              Connect Bank →
            </button>
          </div>
        )}

        {/* ---- HOME TAB ---- */}
        {activeTab === 'home' && (
          <>
            {/* Profile hero */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 13)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <span className="absolute top-3 right-3 bg-chestnut text-snow text-[9px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full shadow-md uppercase z-20">
                {profile.performerType === 'band' ? '🎸 Band' : '🎤 Solo Artist'}
              </span>
              <div className="relative z-10 p-5 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-inner border border-chestnut/30" />
                  : <div className="w-14 h-14 rounded-2xl bg-chestnut/20 border border-chestnut/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">♪</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">For Musicians</p>
                  <p className="text-snow font-black text-lg leading-tight truncate">{profile.name || 'Your Name'}</p>
                  <p className="text-snow/50 text-xs mt-0.5 truncate">
                    {profile.genres.length > 0 ? profile.genres.slice(0, 3).join(' · ') : 'Set your genres in Profile'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('gigs')}
                  className="bg-chestnut text-snow px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0 shadow-lg"
                >
                  Browse Gigs
                </button>
              </div>
            </div>

            {/* Stats */}
            {dataLoading ? (
              <div className="grid grid-cols-3 gap-2.5 mb-7">
                <SkeletonStatCard />
                <SkeletonStatCard />
                <SkeletonStatCard />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 mb-7">
                <StatCard value={upcomingGigs} label="Upcoming" color="text-teal" icon="✅" />
                <StatCard value={pendingApps} label="Pending" color="text-chestnut" icon="📬" />
                <StatCard value={`$${totalEarned}`} label="Earned" color="text-graphite" icon="💰" highlight />
              </div>
            )}

            {/* Newly confirmed notification banner */}
            {newlyConfirmed > 0 && (
              <div className="bg-teal/10 border border-teal/30 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <p className="text-teal font-bold text-sm">
                  <span className="font-black">{newlyConfirmed}</span> application{newlyConfirmed !== 1 ? 's were' : ' was'} accepted — you have a new confirmed gig!
                </p>
                <button
                  onClick={() => setActiveTab('bookings')}
                  className="ml-auto shrink-0 text-teal font-black text-xs underline hover:opacity-70 transition-opacity"
                >
                  View →
                </button>
              </div>
            )}

            {/* Upcoming confirmed gigs */}
            {!dataLoading && upcomingGigs > 0 && (
              <>
                <SectionHeader eyebrow="The Calendar" title="Upcoming" accent="Gigs." />
                <div className="space-y-3 mb-6">
                  {bookings.filter(b => b.status === 'confirmed' && new Date(b.gig.rawEndDatetime || b.gig.rawDate + 'T23:59') >= now).map(b => {
                    const [, datePart] = b.gig.date.split(', ')
                    const [mon, day] = (datePart || '').split(' ')
                    return (
                      <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                        <div className="bg-chestnut/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                          <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">{mon}</p>
                          <p className="text-chestnut text-2xl font-black leading-tight">{day}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-graphite font-bold text-sm truncate">{b.gig.venue.name}</p>
                          <p className="text-charcoal text-xs mt-0.5">{b.gig.time}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {b.gig.genres.map(g => (
                              <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-teal font-black">${b.price}</p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal" />
                            <span className="text-teal text-[10px] font-bold">Confirmed</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Pending applications */}
            <SectionHeader eyebrow="Sent" title="Pending" accent="Applications." />
            {dataLoading ? (
              <div className="space-y-3">
                <SkeletonBookingCard />
                <SkeletonBookingCard />
                <SkeletonBookingCard />
              </div>
            ) : pendingApps === 0 ? (
              <EmptyState
                icon="🎸"
                title="No pending applications"
                body="Browse open gig slots and apply to restaurants looking for live music."
                action={{ label: 'Browse Open Gigs', onClick: () => setActiveTab('gigs') }}
              />
            ) : (
              <div className="space-y-3">
                {bookings.filter(b => b.status === 'pending').map(b => (
                  <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar src={b.gig.venue.avatar} className="w-10 h-10 rounded-full" textSize="text-xl" />
                        <div>
                          <p className="text-graphite font-bold text-sm">{b.gig.venue.name}</p>
                          <p className="text-charcoal text-xs">{b.gig.date} · {b.gig.time}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-teal font-black text-sm">${b.price}</p>
                        <div className="mt-1"><BookingBadge status={b.status} /></div>
                      </div>
                    </div>
                    {b.note && (
                      <div className="bg-snow rounded-xl px-3 py-2 mb-2">
                        <p className="text-charcoal text-xs italic">Your note: &ldquo;{b.note}&rdquo;</p>
                      </div>
                    )}
                    <div className="flex justify-end mt-1">
                      <button
                        onClick={() => handleCancelApplication(b.id)}
                        className="text-charcoal/60 text-xs font-medium hover:text-red-500 transition-colors"
                      >
                        Cancel Application
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- GIGS TAB: LIST ---- */}
        {activeTab === 'gigs' && !selectedGig && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Open Calls</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Browse <span className="text-chestnut italic">Gigs.</span>
              </h2>
            </div>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40 text-sm pointer-events-none">🔍</span>
              <input
                value={gigSearch}
                onChange={e => setGigSearch(e.target.value)}
                placeholder="Search by venue or genre..."
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              <button
                onClick={() => setGigGenreFilter(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!gigGenreFilter ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
              >
                All
              </button>
              {GENRES.map(g => (
                <button
                  key={g}
                  onClick={() => setGigGenreFilter(gigGenreFilter === g ? null : g)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${gigGenreFilter === g ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
                >
                  {g}
                </button>
              ))}
            </div>
            {gigsLoading ? (
              <div className="space-y-3">
                <SkeletonMusicianCard />
                <SkeletonMusicianCard />
                <SkeletonMusicianCard />
                <SkeletonMusicianCard />
              </div>
            ) : filteredGigs.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="No open gigs right now"
                body="Restaurants post available slots here. Check back soon — new gigs appear as venues look for talent."
              />
            ) : (
              <div className="space-y-3">
                {filteredGigs.map(gig => (
                  <div key={gig.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-[#6C9A8B]">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={gig.venue.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" />
                        <div>
                          <p className="text-graphite font-bold text-sm">{gig.venue.name}</p>
                          <p className="text-charcoal text-xs">{gig.venue.type} · {gig.venue.distance}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-teal font-black text-xl">${gig.budget}</p>
                        <p className="text-charcoal/50 text-[9px] font-semibold uppercase tracking-wide">pay offered</p>
                      </div>
                    </div>
                    <p className="text-charcoal text-xs mb-2">{gig.date} · {gig.time}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {gig.genres.map(g => (
                        <span key={g} className="text-xs bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
                      ))}
                    </div>
                    {gig.description && (
                      <p className="text-charcoal text-xs mb-3 italic">&ldquo;{gig.description}&rdquo;</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openConversationWithVenue(gig)}
                        className="bg-snow text-charcoal px-3 py-2.5 rounded-xl text-sm hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                        title="Message Venue"
                      >
                        💬
                      </button>
                      <button
                        onClick={() => setSelectedGig(gig)}
                        className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => openApply(gig.id)}
                        className="flex-1 bg-chestnut text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                      >
                        Apply Now →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- GIGS TAB: DETAIL ---- */}
        {activeTab === 'gigs' && selectedGig && (
          <div>
            <button
              onClick={() => setSelectedGig(null)}
              className="flex items-center gap-1.5 text-charcoal text-sm mb-5 hover:text-chestnut transition-colors font-medium"
            >
              ← Back to Gigs
            </button>
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <div className="flex items-center gap-4 mb-5">
                <Avatar src={selectedGig.venue.avatar} className="w-16 h-16 rounded-2xl" textSize="text-3xl" />
                <div>
                  <h2 className="text-graphite text-xl font-black">{selectedGig.venue.name}</h2>
                  <p className="text-charcoal text-sm mt-0.5">{selectedGig.venue.type} · {selectedGig.venue.distance}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Date</p>
                  <p className="text-graphite font-bold text-sm">{selectedGig.date}</p>
                </div>
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Time</p>
                  <p className="text-graphite font-bold text-sm">{selectedGig.time}</p>
                </div>
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Pay Offered</p>
                  <p className="text-teal font-black text-sm">${selectedGig.budget}</p>
                </div>
              </div>
              <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Genre Preferences</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {selectedGig.genres.map(g => (
                  <span key={g} className="text-xs bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
                ))}
              </div>
              {selectedGig.description && (
                <div className="bg-snow rounded-xl p-4">
                  <p className="text-charcoal text-sm leading-relaxed">{selectedGig.description}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openConversationWithVenue(selectedGig)}
                className="flex-1 bg-graphite text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Message Venue
              </button>
              <button
                onClick={() => { openApply(selectedGig.id); setSelectedGig(null) }}
                className="flex-1 bg-chestnut text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Apply Now →
              </button>
            </div>
          </div>
        )}

        {/* ---- BOOKINGS TAB ---- */}
        {activeTab === 'bookings' && (() => {
          const tabNow = new Date()
          const pendingBookings = bookings.filter(b => b.status === 'pending')
          const upcomingConfirmed = bookings
            .filter(b => b.status === 'confirmed' && new Date(b.gig.rawEndDatetime || b.gig.rawDate + 'T23:59') >= tabNow)
            .sort((a, b) => a.gig.rawEndDatetime.localeCompare(b.gig.rawEndDatetime))
          const pastGigs = bookings
            .filter(b => b.status === 'confirmed' && new Date(b.gig.rawEndDatetime || b.gig.rawDate + 'T23:59') < tabNow)
            .sort((a, b) => b.gig.rawEndDatetime.localeCompare(a.gig.rawEndDatetime))
          const pendingEarnings = bookings
            .filter(b => b.status === 'confirmed' && b.paymentStatus === 'authorized' && !b.payoutReleased)
            .reduce((s, b) => s + b.price, 0)
          const releasedEarnings = bookings
            .filter(b => b.status === 'confirmed' && b.paymentStatus === 'paid' && b.payoutReleased)
            .reduce((s, b) => s + b.price, 0)
          const totalConfirmedEarnings = bookings
            .filter(b => b.status === 'confirmed')
            .reduce((s, b) => s + b.price, 0)
          return (
            <>
              <div className="mb-6">
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">The Setlist</p>
                <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                  My <span className="text-chestnut italic">Bookings.</span>
                </h2>
              </div>

              {/* Earnings summary */}
              {totalConfirmedEarnings > 0 && (
                <div className="bg-graphite rounded-2xl p-4 mb-6 shadow-sm">
                  <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">Earnings</p>
                  <div className="grid grid-cols-3 divide-x divide-white/10">
                    <div className="pr-3">
                      <p className="text-snow text-2xl font-black">${totalConfirmedEarnings}</p>
                      <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Total</p>
                    </div>
                    <div className="px-3">
                      <p className="text-chestnut text-2xl font-black">${pendingEarnings}</p>
                      <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Authorized</p>
                    </div>
                    <div className="pl-3">
                      <p className="text-teal text-2xl font-black">${releasedEarnings}</p>
                      <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Released</p>
                    </div>
                  </div>
                  {pendingEarnings > 0 && (
                    <p className="text-snow/50 text-xs mt-3 leading-relaxed">
                      ${pendingEarnings} is authorized and will be released to your bank after each gig date passes.
                    </p>
                  )}
                </div>
              )}

              {/* Pending */}
              <div className="mb-8">
                <SectionHeader eyebrow="Waiting to Hear Back" title="Pending" accent="Applications." />
                {dataLoading ? (
                  <div className="space-y-3">
                    <SkeletonBookingCard />
                    <SkeletonBookingCard />
                  </div>
                ) : pendingBookings.length === 0 ? (
                  <EmptyState
                    icon="📬"
                    title="No pending applications"
                    body="Browse open gig slots and apply to restaurants looking for live music."
                    action={{ label: 'Browse Open Gigs', onClick: () => setActiveTab('gigs') }}
                  />
                ) : (
                  <div className="space-y-3">
                    {pendingBookings.map(b => (
                      <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-[#DC7F41]">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/profile/' + b.gig.venue.id)}>
                              <Avatar src={b.gig.venue.avatar} className="w-10 h-10 rounded-full" textSize="text-xl" />
                            </button>
                            <div>
                              <button
                                onClick={() => router.push('/profile/' + b.gig.venue.id)}
                                className="text-graphite font-bold text-sm hover:text-chestnut transition-colors text-left block"
                              >
                                {b.gig.venue.name}
                              </button>
                              <p className="text-charcoal text-xs">{b.gig.date} · {b.gig.time}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-teal font-black text-sm">${b.price}</p>
                            <BookingBadge status={b.status} />
                          </div>
                        </div>
                        {b.note && (
                          <div className="bg-snow rounded-xl px-3 py-2 mb-2">
                            <p className="text-charcoal text-xs italic">Your note: &ldquo;{b.note}&rdquo;</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between mt-1">
                          <button
                            onClick={() => openConversationWithVenue(b.gig)}
                            className="text-charcoal/60 text-xs font-medium hover:text-chestnut transition-colors"
                          >
                            💬 Message Venue
                          </button>
                          <button
                            onClick={() => handleCancelApplication(b.id)}
                            className="text-charcoal/60 text-xs font-medium hover:text-red-500 transition-colors"
                          >
                            Cancel Application
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Confirmed */}
              <div className="mb-8">
                <SectionHeader eyebrow="Confirmed" title="Upcoming" accent="Gigs." />
                {dataLoading ? (
                  <div className="space-y-3">
                    <SkeletonBookingCard />
                    <SkeletonBookingCard />
                  </div>
                ) : upcomingConfirmed.length === 0 ? (
                  <EmptyState
                    icon="🎸"
                    title="No upcoming gigs"
                    body="Keep applying! Your confirmed gigs will appear here once a restaurant accepts."
                    action={{ label: 'Browse Gigs', onClick: () => setActiveTab('gigs') }}
                  />
                ) : (
                  <div className="space-y-3">
                    {upcomingConfirmed.map(b => {
                      const [, datePart] = b.gig.date.split(', ')
                      const [mon, day] = (datePart || '').split(' ')
                      return (
                        <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-[#6C9A8B]">
                          <div className="flex items-center gap-3">
                            <div className="bg-teal/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                              <p className="text-teal text-[10px] font-black uppercase tracking-wide">{mon}</p>
                              <p className="text-teal text-2xl font-black leading-tight">{day}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <button
                                onClick={() => router.push('/profile/' + b.gig.venue.id)}
                                className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left block"
                              >
                                {b.gig.venue.name}
                              </button>
                              <p className="text-charcoal text-xs mt-0.5">{b.gig.time}</p>
                              {b.gig.venue.type && <p className="text-charcoal/60 text-xs">{b.gig.venue.type}</p>}
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {b.gig.genres.map(g => <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>)}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-teal font-black">${b.price}</p>
                              {b.paymentStatus === 'paid' ? (
                                <span className="inline-block bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full mt-1">Paid</span>
                              ) : b.paymentStatus === 'authorized' ? (
                                <span className="inline-block bg-chestnut/10 text-chestnut text-[10px] font-black px-2 py-0.5 rounded-full mt-1">Auth'd</span>
                              ) : null}
                              <button
                                onClick={() => openConversationWithVenue(b.gig)}
                                className="text-charcoal/60 text-[10px] font-medium hover:text-chestnut transition-colors mt-1 block"
                              >
                                💬 Message
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Past Gigs */}
              <div>
                <SectionHeader eyebrow="History" title="Past" accent="Gigs." />
                {dataLoading ? (
                  <div className="space-y-3">
                    <SkeletonBookingCard />
                  </div>
                ) : pastGigs.length === 0 ? (
                  <EmptyState
                    icon="🕐"
                    title="No past gigs yet"
                    body="Your performance history will appear here after your first confirmed gig."
                  />
                ) : (
                  <div className="space-y-3">
                    {pastGigs.map(b => (
                      <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm opacity-80">
                        <div className="flex items-center gap-3">
                          <div className="bg-charcoal/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                            <p className="text-charcoal/60 text-[10px] font-black uppercase tracking-wide">{b.gig.date.split(' ')[0]}</p>
                            <p className="text-charcoal/60 text-2xl font-black leading-tight">{b.gig.date.split(' ')[2]?.replace(',', '')}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => router.push('/profile/' + b.gig.venue.id)}
                              className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left block"
                            >
                              {b.gig.venue.name}
                            </button>
                            <p className="text-charcoal text-xs mt-0.5">{b.gig.time}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-charcoal font-black">${b.price}</p>
                            <span className="inline-flex items-center gap-0.5 bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full mt-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Done
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )
        })()}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === 'profile' && (
          <>
            {/* Header */}
            <div className="mb-6">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">· The Artist</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Your <span className="text-chestnut italic">Analytics.</span>
              </h2>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => router.push('/profile/' + userId)}
                className="flex items-center justify-center gap-2 bg-graphite text-snow py-3.5 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center justify-center gap-2 bg-white text-graphite py-3.5 rounded-2xl font-bold text-sm hover:shadow-md transition-shadow shadow-sm border border-charcoal/[0.07]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Edit Profile
              </button>
            </div>

            {/* Profile Views card */}
            <div className="bg-graphite rounded-2xl p-5 shadow-sm mb-4 relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.08] pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 41)} />
                ))}
              </div>
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">Profile Views</p>
              {analyticsLoading ? (
                <div className="flex gap-6">
                  {[0, 1, 2].map(i => <div key={i} className="h-10 w-16 bg-white/10 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-3 divide-x divide-white/10">
                  <div className="pr-4">
                    <p className="text-snow text-3xl font-black">{analyticsViews7d ?? '—'}</p>
                    <p className="text-snow/40 text-xs font-semibold uppercase tracking-wider mt-0.5">Last 7 days</p>
                  </div>
                  <div className="px-4">
                    <p className="text-snow text-3xl font-black">{analyticsViews30d ?? '—'}</p>
                    <p className="text-snow/40 text-xs font-semibold uppercase tracking-wider mt-0.5">Last 30 days</p>
                  </div>
                  <div className="pl-4">
                    <p className="text-chestnut text-3xl font-black">{analyticsFollowers ?? '—'}</p>
                    <p className="text-snow/40 text-xs font-semibold uppercase tracking-wider mt-0.5">Followers</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats strip */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
              <div className="grid grid-cols-3 divide-x divide-charcoal/[0.07]">
                <div className="py-5 flex flex-col items-center">
                  {analyticsLoading ? (
                    <div className="h-7 w-10 bg-snow rounded animate-pulse mb-1" />
                  ) : (
                    <p className="text-chestnut text-2xl font-black">{analyticsGigs ?? '—'}</p>
                  )}
                  <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Gigs Played</p>
                </div>
                <div className="py-5 flex flex-col items-center">
                  {analyticsLoading ? (
                    <div className="h-7 w-10 bg-snow rounded animate-pulse mb-1" />
                  ) : (
                    <p className="text-chestnut text-2xl font-black">{analyticsRating != null ? analyticsRating.toFixed(1) : '—'}</p>
                  )}
                  <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Avg Rating</p>
                </div>
                <div className="py-5 flex flex-col items-center">
                  {analyticsLoading ? (
                    <div className="h-7 w-10 bg-snow rounded animate-pulse mb-1" />
                  ) : (
                    <p className="text-chestnut text-2xl font-black">{analyticsReviewCount ?? '—'}</p>
                  )}
                  <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Reviews</p>
                </div>
              </div>
            </div>

            {/* Profile preview card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">Your Profile</p>
              <div className="flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-sm border border-charcoal/[0.07]" />
                  : <div className="w-14 h-14 bg-chestnut/10 rounded-2xl flex items-center justify-center text-3xl">♪</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-graphite font-black text-base truncate">{profile.name || 'Your Name'}</p>
                    {profile.performerType === 'solo' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal shrink-0">🎤 Solo</span>
                    )}
                    {profile.performerType === 'band' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-chestnut/10 text-chestnut shrink-0">
                        🎸 Band{profile.bandMembers ? ` · ${profile.bandMembers}` : ''}
                      </span>
                    )}
                  </div>
                  {profile.genres.length > 0 && (
                    <p className="text-charcoal/60 text-sm mt-0.5">{profile.genres.slice(0, 3).join(' · ')}</p>
                  )}
                </div>
                <svg className="w-4 h-4 text-charcoal/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Account */}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">Account</p>
              <button onClick={handleLogout} className="text-sm text-charcoal hover:text-chestnut transition-colors font-medium">
                Log out
              </button>
            </div>
          </>
        )}

      </main>

      {/* ---- MESSAGING ---- */}
      <div className={activeTab !== 'messages' ? 'hidden' : ''}>
        <div className="max-w-2xl mx-auto px-4" style={{ paddingBottom: '96px' }}>
          {userId && (
            <MessagingTab ref={messagingRef} userId={userId} onUnreadChange={setMsgUnread} />
          )}
        </div>
      </div>

      {/* ---- BOTTOM TAB BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
          <TabButton icon="🏠" label="Home"     active={activeTab === 'home'}     onClick={() => setActiveTab('home')} />
          <TabButton icon="🎵" label="Gigs"     active={activeTab === 'gigs'}     onClick={() => setActiveTab('gigs')} />
          <TabButton icon="📋" label="Bookings" active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} badge={newlyConfirmed > 0 ? newlyConfirmed : undefined} />
          <TabButton icon="💬" label="Messages" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} badge={msgUnread} />
          <TabButton icon="♪"  label="Profile"  active={activeTab === 'profile'}  onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

      {/* ---- APPLY MODAL ---- */}
      {applyGigId && applyGig && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl">
            <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Send It</p>
                <h3 className="text-snow text-xl font-black tracking-tight">Apply to <span className="text-chestnut italic">Gig.</span></h3>
              </div>
              <button
                onClick={() => { setApplyGigId(null); setApplyNote('') }}
                className="text-snow/60 hover:text-snow transition-colors text-xl leading-none relative z-10"
              >✕</button>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-xl p-4 mb-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar src={applyGig.venue.avatar} className="w-10 h-10 rounded-full" textSize="text-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-graphite font-bold text-sm truncate">{applyGig.venue.name}</p>
                    <p className="text-charcoal text-xs">{applyGig.date} · {applyGig.time}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-charcoal/[0.08]">
                  <span className="text-charcoal text-xs font-semibold uppercase tracking-wide">Pay Offered</span>
                  <span className="text-teal font-black text-xl">${applyGig.budget}</span>
                </div>
              </div>

              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
                Add a Note <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                placeholder="Tell the restaurant about yourself, your style, or why you'd be a great fit."
                value={applyNote}
                onChange={e => setApplyNote(e.target.value.slice(0, 300))}
                rows={4}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-1 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10"
              />
              <p className="text-right text-charcoal/40 text-xs mb-5">{applyNote.length}/300</p>

              {applyError && (
                <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-3 text-xs">{applyError}</p>
              )}
              <button
                onClick={handleApply}
                disabled={applying}
                className={`w-full bg-chestnut text-snow py-3.5 rounded-xl font-black text-sm shadow-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${applying ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {applying && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {applying ? 'Sending…' : 'Submit Application →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Stripe Explain Modal ---- */}
      {showStripeExplainModal && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-graphite px-6 py-5">
              <p className="text-snow/60 text-xs font-semibold uppercase tracking-widest mb-1">Payouts</p>
              <h2 className="text-snow font-black text-2xl tracking-tight">Set Up Your Payouts</h2>
              <p className="text-snow/60 text-xs mt-2 leading-relaxed">
                Powered by Stripe — the same payment platform used by Amazon, Shopify, and millions of businesses worldwide.
              </p>
            </div>

            {/* Info cards */}
            <div className="px-5 pt-5 space-y-3">
              {[
                { icon: '🕐', title: 'Takes about 2 minutes', text: 'You only need to do this once. After setup, payments land in your bank automatically after each gig.' },
                { icon: '📋', title: 'What you\'ll need', text: 'Your legal name, date of birth, last 4 digits of your SSN, and your bank account details.' },
                { icon: '🔒', title: 'Bank-level security', text: 'Your financial information is handled entirely by Stripe. Drum Up never sees or stores your sensitive data.' },
              ].map(({ icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 bg-[#F5F5F5] rounded-xl px-4 py-3">
                  <span className="text-xl mt-0.5 shrink-0">{icon}</span>
                  <div>
                    <p className="text-graphite font-bold text-sm">{title}</p>
                    <p className="text-charcoal text-xs mt-0.5 leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}

              {/* Warning box */}
              <div className="flex items-start gap-3 bg-chestnut/10 border border-chestnut/40 rounded-xl px-4 py-3">
                <span className="text-xl mt-0.5 shrink-0 text-chestnut">⚠️</span>
                <div>
                  <p className="text-chestnut font-bold text-sm">Important — please read</p>
                  <p className="text-graphite text-xs mt-1 leading-relaxed">
                    Stripe will pre-fill some fields on your behalf including your website and business description.
                    Please <strong>do not change these fields</strong> — they are required for your account to work correctly with Drum Up.
                    Simply review and continue through each screen.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-5 space-y-3">
              <button
                onClick={() => { setShowStripeExplainModal(false); void connectStripe() }}
                disabled={stripeConnecting}
                className="w-full bg-chestnut text-snow font-bold py-3.5 rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {stripeConnecting ? 'Connecting…' : 'Set Up Payouts →'}
              </button>
              <button
                onClick={() => setShowStripeExplainModal(false)}
                className="w-full text-charcoal text-sm text-center py-1 hover:text-graphite transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Stripe Success Modal ---- */}
      {stripeSuccess && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-graphite px-6 py-5">
              <h2 className="text-snow font-black text-2xl tracking-tight">You're all set! 🎉</h2>
              <p className="text-snow/60 text-sm mt-2 leading-relaxed">
                Your payout account is connected. You'll automatically receive payment within 2 business days after each completed gig.
              </p>
            </div>
            <div className="px-5 py-5 space-y-3">
              <div className="bg-[#F5F5F5] rounded-xl px-4 py-4 space-y-3">
                {['Bank account connected', 'Identity verified', 'Ready to receive payments'].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="text-teal font-bold text-lg">✅</span>
                    <p className="text-graphite text-sm font-semibold">{item}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStripeSuccess(false)}
                className="w-full bg-chestnut text-snow font-bold py-3.5 rounded-xl shadow-md hover:opacity-90 transition-opacity text-sm"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Stripe Refresh Modal (incomplete onboarding) ---- */}
      {showStripeRefreshModal && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-graphite px-6 py-5">
              <h2 className="text-snow font-black text-2xl tracking-tight">Almost there</h2>
              <p className="text-snow/60 text-sm mt-2 leading-relaxed">
                It looks like your payout setup wasn't completed. You'll need to finish setting up your account to receive payment for gigs.
              </p>
            </div>
            <div className="px-5 py-5 space-y-3">
              <button
                onClick={() => { setShowStripeRefreshModal(false); void connectStripe() }}
                disabled={stripeConnecting}
                className="w-full bg-chestnut text-snow font-bold py-3.5 rounded-xl shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
              >
                {stripeConnecting ? 'Connecting…' : 'Complete Setup →'}
              </button>
              <button
                onClick={() => setShowStripeRefreshModal(false)}
                className="w-full text-charcoal text-sm text-center py-1 hover:text-graphite transition-colors"
              >
                I'll do this later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ---- Sub-components ----

function SectionHeader({ title, eyebrow, accent }: { title: string; eyebrow?: string; accent?: string }) {
  return (
    <div className="mb-4 mt-2">
      {eyebrow && <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">{eyebrow}</p>}
      <h3 className="text-graphite text-2xl font-black tracking-tight leading-none">
        {title}
        {accent && <span className="text-chestnut italic"> {accent}</span>}
      </h3>
    </div>
  )
}

function EmptyState({ icon, title, body, action }: {
  icon: string
  title: string
  body: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="relative bg-graphite rounded-3xl overflow-hidden shadow-md">
      <div className="absolute inset-x-0 bottom-0 top-2/3 flex items-end justify-around opacity-[0.08] pointer-events-none">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 23)} />
        ))}
      </div>
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-chestnut opacity-15 blur-2xl pointer-events-none" />
      <div className="relative z-10 p-8 text-center">
        <div className="w-16 h-16 bg-chestnut/20 border border-chestnut/30 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-inner">{icon}</div>
        <p className="text-snow font-black text-lg mb-1.5 tracking-tight">{title}</p>
        <p className="text-snow/60 text-sm leading-relaxed mb-5 max-w-xs mx-auto">{body}</p>
        {action && (
          <button onClick={action.onClick} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity">
            {action.label} →
          </button>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, color, icon, highlight }: {
  value: number | string
  label: string
  color: string
  icon: string
  highlight?: boolean
}) {
  if (highlight) {
    return (
      <div className="relative bg-chestnut rounded-2xl p-3 shadow-md overflow-hidden">
        <span className="absolute -bottom-2 -right-1 text-4xl opacity-25 pointer-events-none select-none">{icon}</span>
        <p className="text-snow text-2xl font-black tracking-tight leading-none">{value}</p>
        <p className="text-snow/70 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
      </div>
    )
  }
  return (
    <div className="relative bg-white rounded-2xl p-3 shadow-sm overflow-hidden">
      <span className="absolute -bottom-2 -right-1 text-4xl opacity-10 pointer-events-none select-none">{icon}</span>
      <p className={`text-2xl font-black tracking-tight leading-none ${color}`}>{value}</p>
      <p className="text-charcoal text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
    </div>
  )
}

function TabButton({ icon, label, active, onClick, badge }: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button onClick={onClick} className="py-1 flex flex-col items-center gap-1 transition-colors relative">
      <div className={`relative w-11 h-9 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-chestnut shadow-md' : ''}`}>
        <span className="text-lg leading-none">{icon}</span>
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-chestnut border-2 border-graphite rounded-full text-[9px] text-snow font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-chestnut' : 'text-snow/50'}`}>{label}</span>
    </button>
  )
}

function ProfileField({ label, value, editing, onChange, multiline, placeholder }: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">{label}</p>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={3}
            className="w-full bg-snow rounded-xl px-3 py-2 text-sm text-graphite focus:outline-none resize-none border border-charcoal/10"
            placeholder={placeholder}
          />
        ) : (
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-snow rounded-xl px-3 py-2 text-sm text-graphite focus:outline-none border border-charcoal/10"
            placeholder={placeholder}
          />
        )
      ) : (
        <p className="text-graphite text-sm">
          {value || <span className="text-charcoal/50">{placeholder || 'Not set'}</span>}
        </p>
      )}
    </div>
  )
}
