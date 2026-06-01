'use client'

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { GENRE_GROUPS } from '@/lib/genres'
import { Avatar } from '@/components/Avatar'
import MessagingTab, { MessagingTabRef } from '@/components/MessagingTab'
import { useToast } from '@/components/Toast'
import NotificationBell from '@/components/NotificationBell'
import SaveButton from '@/components/SaveButton'
import AddToCalendar from '@/components/AddToCalendar'
import { getSavedSet, savedKey } from '@/lib/saved'
import { gigStartEnd } from '@/lib/ics'
import { TIME_OPTIONS, endTimeOptions } from '@/lib/time'
import { groupReputations, type RepSummary } from '@/lib/reviews'
import { RatingBadge } from '@/components/RatingBadge'
import InvitePeopleModal from '@/components/InvitePeopleModal'
import {
  SkeletonStatCard,
  SkeletonBookingCard,
  SkeletonMusicianCard,
} from '@/components/Skeleton'

// localStorage flag so the "You're all set!" modal shows once per completed
// Stripe onboarding instead of on every reload of the ?stripe=success URL.
const STRIPE_CELEBRATED_KEY = 'du_stripe_celebrated'

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
  rawStartDatetime: string
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
  source: string
  inviteAccepted: boolean | null
}

interface MusicianProfile {
  name: string
  bio: string
  avatar: string
  genres: string[]
  instagram: string
  youtube: string
  spotify: string
  tiktok: string
  website: string
  legalName: string
  performerType: 'solo' | 'band' | ''
  bandMembers: number | null
}

interface MusicianAvailSlot {
  id: string
  date: string
  dateLabel: string
  start_time: string | null
  end_time: string | null
  genres: string[]
  min_pay: number | null
  notes: string | null
  status: string
}

// ---- Constants ----

const INITIAL_PROFILE: MusicianProfile = {
  name: 'Your Name',
  bio: '',
  avatar: '',
  genres: [],
  instagram: '',
  youtube: '',
  spotify: '',
  tiktok: '',
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
  const [invitePeopleOpen, setInvitePeopleOpen] = useState(false)
  const [gigs, setGigs] = useState<Gig[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [profile, setProfile] = useState<MusicianProfile>(INITIAL_PROFILE)

  // Loading states
  const [dataLoading, setDataLoading] = useState(true)
  const [gigsLoading, setGigsLoading] = useState(true)

  // Gig browsing
  const [gigSearch, setGigSearch] = useState('')
  const [gigGenreFilters, setGigGenreFilters] = useState<string[]>([])
  const [gigSortBy, setGigSortBy] = useState<'date' | 'pay-high' | 'pay-low' | 'distance'>('date')
  const [gigGenrePanelOpen, setGigGenrePanelOpen] = useState(false)
  const [showSavedGigsOnly, setShowSavedGigsOnly] = useState(false)
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null)
  // Aggregate reputation per venue, keyed by venue (restaurant) id, for browse cards.
  const [venueReps, setVenueReps] = useState<Map<string, RepSummary>>(new Map())

  // Apply modal
  const [applyGigId, setApplyGigId] = useState<string | null>(null)
  const [applyNote, setApplyNote] = useState('')

  // Saved gigs (bookmarks)
  const [savedGigs, setSavedGigs] = useState<Set<string>>(new Set())
  const setSavedKey = (key: string, on: boolean) =>
    setSavedGigs(prev => {
      const next = new Set(prev)
      if (on) next.add(key); else next.delete(key)
      return next
    })

  // Messaging
  const messagingRef = useRef<MessagingTabRef>(null)
  const [msgUnread, setMsgUnread] = useState(0)

  // Return from profile page → messages tab
  useEffect(() => {
    const go = sessionStorage.getItem('drumup_goto_messages')
    if (go) { sessionStorage.removeItem('drumup_goto_messages'); setActiveTab('messages') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Bookings tab
  type BookingFilter = 'pending' | 'confirmed' | 'cancelled' | 'all'
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('pending')
  const [bookingsDisplayCount, setBookingsDisplayCount] = useState(10)
  const [bookingArchiveOpen, setBookingArchiveOpen] = useState(false)

  // Cancellation
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState(false)

  // Stripe Connect
  const [stripeOnboarded, setStripeOnboarded] = useState<boolean | null>(null)
  const [stripeConnecting, setStripeConnecting] = useState(false)
  const [stripeSuccess, setStripeSuccess] = useState(false)
  const [showStripeExplainModal, setShowStripeExplainModal] = useState(false)
  const [showStripeRefreshModal, setShowStripeRefreshModal] = useState(false)

  // Musician availability
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false)
  const [myAvailability, setMyAvailability] = useState<MusicianAvailSlot[]>([])
  const [availLoading, setAvailLoading] = useState(false)
  const [profileLat, setProfileLat] = useState<number | null>(null)
  const [profileLon, setProfileLon] = useState<number | null>(null)

  // ---- Data loading ----

  const loadMyBookings = async (uid: string, myLat: number | null, myLon: number | null) => {
    try {
      const { data: myBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('id, availability_id, restaurant_id, status, pay_amount, note, created_at, payment_status, payout_released, source, invite_accepted')
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
            rawStartDatetime: avail ? `${avail.date}T${avail.start_time ?? '00:00:00'}` : '',
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
          source: (b as Record<string, unknown>).source as string ?? 'application',
          inviteAccepted: (b as Record<string, unknown>).invite_accepted as boolean | null ?? null,
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
        void getSavedSet(user.id).then(setSavedGigs)

        // legal_name and stripe_account_id are column-revoked from the client role
        // (see migration 2026_06_01_profiles_column_security.sql) — they must be read
        // through the get_my_private_profile() RPC, which returns only the caller's own row.
        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('full_name, bio, avatar_url, instagram_url, youtube_url, spotify_url, tiktok_url, website, role_metadata, performer_type, band_members, latitude, longitude, max_distance_miles')
          .eq('id', user.id).maybeSingle()
        if (profileErr) throw profileErr
        if (!data) return

        const { data: priv } = await supabase.rpc('get_my_private_profile').maybeSingle()
        const privateFields = (priv ?? {}) as { legal_name?: string | null; stripe_account_id?: string | null; stripe_onboarded?: boolean | null }

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
          tiktok: (data as Record<string, unknown>).tiktok_url as string ?? '',
          website: data.website ?? '',
          legalName: privateFields.legal_name ?? '',
          performerType: pt === 'solo' || pt === 'band' ? pt : '',
          bandMembers: (data as Record<string, unknown>).band_members as number | null ?? null,
        })
        // Treat the musician as onboarded only if the flag is set AND a Stripe
        // account ID actually exists. If the ID was removed (e.g. deleted in
        // Supabase, or cleared because the account became invalid), they must
        // redo onboarding — so we show the "connect bank" prompts.
        const hasStripeAccount = !!privateFields.stripe_account_id
        const onboardedFlag = privateFields.stripe_onboarded ?? false
        setStripeOnboarded(onboardedFlag && hasStripeAccount)

        const myLat = data.latitude as number | null
        const myLon = data.longitude as number | null
        const maxMiles = (data.max_distance_miles as number | null) ?? 20

        setProfileLat(myLat)
        setProfileLon(myLon)

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
          .eq('is_private', false)
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

        // Reputation badges for the venues in view (one query, grouped client-side).
        void supabase.from('reviews').select('reviewee_id, rating, tags').in('reviewee_id', venueIds)
          .then(({ data: revRows }) => {
            if (revRows) setVenueReps(groupReputations(revRows as { reviewee_id: string; rating: number; tags: string[] | null }[]))
          })

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
              avatar: v?.avatar_url || '',
            },
            date: dateLabel,
            rawDate: s.date,
            rawStartDatetime: `${s.date}T${s.start_time ?? '00:00:00'}`,
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

  // Load analytics and availability when profile tab is first opened
  useEffect(() => {
    if (activeTab === 'profile' && userId) {
      loadAnalytics(userId)
      void loadMyAvailability(userId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId])

  // Clear newly-confirmed badge and refresh bookings when the musician opens the tab, so
  // invite responses / confirmations made elsewhere (messages, other party) are reflected.
  useEffect(() => {
    if (activeTab === 'bookings') {
      setNewlyConfirmed(0)
      if (userId) void loadMyBookings(userId, profileLat, profileLon)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        tiktok_url: profileDraft.tiktok || null,
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

  const checkStripeStatus = async (): Promise<boolean> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false
      const res = await fetch('/api/stripe/connect/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json() as { onboarded: boolean }
      if (res.ok) {
        setStripeOnboarded(data.onboarded)
        return data.onboarded
      }
    } catch (err) {
      console.error('Stripe status check failed:', err)
    }
    return false
  }

  const connectStripe = async () => {
    setStripeConnecting(true)
    // Starting a fresh setup — allow the success modal to show once when they return.
    if (typeof window !== 'undefined') localStorage.removeItem(STRIPE_CELEBRATED_KEY)
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
      // Strip the param immediately so a refresh / tab-restore of this URL can't
      // re-trigger the modal. We only celebrate once per completed onboarding:
      // the flag is cleared in connectStripe() when a new setup is started.
      window.history.replaceState({}, '', window.location.pathname)
      void checkStripeStatus().then(onboarded => {
        if (onboarded && localStorage.getItem(STRIPE_CELEBRATED_KEY) !== '1') {
          setStripeSuccess(true)
          localStorage.setItem(STRIPE_CELEBRATED_KEY, '1')
        }
      })
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

  const loadMyAvailability = async (uid: string) => {
    setAvailLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('musician_availability')
        .select('id, date, start_time, end_time, genres, min_pay, notes, status')
        .eq('musician_id', uid)
        // Only the musician's own public, still-open postings belong in this list.
        // Cancelled slots (via the X) must stay gone on reload, and is_private slots are
        // one-off offers shared in chat — managed there, not as public availability.
        .eq('status', 'open')
        .eq('is_private', false)
        .gte('date', today)
        .order('date', { ascending: true })
      if (data) {
        setMyAvailability(data.map(s => ({
          id: s.id,
          date: s.date,
          dateLabel: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          start_time: s.start_time?.slice(0, 5) ?? null,
          end_time: s.end_time?.slice(0, 5) ?? null,
          genres: Array.isArray(s.genres) ? s.genres : [],
          min_pay: s.min_pay != null ? Number(s.min_pay) : null,
          notes: s.notes ?? null,
          status: s.status,
        })))
      }
    } catch (err) {
      console.error('Failed to load availability:', err)
    } finally {
      setAvailLoading(false)
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

      // Fire-and-forget: notify restaurant of new application
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        fetch('/api/notifications/new-application', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ booking_id: newBooking.id }),
        }).catch(err => console.error('[Email] new-application failed:', err))
      })

      const booking: Booking = {
        id: newBooking.id,
        gig,
        status: 'pending',
        price: gig.budget,
        note: applyNote,
        paymentStatus: null,
        payoutReleased: false,
        source: 'application',
        inviteAccepted: null,
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

  const handleRespondInvite = async (bookingId: string, response: 'accept' | 'decline') => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Please log in again.'); return }

      const res = await fetch('/api/bookings/respond-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: bookingId, response }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to respond')

      if (response === 'accept') {
        setBookings(prev => prev.map(b =>
          b.id === bookingId ? { ...b, inviteAccepted: true } : b
        ))
        toast.success('Invite accepted! The venue will be notified to complete payment.')
      } else {
        setBookings(prev => prev.map(b =>
          b.id === bookingId ? { ...b, inviteAccepted: false, status: 'cancelled' } : b
        ))
        toast.info('Invite declined.')
      }
    } catch (err) {
      console.error('Respond invite failed:', err)
      toast.error(err instanceof Error ? err.message : 'Could not respond to invite. Please try again.')
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

  const handleCancelBooking = async () => {
    if (!cancelBookingId || !userId) return
    setCancellingBooking(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { toast.error('Please log in again.'); return }

      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ bookingId: cancelBookingId, cancelledBy: 'musician' }),
      })
      const data = await res.json() as { success?: boolean; banned?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Cancellation failed')

      setBookings(prev => prev.map(b => b.id === cancelBookingId ? { ...b, status: 'cancelled' } : b))
      setCancelBookingId(null)

      if (data.banned) {
        toast.error('Your booking was cancelled within 48 hours. Your account has been suspended per our policy.')
        setTimeout(async () => {
          await supabase.auth.signOut()
          router.replace('/auth/login?banned=1')
        }, 3000)
        return
      }

      toast.success('Booking cancelled. The restaurant has been notified.')

      // Fire-and-forget cancellation email
      void fetch('/api/notifications/cancellation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: cancelBookingId, cancelled_by: 'musician' }),
      }).catch(err => console.error('[Email] cancellation notification failed:', err))
    } catch (err) {
      console.error('Cancel booking failed:', err)
      toast.error(err instanceof Error ? err.message : 'Could not cancel booking. Please try again.')
    } finally {
      setCancellingBooking(false)
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
  // Local instant a gig actually ends, cross-midnight aware (see gigStartEnd). rawStart/
  // rawEndDatetime are `${date}T${time}`; slice(11) pulls the time. Falls back to end-of-
  // day when end is unknown, matching prior behavior.
  const gigEndsAt = (g: Gig): Date =>
    gigStartEnd(g.rawDate, g.rawStartDatetime.slice(11) || null, g.rawEndDatetime.slice(11) || '23:59').end
  // What the musician actually receives after the 8% platform fee. Mirrors the
  // per-booking rounding in /api/stripe/release-payout so totals match real payouts.
  const netPay = (gross: number): number => {
    const fee = Math.round(gross * 0.08 * 100) / 100
    return Math.round((gross - fee) * 100) / 100
  }
  const upcomingGigs = bookings.filter(b => b.status === 'confirmed' && gigEndsAt(b.gig) >= now).length
  const pendingApps = bookings.filter(b => b.status === 'pending').length
  const totalEarned = bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + netPay(b.price), 0)
  const filteredGigs = gigs
    .filter(g => {
      const q = gigSearch.toLowerCase()
      const matchSearch = !q || g.venue.name.toLowerCase().includes(q) || g.genres.some(x => x.toLowerCase().includes(q))
      const matchGenre = gigGenreFilters.length === 0 || gigGenreFilters.some(f => g.genres.includes(f))
      const matchSaved = !showSavedGigsOnly || savedGigs.has(savedKey('gig', g.id))
      return matchSearch && matchGenre && matchSaved
    })
    .sort((a, b) => {
      if (gigSortBy === 'pay-high') return b.budget - a.budget
      if (gigSortBy === 'pay-low') return a.budget - b.budget
      if (gigSortBy === 'distance') return parseFloat(a.venue.distance) - parseFloat(b.venue.distance)
      return a.rawDate.localeCompare(b.rawDate)
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
          <div className="flex items-center gap-1">
            <NotificationBell userId={userId} />
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
                      <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> View Profile
                    </button>
                    <button onClick={() => { router.push('/settings'); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Settings
                    </button>
                    <div className="border-t border-charcoal/10" />
                    <button onClick={() => { handleLogout(); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-medium text-charcoal hover:bg-snow transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg> Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* Payout setup banner */}
        {stripeOnboarded === false && (
          <div className="bg-chestnut rounded-2xl px-4 py-4 mb-4 flex items-center gap-3">
            <svg className="w-6 h-6 text-snow shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
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
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.18] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 13)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-chestnut opacity-[0.18] blur-2xl pointer-events-none" />
              <span className="absolute top-3 right-3 bg-chestnut text-snow text-[9px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full shadow-md uppercase z-20">
                {profile.performerType === 'band' ? <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Band</span> : <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>Solo Artist</span>}
              </span>
              <div className="relative z-10 p-6 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-inner border-2 border-chestnut/40" />
                  : <div className="w-16 h-16 rounded-2xl bg-chestnut/20 border-2 border-chestnut/40 flex items-center justify-center shrink-0 shadow-inner text-chestnut"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Musician</p>
                  <p className="text-snow font-black text-xl leading-tight truncate">{profile.name || 'Your Name'}</p>
                  <p className="text-snow/55 text-xs mt-1 truncate">
                    {profile.genres.length > 0 ? profile.genres.slice(0, 3).join(' · ') : 'Set your genres in Profile'}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setActiveTab('gigs')}
                    className="bg-chestnut text-snow px-5 py-2.5 rounded-xl text-sm font-black hover:opacity-90 transition-opacity shadow-lg"
                  >
                    Browse Gigs
                  </button>
                  <button
                    onClick={() => setShowAvailabilityModal(true)}
                    className="bg-white/15 text-snow px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-white/25 transition-colors border border-white/20"
                  >
                    Post Availability
                  </button>
                </div>
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
                <StatCard value={upcomingGigs} label="Upcoming" color="text-teal" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>} />
                <StatCard value={pendingApps} label="Pending" color="text-chestnut" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>} />
                <StatCard value={`$${totalEarned.toFixed(2)}`} label="Earned" color="text-graphite" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} highlight />
              </div>
            )}

            {/* Newly confirmed notification banner */}
            {newlyConfirmed > 0 && (
              <div className="bg-teal/10 border border-teal/30 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
                <svg className="w-6 h-6 text-teal shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2z"/></svg>
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
                  {bookings.filter(b => b.status === 'confirmed' && gigEndsAt(b.gig) >= now).map(b => {
                    const [, datePart] = b.gig.date.split(', ')
                    const [mon, day] = (datePart || '').split(' ')
                    return (
                      <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                        <div className="bg-chestnut/15 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                          <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">{mon}</p>
                          <p className="text-chestnut text-2xl font-black leading-tight">{day}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-graphite font-bold text-sm truncate">{b.gig.venue.name}</p>
                          <p className="text-charcoal text-xs mt-0.5">{b.gig.time}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {b.gig.genres.map(g => (
                              <span key={g} className="text-[10px] bg-charcoal/10 text-charcoal px-2.5 py-0.5 rounded-full font-semibold">{g}</span>
                            ))}
                          </div>
                          <div className="mt-2">
                            <AddToCalendar
                              filename={`gig-${b.gig.venue.name}`}
                              event={{
                                uid: b.id,
                                title: `Gig at ${b.gig.venue.name}`,
                                description: `Live music gig at ${b.gig.venue.name}. Pay: $${b.price}.`,
                                location: b.gig.venue.name,
                                ...gigStartEnd(b.gig.rawDate, b.gig.rawStartDatetime.slice(11), b.gig.rawEndDatetime.slice(11)),
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-teal text-lg font-black">${b.price}</p>
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

            {/* Pending applications + invites */}
            <SectionHeader eyebrow="Inbox" title="Pending" accent="Activity." />
            {dataLoading ? (
              <div className="space-y-3">
                <SkeletonBookingCard />
                <SkeletonBookingCard />
                <SkeletonBookingCard />
              </div>
            ) : pendingApps === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
                title="No pending activity"
                body="Browse open gig slots and apply to restaurants looking for live music."
                action={{ label: 'Browse Open Gigs', onClick: () => setActiveTab('gigs') }}
              />
            ) : (
              <div className="space-y-3">
                {bookings.filter(b => b.status === 'pending').map(b => {
                  const isInvite = b.source === 'invite'
                  const inviteAwaiting = isInvite && b.inviteAccepted === null
                  const inviteAccepted = isInvite && b.inviteAccepted === true

                  return (
                    <div
                      key={b.id}
                      className={`bg-white rounded-2xl p-4 shadow-sm ${isInvite ? 'border-l-4 border-l-chestnut' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar src={b.gig.venue.avatar} className="w-10 h-10 rounded-full" textSize="text-xl" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-graphite font-bold text-sm">{b.gig.venue.name}</p>
                              {isInvite && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-chestnut/10 text-chestnut uppercase tracking-wide">
                                  Invite
                                </span>
                              )}
                            </div>
                            <p className="text-charcoal text-xs">{b.gig.date} · {b.gig.time}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-teal font-black text-sm">${b.price}</p>
                          {inviteAccepted && (
                            <span className="text-[10px] font-bold text-teal block mt-0.5">Awaiting payment</span>
                          )}
                          {!isInvite && <div className="mt-1"><BookingBadge status={b.status} /></div>}
                        </div>
                      </div>

                      {b.note && (
                        <div className="bg-snow rounded-xl px-3 py-2 mb-2">
                          <p className="text-charcoal text-xs italic">
                            {isInvite ? 'Note from venue: ' : 'Your note: '}
                            &ldquo;{b.note}&rdquo;
                          </p>
                        </div>
                      )}

                      {inviteAwaiting && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleRespondInvite(b.id, 'decline')}
                            className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleRespondInvite(b.id, 'accept')}
                            className="flex-1 bg-chestnut text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                          >
                            Accept Invite
                          </button>
                        </div>
                      )}

                      {inviteAccepted && (
                        <p className="text-charcoal/50 text-xs mt-2 text-center">
                          You accepted — the venue is completing payment.
                        </p>
                      )}

                      {!isInvite && (
                        <div className="flex justify-end mt-1">
                          <button
                            onClick={() => handleCancelApplication(b.id)}
                            className="text-charcoal/60 text-xs font-medium hover:text-red-500 transition-colors"
                          >
                            Cancel Application
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
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
            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                value={gigSearch}
                onChange={e => setGigSearch(e.target.value)}
                placeholder="Search by venue name..."
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>

            {/* Sort + Genre filter row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5 flex-1 overflow-x-auto pb-0.5 no-scrollbar">
                {([
                  { key: 'date' as const, label: 'Soonest' },
                  { key: 'pay-high' as const, label: 'Top Pay' },
                  { key: 'pay-low' as const, label: 'Low Pay' },
                  { key: 'distance' as const, label: 'Nearest' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setGigSortBy(opt.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${gigSortBy === opt.key ? 'bg-chestnut text-snow shadow-sm' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
                  >{opt.label}</button>
                ))}
                <button
                  onClick={() => setShowSavedGigsOnly(s => !s)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${showSavedGigsOnly ? 'bg-chestnut text-snow shadow-sm' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill={showSavedGigsOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                  Saved
                </button>
              </div>
              <button
                onClick={() => setGigGenrePanelOpen(o => !o)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${gigGenrePanelOpen || gigGenreFilters.length > 0 ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/></svg>
                Genres{gigGenreFilters.length > 0 ? ` (${gigGenreFilters.length})` : ''}
              </button>
            </div>

            {/* Active genre tags */}
            {gigGenreFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {gigGenreFilters.map(g => (
                  <span key={g} className="inline-flex items-center gap-1 bg-graphite text-snow px-2.5 py-1 rounded-full text-xs font-semibold">
                    {g}
                    <button onClick={() => setGigGenreFilters(prev => prev.filter(x => x !== g))} className="hover:opacity-70 transition-opacity leading-none">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setGigGenreFilters([])}
                  className="text-charcoal/50 text-xs font-medium hover:text-chestnut transition-colors px-1 self-center"
                >Clear all</button>
              </div>
            )}

            {/* Genre picker panel */}
            {gigGenrePanelOpen && (
              <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-charcoal/[0.06]">
                <div className="space-y-3.5">
                  {GENRE_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-charcoal/40 text-[10px] font-bold uppercase tracking-widest mb-2">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.genres.map(g => {
                          const selected = gigGenreFilters.includes(g)
                          return (
                            <button
                              key={g}
                              onClick={() => setGigGenreFilters(prev => selected ? prev.filter(x => x !== g) : [...prev, g])}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${selected ? 'bg-chestnut text-snow shadow-sm' : 'bg-snow text-charcoal hover:bg-[#E8E4E0]'}`}
                            >{g}</button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {gigsLoading ? (
              <div className="space-y-3">
                <SkeletonMusicianCard />
                <SkeletonMusicianCard />
                <SkeletonMusicianCard />
                <SkeletonMusicianCard />
              </div>
            ) : filteredGigs.length === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>}
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
                          <RatingBadge rep={venueReps.get(gig.venue.id)} className="mt-0.5" />
                        </div>
                      </div>
                      <div className="flex items-start gap-1 shrink-0">
                        <div className="text-right">
                          <p className="text-teal font-black text-xl">${gig.budget}</p>
                          <p className="text-charcoal/50 text-[9px] font-semibold uppercase tracking-wide">pay offered</p>
                        </div>
                        <SaveButton
                          userId={userId}
                          type="gig"
                          id={gig.id}
                          saved={savedGigs.has(savedKey('gig', gig.id))}
                          onChange={(next) => setSavedKey(savedKey('gig', gig.id), next)}
                        />
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
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
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
            .filter(b => b.status === 'confirmed' && gigEndsAt(b.gig) >= tabNow)
            .sort((a, b) => gigEndsAt(a.gig).getTime() - gigEndsAt(b.gig).getTime())
          const pastGigs = bookings
            .filter(b => b.status === 'confirmed' && gigEndsAt(b.gig) < tabNow)
            .sort((a, b) => gigEndsAt(b.gig).getTime() - gigEndsAt(a.gig).getTime())
          const cancelledBookings = bookings.filter(b => b.status === 'cancelled')
          const pendingEarnings = bookings
            .filter(b => b.status === 'confirmed' && b.paymentStatus === 'authorized' && !b.payoutReleased)
            .reduce((s, b) => s + netPay(b.price), 0)
          const releasedEarnings = bookings
            .filter(b => b.status === 'confirmed' && b.paymentStatus === 'paid' && b.payoutReleased)
            .reduce((s, b) => s + netPay(b.price), 0)
          const totalConfirmedEarnings = bookings
            .filter(b => b.status === 'confirmed')
            .reduce((s, b) => s + netPay(b.price), 0)

          const filteredBookings = (() => {
            switch (bookingFilter) {
              case 'pending': return pendingBookings
              case 'confirmed': return upcomingConfirmed
              case 'cancelled': return cancelledBookings
              case 'all': return [...pendingBookings, ...upcomingConfirmed, ...cancelledBookings]
            }
          })()

          const archiveItems = pastGigs

          return (
            <>
              <div className="mb-5">
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">The Setlist</p>
                <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                  My <span className="text-chestnut italic">Bookings.</span>
                </h2>
              </div>

              {/* Earnings summary */}
              {totalConfirmedEarnings > 0 && (
                <div className="bg-graphite rounded-2xl p-4 mb-5 shadow-sm">
                  <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">Earnings</p>
                  <div className="grid grid-cols-3 divide-x divide-white/10">
                    <div className="pr-3">
                      <p className="text-snow text-2xl font-black">${totalConfirmedEarnings.toFixed(2)}</p>
                      <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Total</p>
                    </div>
                    <div className="px-3">
                      <p className="text-chestnut text-2xl font-black">${pendingEarnings.toFixed(2)}</p>
                      <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Authorized</p>
                    </div>
                    <div className="pl-3">
                      <p className="text-teal text-2xl font-black">${releasedEarnings.toFixed(2)}</p>
                      <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Released</p>
                    </div>
                  </div>
                  {pendingEarnings > 0 && (
                    <p className="text-snow/50 text-xs mt-3 leading-relaxed">
                      ${pendingEarnings.toFixed(2)} is authorized and will be released to your bank after each gig date passes.
                    </p>
                  )}
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                {([
                  { key: 'pending' as const, label: 'Pending', count: pendingBookings.length },
                  { key: 'confirmed' as const, label: 'Confirmed', count: upcomingConfirmed.length },
                  { key: 'cancelled' as const, label: 'Cancelled', count: cancelledBookings.length },
                  { key: 'all' as const, label: 'All', count: pendingBookings.length + upcomingConfirmed.length + cancelledBookings.length },
                ]).map(({ key, label, count }) => (
                  <button
                    key={key}
                    onClick={() => { setBookingFilter(key); setBookingsDisplayCount(10) }}
                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${bookingFilter === key ? 'bg-chestnut text-snow shadow-sm' : 'bg-white text-charcoal border border-charcoal/15 hover:bg-[#E8E4E0]'}`}
                  >
                    {label}
                    {count > 0 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${bookingFilter === key ? 'bg-snow/25 text-snow' : 'bg-charcoal/10 text-charcoal'}`}>{count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Filtered list */}
              {dataLoading ? (
                <div className="space-y-3">
                  <SkeletonBookingCard /><SkeletonBookingCard /><SkeletonBookingCard />
                </div>
              ) : filteredBookings.length === 0 ? (
                <EmptyState
                  icon={bookingFilter === 'pending' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> : bookingFilter === 'confirmed' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
                  title={bookingFilter === 'pending' ? 'No pending applications' : bookingFilter === 'confirmed' ? 'No upcoming gigs' : 'Nothing here'}
                  body={bookingFilter === 'pending' ? 'Browse open gig slots and apply to restaurants looking for live music.' : bookingFilter === 'confirmed' ? 'Keep applying! Confirmed gigs will appear here.' : ''}
                  action={bookingFilter === 'pending' ? { label: 'Browse Open Gigs', onClick: () => setActiveTab('gigs') } : undefined}
                />
              ) : (
                <>
                  <p className="text-charcoal/50 text-xs mb-3">Showing {Math.min(bookingsDisplayCount, filteredBookings.length)} of {filteredBookings.length}</p>
                  <div className="space-y-3 mb-4">
                    {filteredBookings.slice(0, bookingsDisplayCount).map(b => {
                      const isPast = gigEndsAt(b.gig) < tabNow
                      const [, datePart] = b.gig.date.split(', ')
                      const [mon, day] = (datePart || '').split(' ')
                      if (b.status === 'pending') {
                        return (
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
                              <button onClick={() => openConversationWithVenue(b.gig)} className="inline-flex items-center gap-1 text-charcoal/60 text-xs font-medium hover:text-chestnut transition-colors"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message Venue</button>
                              <button onClick={() => handleCancelApplication(b.id)} className="text-charcoal/60 text-xs font-medium hover:text-red-500 transition-colors">Cancel Application</button>
                            </div>
                          </div>
                        )
                      }
                      if (b.status === 'confirmed') {
                        const isFutureGig = new Date(b.gig.rawDate + 'T23:59:59') >= tabNow
                        return (
                          <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-[#6C9A8B]">
                            <div className="flex items-center gap-3">
                              <div className="bg-teal/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                                <p className="text-teal text-[10px] font-black uppercase tracking-wide">{mon}</p>
                                <p className="text-teal text-2xl font-black leading-tight">{day}</p>
                              </div>
                              <div className="flex-1 min-w-0">
                                <button onClick={() => router.push('/profile/' + b.gig.venue.id)} className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left block">{b.gig.venue.name}</button>
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
                                  <span className="inline-block bg-chestnut/10 text-chestnut text-[10px] font-black px-2 py-0.5 rounded-full mt-1">Auth&apos;d</span>
                                ) : null}
                                <button onClick={() => openConversationWithVenue(b.gig)} className="inline-flex items-center gap-1 text-charcoal/60 text-[10px] font-medium hover:text-chestnut transition-colors mt-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message</button>
                              </div>
                            </div>
                            {isFutureGig && (
                              <div className="flex justify-end mt-2 pt-2 border-t border-charcoal/[0.06]">
                                <button
                                  onClick={() => setCancelBookingId(b.id)}
                                  className="text-red-400 text-xs font-semibold hover:text-red-600 transition-colors"
                                >
                                  Cancel Booking
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      }
                      // cancelled
                      return (
                        <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm opacity-70 border-l-4 border-l-charcoal/20">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <button onClick={() => router.push('/profile/' + b.gig.venue.id)} className="text-graphite font-bold text-sm hover:text-chestnut transition-colors text-left block">{b.gig.venue.name}</button>
                              <p className="text-charcoal/60 text-xs">{b.gig.date} · {b.gig.time}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-charcoal/50 font-black text-sm">${b.price}</p>
                              <span className="inline-block bg-charcoal/10 text-charcoal text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5">Cancelled</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {filteredBookings.length > bookingsDisplayCount && (
                    <button
                      onClick={() => setBookingsDisplayCount(n => n + 10)}
                      className="w-full py-3 rounded-xl border border-charcoal/20 text-charcoal text-sm font-semibold hover:bg-white/60 transition-colors"
                    >
                      Load more
                    </button>
                  )}
                </>
              )}

              {/* Archive section — past gigs */}
              {archiveItems.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setBookingArchiveOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/60 rounded-xl border border-charcoal/10 hover:bg-white/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-charcoal/50 transition-transform ${bookingArchiveOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-charcoal text-sm font-bold">Archive</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-charcoal/10 text-charcoal/60">{archiveItems.length}</span>
                    </div>
                    <span className="text-charcoal/40 text-xs">Past completed gigs</span>
                  </button>

                  {bookingArchiveOpen && (
                    <div className="mt-3 space-y-3">
                      {archiveItems.slice(0, 10).map(b => (
                        <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm opacity-70" style={{ filter: 'grayscale(20%)' }}>
                          <div className="flex items-center gap-3">
                            <div className="bg-charcoal/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                              <p className="text-charcoal/60 text-[10px] font-black uppercase tracking-wide">{b.gig.date.split(' ')[0]}</p>
                              <p className="text-charcoal/60 text-2xl font-black leading-tight">{b.gig.date.split(' ')[2]?.replace(',', '')}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <button onClick={() => router.push('/profile/' + b.gig.venue.id)} className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left block">{b.gig.venue.name}</button>
                              <p className="text-charcoal text-xs mt-0.5">{b.gig.time}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-charcoal/60 font-black">${b.price}</p>
                              <span className="inline-flex items-center gap-0.5 bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full mt-1">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                Completed
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => { try { sessionStorage.setItem('drumup_open_review', '1') } catch { /* ignore */ } ; router.push('/profile/' + b.gig.venue.id) }}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 border border-chestnut/40 text-chestnut py-2 rounded-xl text-xs font-bold hover:bg-chestnut/10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            Review {b.gig.venue.name.split(' ')[0]}
                          </button>
                        </div>
                      ))}
                      {archiveItems.length > 10 && (
                        <p className="text-center text-charcoal/40 text-xs py-2">+{archiveItems.length - 10} more past gigs</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === 'profile' && (
          <>
            {/* Header */}
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">· The Artist</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Your <span className="text-chestnut italic">Profile.</span>
              </h2>
            </div>

            {/* Hero artist card */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-4 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 17)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-40 h-40 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <div className="relative z-10 p-6">
                {/* Avatar + name row */}
                <div className="flex items-start gap-4 mb-4">
                  {profile.avatar
                    ? <img src={profile.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-inner border-2 border-chestnut/40" />
                    : <div className="w-20 h-20 rounded-2xl bg-chestnut/20 border-2 border-chestnut/40 flex items-center justify-center shrink-0 shadow-inner text-chestnut">
                        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                      </div>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {profile.performerType === 'solo' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-teal/20 text-teal">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                          Solo Artist
                        </span>
                      )}
                      {profile.performerType === 'band' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-chestnut/30 text-chestnut">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                          Band{profile.bandMembers ? ` · ${profile.bandMembers}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-snow font-black text-2xl leading-tight tracking-tight">{profile.name || 'Your Name'}</p>
                  </div>
                </div>
                {/* Bio */}
                {profile.bio && (
                  <p className="text-snow/70 text-sm leading-relaxed mb-4">{profile.bio}</p>
                )}
                {/* Genre pills */}
                {profile.genres.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.genres.map(g => (
                      <span key={g} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-snow/80 border border-white/10">{g}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => router.push('/profile/' + userId)}
                className="flex items-center justify-center gap-2 bg-chestnut text-snow py-3.5 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                View Profile
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="flex items-center justify-center gap-2 bg-white text-graphite py-3.5 rounded-2xl font-bold text-sm hover:shadow-md transition-shadow shadow-sm border border-charcoal/[0.07]"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                Edit Profile
              </button>
            </div>

            {/* Invite a venue you already play */}
            <button
              onClick={() => setInvitePeopleOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-teal text-snow py-3.5 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm mb-3"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invite a venue you play
            </button>

            {invitePeopleOpen && (
              <InvitePeopleModal invitedRole="restaurant" onClose={() => setInvitePeopleOpen(false)} />
            )}

            {/* Stripe Connect status */}
            {stripeOnboarded === false && (
              <button
                onClick={() => setShowStripeExplainModal(true)}
                className="w-full bg-chestnut/10 border border-chestnut/30 rounded-2xl px-5 py-4 mb-4 flex items-center gap-3 hover:bg-chestnut/15 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-chestnut/20 flex items-center justify-center shrink-0 text-chestnut">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                </div>
                <div className="flex-1">
                  <p className="text-chestnut font-bold text-sm">Connect your bank</p>
                  <p className="text-chestnut/60 text-xs mt-0.5">Set up payouts to receive payment for gigs</p>
                </div>
                <svg className="w-4 h-4 text-chestnut/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
            {stripeOnboarded === true && (
              <div className="bg-teal/10 border border-teal/20 rounded-2xl px-5 py-3.5 mb-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal/20 flex items-center justify-center shrink-0 text-teal">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-teal font-bold text-sm">Payouts connected</p>
                  <p className="text-teal/70 text-xs mt-0.5">Your bank account is ready to receive gig payments</p>
                </div>
              </div>
            )}

            {/* Payment history */}
            <button
              onClick={() => router.push('/dashboard/payments')}
              className="w-full bg-white rounded-2xl shadow-sm px-5 py-4 mb-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-teal/15 flex items-center justify-center shrink-0 text-teal">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-graphite font-bold text-sm">Payment history</p>
                <p className="text-charcoal/50 text-xs mt-0.5">View earnings, payouts & receipts</p>
              </div>
              <svg className="w-4 h-4 text-charcoal/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Visibility analytics */}
            <div className="bg-graphite rounded-2xl p-5 shadow-sm mb-4 relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.08] pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 41)} />
                ))}
              </div>
              <div className="flex items-center justify-between mb-3 relative z-10">
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em]">Visibility</p>
                <button
                  onClick={() => router.push('/dashboard/analytics')}
                  className="text-snow/70 text-xs font-bold hover:text-chestnut transition-colors flex items-center gap-1"
                >
                  Full analytics
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
              {analyticsLoading ? (
                <div className="flex gap-6">
                  {[0, 1, 2].map(i => <div key={i} className="h-10 w-16 bg-white/10 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-3 divide-x divide-white/10">
                  <div className="pr-4">
                    <p className="text-snow text-3xl font-black">{analyticsViews7d ?? '—'}</p>
                    <p className="text-snow/40 text-xs font-semibold uppercase tracking-wider mt-0.5">7 days</p>
                  </div>
                  <div className="px-4">
                    <p className="text-snow text-3xl font-black">{analyticsViews30d ?? '—'}</p>
                    <p className="text-snow/40 text-xs font-semibold uppercase tracking-wider mt-0.5">30 days</p>
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

            {/* My Availability */}
            <div className="bg-white rounded-2xl shadow-sm mb-4 overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em]">My Availability</p>
                <button
                  onClick={() => setShowAvailabilityModal(true)}
                  className="text-xs text-chestnut font-bold hover:opacity-70 transition-opacity"
                >
                  + Post Slot
                </button>
              </div>
              {availLoading ? (
                <div className="px-5 pb-4 space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-12 bg-snow rounded-xl animate-pulse" />)}
                </div>
              ) : myAvailability.length === 0 ? (
                <div className="px-5 pb-4 text-center">
                  <p className="text-charcoal/50 text-sm mb-3">No upcoming availability posted.</p>
                  <button
                    onClick={() => setShowAvailabilityModal(true)}
                    className="text-sm text-chestnut font-bold hover:opacity-70 transition-opacity"
                  >
                    Post your first slot →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-charcoal/[0.06] px-1 pb-1">
                  {myAvailability.map(slot => (
                    <div key={slot.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-graphite font-bold text-sm">{slot.dateLabel}</p>
                        {slot.start_time && slot.end_time && (
                          <p className="text-charcoal text-xs mt-0.5">{fmt(slot.start_time)} – {fmt(slot.end_time)}</p>
                        )}
                        {slot.genres.length > 0 && (
                          <p className="text-charcoal/50 text-[10px] mt-0.5 truncate">{slot.genres.slice(0, 3).join(', ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {slot.min_pay != null && (
                          <span className="text-teal text-xs font-black">${slot.min_pay}+</span>
                        )}
                        <button
                          onClick={async () => {
                            await supabase.from('musician_availability').update({ status: 'cancelled' }).eq('id', slot.id)
                            setMyAvailability(prev => prev.filter(s => s.id !== slot.id))
                          }}
                          className="text-charcoal/40 hover:text-red-500 transition-colors"
                          aria-label="Cancel slot"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
            <MessagingTab ref={messagingRef} userId={userId} currentUserType="musician" onUnreadChange={setMsgUnread} onBookingsChanged={() => { if (userId) void loadMyBookings(userId, profileLat, profileLon) }} />
          )}
        </div>
      </div>

      {/* ---- POST AVAILABILITY MODAL ---- */}
      {showAvailabilityModal && userId && (
        <PostAvailabilityModal
          userId={userId}
          myLat={profileLat}
          myLon={profileLon}
          onClose={() => setShowAvailabilityModal(false)}
          onSuccess={(slot) => {
            setMyAvailability(prev => [slot, ...prev].sort((a, b) => a.date.localeCompare(b.date)))
            setShowAvailabilityModal(false)
            toast.success('Availability posted! Restaurants can now discover you.')
          }}
        />
      )}

      {/* ---- BOTTOM TAB BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
          <TabButton animation="bounce" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="Home"     active={activeTab === 'home'}     onClick={() => setActiveTab('home')} />
          <TabButton animation="sway"   icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>} label="Gigs"     active={activeTab === 'gigs'}     onClick={() => setActiveTab('gigs')} />
          <TabButton animation="stamp"  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>} label="Bookings" active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} badge={newlyConfirmed > 0 ? newlyConfirmed : undefined} />
          <TabButton animation="pop"    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} label="Messages" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} badge={msgUnread} />
          <TabButton animation="float"  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} label="Profile"  active={activeTab === 'profile'}  onClick={() => setActiveTab('profile')} />
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
                className="text-snow/60 hover:text-snow transition-colors leading-none relative z-10"
              ><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
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
                { icon: <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, title: 'Takes about 2 minutes', text: 'You only need to do this once. After setup, payments land in your bank automatically after each gig.' },
                { icon: <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>, title: 'What you\'ll need', text: 'Your legal name, date of birth, last 4 digits of your SSN, and your bank account details.' },
                { icon: <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, title: 'Bank-level security', text: 'Your financial information is handled entirely by Stripe. Drum Up never sees or stores your sensitive data.' },
              ].map(({ icon, title, text }) => (
                <div key={title} className="flex items-start gap-3 bg-[#F5F5F5] rounded-xl px-4 py-3">
                  <span className="shrink-0 mt-0.5">{icon}</span>
                  <div>
                    <p className="text-graphite font-bold text-sm">{title}</p>
                    <p className="text-charcoal text-xs mt-0.5 leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}

              {/* Warning box */}
              <div className="flex items-start gap-3 bg-chestnut/10 border border-chestnut/40 rounded-xl px-4 py-3">
                <svg className="w-5 h-5 text-chestnut shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
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
              <h2 className="text-snow font-black text-2xl tracking-tight">You're all set!</h2>
              <p className="text-snow/60 text-sm mt-2 leading-relaxed">
                Your payout account is connected. You'll automatically receive payment within 2 business days after each completed gig.
              </p>
            </div>
            <div className="px-5 py-5 space-y-3">
              <div className="bg-[#F5F5F5] rounded-xl px-4 py-4 space-y-3">
                {['Bank account connected', 'Identity verified', 'Ready to receive payments'].map(item => (
                  <div key={item} className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-teal shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
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

      {/* ---- Cancel Booking Modal ---- */}
      {cancelBookingId && (() => {
        const booking = bookings.find(b => b.id === cancelBookingId)
        const gigMs = booking ? new Date(booking.gig.rawDate + 'T00:00:00').getTime() : Infinity
        const within48h = (gigMs - Date.now()) / 3600000 <= 48
        return (
          <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-graphite px-6 py-5">
                <h3 className="text-snow font-black text-xl tracking-tight">Cancel Booking?</h3>
                <p className="text-snow/60 text-sm mt-1">
                  {booking?.gig.venue.name} · {booking?.gig.date}
                </p>
              </div>
              <div className="px-6 py-5">
                {within48h ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                    <p className="text-red-600 font-bold text-sm mb-1">Account suspension warning</p>
                    <p className="text-red-500 text-xs leading-relaxed">
                      You are cancelling within 48 hours of your gig. Per our policy, your account will be
                      immediately suspended. Only proceed if absolutely necessary.
                    </p>
                  </div>
                ) : (
                  <p className="text-charcoal text-sm leading-relaxed mb-4">
                    The restaurant will receive a full refund. This action cannot be undone.
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCancelBookingId(null)}
                    disabled={cancellingBooking}
                    className="flex-1 bg-snow text-charcoal py-3 rounded-xl text-sm font-semibold border border-charcoal/10 hover:bg-[#E8E4E0] transition-colors disabled:opacity-50"
                  >
                    Keep Booking
                  </button>
                  <button
                    onClick={handleCancelBooking}
                    disabled={cancellingBooking}
                    className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {cancellingBooking ? 'Cancelling…' : within48h ? 'Cancel Anyway' : 'Yes, Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

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

// ---- PostAvailabilityModal ----

function getAvailDateOptions() {
  const options: { value: string; label: string }[] = []
  const today = new Date()
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const value = d.toISOString().split('T')[0]
    const prefix = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' })
    options.push({ value, label: `${prefix} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })
  }
  return options
}

function AvailSelect({ value, onChange, options, placeholder, disabled = false }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full appearance-none bg-white rounded-xl px-4 py-3 pr-10 shadow-sm border border-charcoal/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-chestnut/20 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${value ? 'text-graphite' : 'text-charcoal/40'}`}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>
    </div>
  )
}

function PostAvailabilityModal({ userId, myLat, myLon, onClose, onSuccess }: {
  userId: string
  myLat: number | null
  myLon: number | null
  onClose: () => void
  onSuccess: (slot: MusicianAvailSlot) => void
}) {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [minPay, setMinPay] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [genrePanelOpen, setGenrePanelOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggleGenre = (g: string) => {
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])
  }

  const handleSubmit = async () => {
    setError('')
    if (!date) { setError('Please select a date.'); return }
    if (!startTime) { setError('Please select a start time.'); return }
    if (!endTime) { setError('Please select an end time.'); return }

    setSubmitting(true)
    try {
      const { data, error: dbErr } = await supabase
        .from('musician_availability')
        .insert({
          musician_id: userId,
          date,
          start_time: startTime,
          end_time: endTime,
          genres: selectedGenres,
          min_pay: minPay ? Number(minPay) : null,
          notes: notes.trim() || null,
          status: 'open',
          latitude: myLat,
          longitude: myLon,
        })
        .select('id, date, start_time, end_time, genres, min_pay, notes, status')
        .single()

      if (dbErr) throw dbErr

      const slot: MusicianAvailSlot = {
        id: data.id,
        date: data.date,
        dateLabel: new Date(data.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        start_time: data.start_time?.slice(0, 5) ?? null,
        end_time: data.end_time?.slice(0, 5) ?? null,
        genres: Array.isArray(data.genres) ? data.genres : [],
        min_pay: data.min_pay != null ? Number(data.min_pay) : null,
        notes: data.notes ?? null,
        status: data.status,
      }
      onSuccess(slot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post availability')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">

        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-teal opacity-20 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-teal text-[10px] font-semibold uppercase tracking-[0.3em]">Availability</p>
            <h3 className="text-snow text-xl font-black tracking-tight">
              Post a <span className="text-teal italic">Slot.</span>
            </h3>
          </div>
          <button onClick={onClose} className="relative z-10 text-snow/60 hover:text-snow transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Date</label>
            <AvailSelect value={date} onChange={setDate} options={getAvailDateOptions()} placeholder="Pick a date" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Start Time</label>
              <AvailSelect value={startTime} onChange={v => { setStartTime(v); setEndTime('') }} options={TIME_OPTIONS} placeholder="Start" />
            </div>
            <div>
              <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">End Time</label>
              <AvailSelect value={endTime} onChange={setEndTime} options={endTimeOptions(startTime)} placeholder={startTime ? 'End' : 'Pick a start first'} disabled={!startTime} />
            </div>
          </div>

          <div>
            <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Min Pay <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/50 text-sm font-semibold">$</span>
              <input
                type="number" min="0" step="1" placeholder="e.g. 150"
                value={minPay} onChange={e => setMinPay(e.target.value)}
                className="w-full bg-white rounded-xl pl-8 pr-4 py-3 text-sm shadow-sm border border-charcoal/10 focus:outline-none focus:ring-2 focus:ring-chestnut/20"
              />
            </div>
          </div>

          <div>
            <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Genres <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
            </label>
            <button
              onClick={() => setGenrePanelOpen(o => !o)}
              className="w-full text-left bg-white rounded-xl px-4 py-3 text-sm shadow-sm border border-charcoal/10 flex items-center justify-between"
            >
              <span className={selectedGenres.length > 0 ? 'text-graphite font-medium' : 'text-charcoal/40'}>
                {selectedGenres.length > 0
                  ? selectedGenres.slice(0, 3).join(', ') + (selectedGenres.length > 3 ? ` +${selectedGenres.length - 3}` : '')
                  : 'Select genres…'}
              </span>
              <svg className={`w-4 h-4 text-charcoal/40 transition-transform ${genrePanelOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            {genrePanelOpen && (
              <div className="bg-white rounded-xl shadow-sm border border-charcoal/10 p-3 mt-1 max-h-48 overflow-y-auto">
                {GENRE_GROUPS.map((group) => (
                  <div key={group.label} className="mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-charcoal/50 mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.genres.map(g => (
                        <button
                          key={g}
                          onClick={() => toggleGenre(g)}
                          className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                            selectedGenres.includes(g)
                              ? 'bg-chestnut text-snow'
                              : 'bg-snow text-charcoal hover:bg-charcoal/10'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Notes <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
            </label>
            <textarea
              placeholder="Any details restaurants should know…"
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm border border-charcoal/10 focus:outline-none focus:ring-2 focus:ring-chestnut/20 resize-none placeholder:text-charcoal/40"
            />
          </div>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post Availability'}
          </button>
          <button onClick={onClose} disabled={submitting} className="w-full bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Sub-components ----

function SectionHeader({ title, eyebrow, accent }: { title: string; eyebrow?: string; accent?: string }) {
  return (
    <div className="mb-5 mt-3">
      {eyebrow && <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">{eyebrow}</p>}
      <h3 className="text-graphite text-[1.65rem] font-black tracking-tight leading-none">
        {title}
        {accent && <span className="text-chestnut italic"> {accent}</span>}
      </h3>
    </div>
  )
}

function EmptyState({ icon, title, body, action }: {
  icon: React.ReactNode
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
        <div className="w-16 h-16 bg-chestnut/20 border border-chestnut/30 rounded-2xl flex items-center justify-center text-chestnut mx-auto mb-4 shadow-inner">{icon}</div>
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
  icon: React.ReactNode
  highlight?: boolean
}) {
  if (highlight) {
    return (
      <div className="relative bg-chestnut rounded-2xl p-4 shadow-md overflow-hidden">
        <span className="absolute -bottom-1 -right-1 w-10 h-10 opacity-20 pointer-events-none select-none text-snow">{icon}</span>
        <p className="text-snow text-3xl font-black tracking-tight leading-none">{value}</p>
        <p className="text-snow/70 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
      </div>
    )
  }
  return (
    <div className="relative bg-white rounded-2xl p-4 shadow-sm overflow-hidden">
      <span className="absolute -bottom-1 -right-1 w-10 h-10 opacity-10 pointer-events-none select-none text-graphite">{icon}</span>
      <p className={`text-3xl font-black tracking-tight leading-none ${color}`}>{value}</p>
      <p className="text-charcoal text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
    </div>
  )
}

function TabButton({ icon, label, active, onClick, badge, animation = 'bounce' }: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
  animation?: string
}) {
  return (
    <button onClick={onClick} className={`py-1 flex flex-col items-center gap-1 transition-colors relative tab-hover-${animation}`}>
      <div className={`relative w-11 h-9 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-chestnut shadow-md' : ''}`}>
        <span className={`tab-icon w-5 h-5 ${active ? 'text-snow' : 'text-snow/50'}`}>{icon}</span>
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
