'use client'

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'
import MessagingTab, { MessagingTabRef } from '@/components/MessagingTab'
import { useToast } from '@/components/Toast'
import NotificationBell from '@/components/NotificationBell'
import { SkeletonStatCard, SkeletonBookingCard, SkeletonMusicianCard } from '@/components/Skeleton'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { buildSocialUrl } from '@/lib/social-urls'
import { GENRE_GROUPS } from '@/lib/genres'
import { GenreSelector } from '@/components/GenreSelector'
import InviteModal from '@/components/InviteModal'
import AddToCalendar from '@/components/AddToCalendar'
import { gigStartEnd } from '@/lib/ics'
import { TIME_OPTIONS, endTimeOptions } from '@/lib/time'
import { groupReputations, type RepSummary } from '@/lib/reviews'
import { RatingBadge } from '@/components/RatingBadge'
import InvitePeopleModal from '@/components/InvitePeopleModal'
import Modal from '@/components/Modal'
import { formatMoney } from '@/lib/analytics'
import SaveButton from '@/components/SaveButton'
import { getSavedSet, savedKey } from '@/lib/saved'

// ---- Types ----

type AppStatus = 'pending' | 'confirmed' | 'cancelled'
type SlotStatus = 'open' | 'booked' | 'past' | 'cancelled'
type SlotFilter = 'all' | 'open' | 'pending' | 'confirmed' | 'past' | 'cancelled'
type SlotsView = 'list' | 'calendar'

interface Application {
  id: string
  musicianId: string
  musicianName: string
  musicianGenre: string
  musicianLocation: string
  musicianDistance: string
  instagram: string
  youtube: string
  spotify: string
  note: string
  avatar: string
  status: AppStatus
  stripeOnboarded: boolean
  paymentStatus: string | null
  payoutReleased: boolean
  performerType: string
  bandMembers: number | null
  source: string
  inviteAccepted: boolean | null
}

interface PaymentModalData {
  slot: Slot
  app: Application
}

interface Slot {
  id: string
  date: string
  rawDate: string
  rawStartTime: string
  rawEndTime: string
  time: string
  genres: string[]
  budget: number
  notes: string
  status: SlotStatus
  bookedMusician?: string
  applications: Application[]
}

interface LiveMusician {
  id: string
  name: string
  genres: string[]
  bio: string
  avatar: string
  location: string
  distance: number
  distanceStr: string
  instagram: string
  youtube: string
  spotify: string
  performerType: string
  bandMembers: number | null
}

// Row shape returned by the musicians_near PostGIS RPC.
interface MusiciansNearRow {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  location_text: string | null
  instagram_url: string | null
  youtube_url: string | null
  spotify_url: string | null
  role_metadata: Record<string, unknown> | null
  performer_type: string | null
  band_members: number | null
  distance_m: number | null
}

interface VenueProfile {
  name: string
  type: string
  address: string
  description: string
  website: string
  instagram: string
  youtube: string
  tiktok: string
  avatar: string
}

interface MusicianAvailCard {
  id: string
  musicianId: string
  musicianName: string
  musicianAvatar: string
  musicianBio: string
  musicianLocation: string
  performerType: string
  date: string
  dateLabel: string
  start_time: string | null
  end_time: string | null
  rawStartTime: string | null  // HH:mm — for invite prefill (start_time/end_time are display-formatted)
  rawEndTime: string | null
  genres: string[]
  min_pay: number | null
  notes: string | null
  distance: number
  distanceStr: string
}

// ---- Constants ----

const INITIAL_PROFILE: VenueProfile = {
  name: 'Your Venue',
  type: 'Restaurant',
  address: '123 Main St, City, State',
  description: 'A warm and welcoming dining experience with a passion for live music.',
  website: '',
  instagram: '',
  youtube: '',
  tiktok: '',
  avatar: '',
}

// ---- Helpers ----

function formatTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function StatusBadge({ status }: { status: SlotStatus }) {
  if (status === 'open') return <span className="bg-teal/10 text-teal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Open</span>
  if (status === 'booked') return <span className="bg-chestnut/10 text-chestnut text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Booked</span>
  if (status === 'cancelled') return <span className="bg-red-100 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Cancelled</span>
  return <span className="bg-charcoal/10 text-charcoal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Past</span>
}

// ---- Payment Modal ----

function PaymentModalInner({ slot, app, onClose, onConfirmed }: {
  slot: Slot
  app: Application
  onClose: () => void
  onConfirmed: (paymentIntentId: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [cardComplete, setCardComplete] = useState(false)
  // Effective fee for this gig (reflects any admin waiver). Defaults to 8% until
  // the quote loads; the restaurant always pays the full slot pay regardless.
  const [feeAmount, setFeeAmount] = useState(slot.budget * 0.08)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/stripe/fee-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ booking_id: app.id }),
      })
        .then(r => r.json())
        .then((d: { feeCents?: number }) => { if (!cancelled && typeof d.feeCents === 'number') setFeeAmount(d.feeCents / 100) })
        .catch(() => {})
    })
    return () => { cancelled = true }
  }, [app.id, slot.budget])

  const musicianReceives = slot.budget - feeAmount
  const waived = feeAmount <= 0

  const handlePay = async () => {
    if (!stripe || !elements || processing) return
    setProcessing(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/stripe/payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          booking_id: app.id,
          availability_id: slot.id,
          musician_id: app.musicianId,
          amount: slot.budget * 100,
        }),
      })
      const data = await res.json() as { client_secret?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to initialize payment.')

      const cardElement = elements.getElement(CardElement)
      if (!cardElement) throw new Error('Card element unavailable.')

      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(
        data.client_secret!,
        { payment_method: { card: cardElement } },
      )
      if (stripeErr) throw new Error(stripeErr.message ?? 'Payment was declined.')
      if (paymentIntent?.status === 'requires_capture') {
        onConfirmed(paymentIntent.id)
      } else {
        throw new Error(`Unexpected payment status: ${paymentIntent?.status}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.')
      setProcessing(false)
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="pay-modal-title">
        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Confirm & Pay</p>
            <h3 id="pay-modal-title" className="text-snow text-xl font-black tracking-tight">Confirm <span className="text-chestnut italic">Booking.</span></h3>
          </div>
          <button onClick={onClose} className="text-snow/60 hover:text-snow transition-colors leading-none relative z-10"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </div>
        <div className="p-6">
          {/* Summary card */}
          <div className="bg-white rounded-2xl p-4 mb-5 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Avatar src={app.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" bg="bg-chestnut/10" />
              <div className="flex-1 min-w-0">
                <p className="text-graphite font-bold text-sm truncate">{app.musicianName}</p>
                <p className="text-charcoal text-xs mt-0.5">{slot.date} · {slot.time}</p>
              </div>
            </div>
            <div className="space-y-1.5 border-t border-charcoal/[0.08] pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-charcoal">Gig pay</span>
                <span className="text-graphite font-semibold">{formatMoney(slot.budget)}</span>
              </div>
              <div className="flex justify-between text-xs text-charcoal/60">
                <span>{waived ? 'Platform fee waived 🎉' : `Platform fee (${Math.round((feeAmount / (slot.budget || 1)) * 100)}%, absorbed by Drum Up)`}</span>
                <span>{formatMoney(feeAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-charcoal/60">
                <span>Musician receives</span>
                <span>{formatMoney(musicianReceives)}</span>
              </div>
              <div className="flex justify-between text-sm font-black border-t border-charcoal/[0.08] pt-2 mt-1">
                <span className="text-graphite">You pay</span>
                <span className="text-chestnut">{formatMoney(slot.budget)}</span>
              </div>
            </div>
          </div>

          {/* Card input */}
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Payment</p>
          <div className="bg-white rounded-xl px-4 py-3.5 mb-5 shadow-sm border border-charcoal/10">
            <CardElement
              onChange={(e) => setCardComplete(e.complete)}
              options={{
                style: {
                  base: {
                    fontSize: '15px',
                    color: '#333333',
                    fontFamily: 'Inter, sans-serif',
                    '::placeholder': { color: '#a0a0a0' },
                  },
                  invalid: { color: '#ef4444' },
                },
              }}
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
          )}

          <p className="text-charcoal/50 text-xs text-center mb-4">
            Payment is authorized now and released to {app.musicianName} after the gig on {slot.date}.
          </p>

          <button
            onClick={handlePay}
            disabled={!cardComplete || processing || !stripe}
            className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-2"
          >
            {processing
              ? <span className="flex items-center justify-center gap-2"><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Processing…</span>
              : `Confirm & Pay ${formatMoney(slot.budget)}`}
          </button>
          <button
            onClick={onClose}
            disabled={processing}
            className="w-full bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
    </Modal>
  )
}

// ---- Main Component ----

export default function RestaurantDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('home')
  const [invitePeopleOpen, setInvitePeopleOpen] = useState(false)
  const [slots, setSlots] = useState<Slot[]>([])
  const [profile, setProfile] = useState<VenueProfile>(INITIAL_PROFILE)

  const [postSlotOpen, setPostSlotOpen] = useState(false)
  const [newSlot, setNewSlot] = useState({ date: '', startTime: '', endTime: '', genres: [] as string[], budget: '', notes: '' })

  const [slotFilter, setSlotFilter] = useState<SlotFilter>('open')
  const [slotsDisplayCount, setSlotsDisplayCount] = useState(10)
  const [slotsView, setSlotsView] = useState<SlotsView>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [genreFilters, setGenreFilters] = useState<string[]>([])
  const [musicianSortBy, setMusicianSortBy] = useState<'distance' | 'name-az' | 'name-za'>('distance')
  const [typeFilter, setTypeFilter] = useState<'all' | 'solo' | 'band'>('all')
  const [genrePanelOpen, setGenrePanelOpen] = useState(false)
  const [selectedLiveMusician, setSelectedLiveMusician] = useState<LiveMusician | null>(null)

  // Messaging
  const messagingRef = useRef<MessagingTabRef>(null)
  const [msgUnread, setMsgUnread] = useState(0)

  // Return from profile page → messages tab
  useEffect(() => {
    const go = sessionStorage.getItem('drumup_goto_messages')
    if (go) { sessionStorage.removeItem('drumup_goto_messages'); setActiveTab('messages') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [userId, setUserId] = useState('')
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })
  const [discoveryRadius, setDiscoveryRadius] = useState(25)
  const [radiusDraft, setRadiusDraft] = useState(25)
  const [savingRadius, setSavingRadius] = useState(false)
  const [declineApp, setDeclineApp] = useState<{ slotId: string; appId: string; name: string } | null>(null)
  const [decliningApp, setDecliningApp] = useState(false)
  const [savedMusicians, setSavedMusicians] = useState<Set<string>>(new Set())
  const setSavedKey = (key: string, on: boolean) =>
    setSavedMusicians(prev => {
      const next = new Set(prev)
      if (on) next.add(key); else next.delete(key)
      return next
    })
  const [liveMusicians, setLiveMusicians] = useState<LiveMusician[]>([])
  // Aggregate reputation per musician, keyed by musician id, for browse cards.
  const [musicianReps, setMusicianReps] = useState<Map<string, RepSummary>>(new Map())
  const [browseLoading, setBrowseLoading] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)

  // Browse view toggle + musician availability
  const [browseView, setBrowseView] = useState<'musicians' | 'availability'>('musicians')
  const [musicianAvailability, setMusicianAvailability] = useState<MusicianAvailCard[]>([])
  const [availMinPay, setAvailMinPay] = useState(0)   // min-pay filter for the availability view
  const [availDate, setAvailDate] = useState('')       // exact-date filter (YYYY-MM-DD) for the availability view
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [inviteModal, setInviteModal] = useState<{ musicianId: string; musicianName: string; date?: string; startTime?: string; endTime?: string } | null>(null)
  const [inviteSuccessBookingId, setInviteSuccessBookingId] = useState<string | null>(null)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const { toast } = useToast()

  // Analytics
  const [analyticsViews7d, setAnalyticsViews7d] = useState<number | null>(null)
  const [analyticsViews30d, setAnalyticsViews30d] = useState<number | null>(null)
  const [analyticsFollowers, setAnalyticsFollowers] = useState<number | null>(null)
  const [analyticsShows, setAnalyticsShows] = useState<number | null>(null)
  const [analyticsOpenSlots, setAnalyticsOpenSlots] = useState<number | null>(null)
  const [analyticsRating, setAnalyticsRating] = useState<number | null>(null)
  const [analyticsReviewCount, setAnalyticsReviewCount] = useState<number | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)

  // ---- Data loading ----

  const loadSlots = async (rid: string, resLat?: number | null, resLon?: number | null) => {
    const lat = resLat !== undefined ? resLat : restaurantCoords.lat
    const lon = resLon !== undefined ? resLon : restaurantCoords.lon

    try {
    const { data, error: slotsErr } = await supabase
      .from('availability')
      .select('*')
      .eq('restaurant_id', rid)
      .order('date', { ascending: true })
    if (slotsErr) throw slotsErr
    if (!data) return

    const mapped: Slot[] = data.map(row => {
      const dateLabel = new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      const dbStatus = row.status as string
      const endDatetime = gigStartEnd(row.date, row.start_time, row.end_time ?? '23:59:00').end
      const isPast = endDatetime < new Date()
      const status: SlotStatus = isPast ? 'past' : dbStatus === 'filled' ? 'booked' : dbStatus === 'cancelled' ? 'cancelled' : 'open'
      const rawStart = row.start_time?.slice(0, 5) ?? ''
      const rawEnd = row.end_time?.slice(0, 5) ?? ''
      return {
        id: row.id,
        date: dateLabel,
        rawDate: row.date,
        rawStartTime: rawStart,
        rawEndTime: rawEnd,
        time: `${formatTime(rawStart)} – ${formatTime(rawEnd)}`,
        genres: Array.isArray(row.genres) ? row.genres : [],
        budget: Number(row.pay) || 0,
        notes: row.description ?? '',
        status,
        applications: [],
      }
    })

    // Attach pending/confirmed bookings as applications
    const slotIds = mapped.map(s => s.id)
    if (slotIds.length > 0) {
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('id, availability_id, musician_id, status, pay_amount, note, payment_status, payout_released, source, invite_accepted')
        .eq('restaurant_id', rid)
        .in('status', ['pending', 'confirmed'])
        .in('availability_id', slotIds)

      if (bookingsData && bookingsData.length > 0) {
        const musicianIds = [...new Set(bookingsData.map(b => b.musician_id))]
        const { data: musicianData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role_metadata, location_text, latitude, longitude, instagram_url, youtube_url, spotify_url, stripe_onboarded, performer_type, band_members')
          .in('id', musicianIds)
        const musicianById = new Map((musicianData ?? []).map(m => [m.id, m]))

        const slotsWithApps = mapped.map(slot => {
          const slotBookings = bookingsData.filter(b => b.availability_id === slot.id)
          const applications: Application[] = slotBookings.map(b => {
            const musician = musicianById.get(b.musician_id)
            const meta = (musician?.role_metadata ?? {}) as Record<string, unknown>
            let distStr = ''
            if (lat != null && lon != null && musician?.latitude != null && musician?.longitude != null) {
              const d = milesBetween(lat, lon, musician.latitude as number, musician.longitude as number)
              distStr = `${Math.round(d)} mi away`
            }
            return {
              id: b.id,
              musicianId: b.musician_id,
              musicianName: musician?.full_name ?? 'Unknown Musician',
              musicianGenre: Array.isArray(meta.genres) ? (meta.genres as string[]).slice(0, 2).join(', ') : '',
              musicianLocation: (musician as Record<string, unknown>)?.location_text as string ?? '',
              musicianDistance: distStr,
              instagram: (musician as Record<string, unknown>)?.instagram_url as string ?? '',
              youtube: (musician as Record<string, unknown>)?.youtube_url as string ?? '',
              spotify: (musician as Record<string, unknown>)?.spotify_url as string ?? '',
              note: b.note ?? '',
              avatar: musician?.avatar_url ?? '',
              status: b.status as AppStatus,
              stripeOnboarded: ((musician as Record<string, unknown>)?.stripe_onboarded as boolean | null) ?? false,
              paymentStatus: (b as Record<string, unknown>).payment_status as string | null ?? null,
              payoutReleased: ((b as Record<string, unknown>).payout_released as boolean | null) ?? false,
              performerType: (musician as Record<string, unknown>)?.performer_type as string ?? '',
              bandMembers: (musician as Record<string, unknown>)?.band_members as number | null ?? null,
              source: (b as Record<string, unknown>).source as string ?? 'application',
              inviteAccepted: (b as Record<string, unknown>).invite_accepted as boolean | null ?? null,
            }
          })
          return { ...slot, applications }
        })
        setSlots(slotsWithApps)
        return
      }
    }

    setSlots(mapped)
    } catch (err) {
      console.error('Failed to load slots:', err)
      toast.error('Could not load your availability slots. Please refresh.')
    }
  }

  const loadMusicians = async (lat: number, lon: number, radius: number) => {
    setBrowseLoading(true)
    try {
    // Server-side PostGIS distance filter (see musicians_near RPC).
    const { data, error: musErr } = await supabase.rpc('musicians_near', {
      lat, lon, radius_m: radius * 1609.34,
    })
    if (musErr) throw musErr
    if (!data) { setBrowseLoading(false); return }

    const results: LiveMusician[] = (data as MusiciansNearRow[]).map(m => {
      const dist = m.distance_m != null ? m.distance_m / 1609.34 : 0
      const meta = (m.role_metadata ?? {}) as Record<string, unknown>
      return {
        id: m.id,
        name: m.full_name ?? 'Unknown',
        genres: Array.isArray(meta.genres) ? meta.genres as string[] : [],
        bio: m.bio ?? '',
        avatar: m.avatar_url ?? '',
        location: m.location_text ?? '',
        distance: dist,
        distanceStr: dist < 1 ? 'Less than 1 mile away' : `${Math.round(dist)} mile${Math.round(dist) === 1 ? '' : 's'} away`,
        instagram: m.instagram_url ?? '',
        youtube: m.youtube_url ?? '',
        spotify: m.spotify_url ?? '',
        performerType: m.performer_type ?? '',
        bandMembers: m.band_members ?? null,
      }
    })

    setLiveMusicians(results)

    // Reputation badges for the musicians in view (one grouped query).
    const musIds = results.map(m => m.id)
    if (musIds.length > 0) {
      void supabase.from('reviews').select('reviewee_id, rating, tags').in('reviewee_id', musIds)
        .then(({ data: revRows }) => {
          if (revRows) setMusicianReps(groupReputations(revRows as { reviewee_id: string; rating: number; tags: string[] | null }[]))
        })
    }
    } catch (err) {
      console.error('Failed to load musicians:', err)
      toast.error('Could not load musicians. Please try again.')
    } finally {
      setBrowseLoading(false)
    }
  }

  const loadMusicianAvailability = async (lat: number, lon: number, radius: number) => {
    setAvailabilityLoading(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('musician_availability')
        .select('id, date, start_time, end_time, genres, min_pay, notes, status, latitude, longitude, musician_id, musician:musician_id(id, full_name, avatar_url, bio, location_text, latitude, longitude, role_metadata, performer_type)')
        .eq('status', 'open')
        .eq('is_private', false)
        .gte('date', today)
        .order('date', { ascending: true })
      if (error) throw error
      if (!data) { setMusicianAvailability([]); return }

      const results: MusicianAvailCard[] = data
        .filter(s => {
          const m = s.musician as unknown as Record<string, unknown> | null
          return m && m.latitude != null && m.longitude != null
        })
        .map(s => {
          const m = s.musician as unknown as Record<string, unknown>
          const mLat = m.latitude as number
          const mLon = m.longitude as number
          const dist = milesBetween(lat, lon, mLat, mLon)
          const fmtT = (t: string | null) => {
            if (!t) return null
            const hh = parseInt(t.slice(0, 2))
            const mm = t.slice(3, 5)
            const period = hh >= 12 ? 'PM' : 'AM'
            return `${hh % 12 || 12}:${mm} ${period}`
          }
          return {
            id: s.id,
            musicianId: s.musician_id as string,
            musicianName: (m.full_name as string) ?? 'Musician',
            musicianAvatar: (m.avatar_url as string) ?? '',
            musicianBio: (m.bio as string) ?? '',
            musicianLocation: (m.location_text as string) ?? '',
            performerType: (m.performer_type as string) ?? '',
            date: s.date,
            dateLabel: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            start_time: fmtT(s.start_time?.slice(0, 5) ?? null),
            end_time: fmtT(s.end_time?.slice(0, 5) ?? null),
            rawStartTime: s.start_time?.slice(0, 5) ?? null,
            rawEndTime: s.end_time?.slice(0, 5) ?? null,
            genres: Array.isArray(s.genres) ? s.genres : [],
            min_pay: s.min_pay != null ? Number(s.min_pay) : null,
            notes: s.notes ?? null,
            distance: dist,
            distanceStr: dist < 1 ? '<1 mi' : `${dist.toFixed(1)} mi`,
          }
        })
        .filter(s => s.distance <= radius)
        .sort((a, b) => a.date.localeCompare(b.date) || a.distance - b.distance)

      setMusicianAvailability(results)
    } catch (err) {
      console.error('Failed to load musician availability:', err)
    } finally {
      setAvailabilityLoading(false)
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      if (!user) return
      setUserId(user.id)
      void getSavedSet(user.id).then(setSavedMusicians)
      // NOTE: Never include legal_name in queries unless fetching the current user's own profile
      // or in server-side Stripe routes. legal_name is private.
      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('full_name, bio, avatar_url, location_text, latitude, longitude, website, instagram_url, youtube_url, tiktok_url, role_metadata, discovery_radius_miles')
        .eq('id', user.id).maybeSingle()
      if (profileErr) throw profileErr
      if (!data) return
      const meta = (data.role_metadata ?? {}) as Record<string, unknown>
      setProfile({
        name: (meta.venue_name as string | undefined) ?? data.full_name ?? '',
        type: (meta.cuisine_type as string | undefined) ?? '',
        address: data.location_text ?? '',
        description: data.bio ?? '',
        website: data.website ?? '',
        instagram: (data as Record<string, unknown>).instagram_url as string ?? '',
        youtube: (data as Record<string, unknown>).youtube_url as string ?? '',
        tiktok: (data as Record<string, unknown>).tiktok_url as string ?? '',
        avatar: data.avatar_url ?? '',
      })
      const lat = data.latitude ?? null
      const lon = data.longitude ?? null
      const radius = (data.discovery_radius_miles as number | null) ?? 25
      setRestaurantCoords({ lat, lon })
      setDiscoveryRadius(radius)
      setRadiusDraft(radius)
      await loadSlots(user.id, lat, lon)
      if (lat != null && lon != null) {
        void loadMusicians(lat, lon, radius)
      }
      } catch (err) {
        console.error('Failed to load restaurant dashboard:', err)
        toast.error('Failed to load your dashboard. Please refresh.')
      } finally {
        setDataLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: new applications (INSERT) and invite responses / status changes (UPDATE)
  // on any of this restaurant's bookings. Re-fetch slots so the applications list stays
  // in sync — e.g. a musician accepting an invite flips it to "awaiting payment".
  useEffect(() => {
    if (!userId) return
    const reload = () => loadSlots(userId)
    const sub = supabase
      .channel(`bookings-restaurant-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${userId}`,
      }, reload)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${userId}`,
      }, reload)
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [userId])

  // Refresh slots whenever the restaurant switches to the slots tab
  useEffect(() => {
    if (activeTab === 'slots' && userId) loadSlots(userId)
  }, [activeTab, userId])

  // Load analytics when profile tab is first opened
  useEffect(() => {
    if (activeTab === 'profile' && userId) loadAnalytics(userId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId])

  // ---- Actions ----

  const saveRadius = async (value?: number) => {
    if (!userId) return
    const radius = value ?? radiusDraft
    setSavingRadius(true)
    try {
      const { error } = await supabase.from('profiles').update({
        discovery_radius_miles: radius,
      }).eq('id', userId)
      if (error) throw error
      setDiscoveryRadius(radius)
      setRadiusDraft(radius)
      if (restaurantCoords.lat != null && restaurantCoords.lon != null) {
        await loadMusicians(restaurantCoords.lat, restaurantCoords.lon, radius)
      }
      toast.success('Discovery radius updated!')
    } catch (err) {
      console.error('Failed to save radius:', err)
      toast.error('Could not save discovery radius. Please try again.')
    } finally {
      setSavingRadius(false)
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

  const loadAnalytics = async (uid: string) => {
    if (analyticsLoaded) return
    setAnalyticsLoading(true)
    try {
      const now = Date.now()
      const d7 = new Date(now - 7 * 86400000).toISOString()
      const d30 = new Date(now - 30 * 86400000).toISOString()
      const [v7, v30, fol, shows, open, revs] = await Promise.all([
        supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('profile_id', uid).gte('viewed_at', d7),
        supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('profile_id', uid).gte('viewed_at', d30),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('restaurant_id', uid).eq('status', 'confirmed'),
        supabase.from('availability').select('id', { count: 'exact', head: true }).eq('restaurant_id', uid).eq('status', 'open'),
        supabase.from('reviews').select('rating').eq('reviewee_id', uid),
      ])
      setAnalyticsViews7d(v7.count ?? 0)
      setAnalyticsViews30d(v30.count ?? 0)
      setAnalyticsFollowers(fol.count ?? 0)
      setAnalyticsShows(shows.count ?? 0)
      setAnalyticsOpenSlots(open.count ?? 0)
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

  const [postingSlot, setPostingSlot] = useState(false)
  const [postSlotError, setPostSlotError] = useState('')

  // Load musician availability when switching to that view
  useEffect(() => {
    if (browseView === 'availability' && restaurantCoords.lat != null && restaurantCoords.lon != null && musicianAvailability.length === 0) {
      void loadMusicianAvailability(restaurantCoords.lat, restaurantCoords.lon, discoveryRadius)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseView])

  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [editDraft, setEditDraft] = useState({ date: '', startTime: '', endTime: '', budget: '', notes: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const [cancelSlotId, setCancelSlotId] = useState<string | null>(null)
  const [cancellingSlot, setCancellingSlot] = useState(false)

  // Cancel confirmed booking (refund flow)
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null)
  const [cancellingBooking, setCancellingBooking] = useState(false)

  // Payment modal
  const [paymentModalData, setPaymentModalData] = useState<PaymentModalData | null>(null)

  const handlePostSlot = async () => {
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime || !newSlot.budget) return
    if (!userId) return
    if (restaurantCoords.lat == null || restaurantCoords.lon == null) {
      setPostSlotError('Add a location to your profile (Settings) before posting slots — musicians can\'t see slots without coordinates.')
      return
    }
    setPostingSlot(true)
    setPostSlotError('')
    try {
      const { data: inserted, error: insertErr } = await supabase.from('availability').insert({
        restaurant_id: userId,
        date: newSlot.date,
        start_time: newSlot.startTime,
        end_time: newSlot.endTime,
        description: newSlot.notes || null,
        pay: parseInt(newSlot.budget),
        status: 'open',
        genres: newSlot.genres,
        latitude: restaurantCoords.lat,
        longitude: restaurantCoords.lon,
      }).select('id').single()
      if (insertErr) throw insertErr
      setPostSlotOpen(false)
      setNewSlot({ date: '', startTime: '', endTime: '', genres: [], budget: '', notes: '' })
      await loadSlots(userId)
      setActiveTab('slots')
      toast.success('Slot posted! Musicians can now apply.')

      // Fan out gig alerts to nearby matching musicians + venue followers (fire-and-forget)
      if (inserted?.id) {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return
          fetch('/api/notifications/new-gig', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ availability_id: inserted.id }),
          }).catch(err => console.error('[Notify] new-gig failed:', err))
        })
      }
    } catch (err) {
      console.error('Slot insert failed:', err)
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setPostSlotError(msg)
      toast.error('Failed to post slot. Please try again.')
    } finally {
      setPostingSlot(false)
    }
  }

  const handleApplicationAction = (slotId: string, appId: string, action: 'accept' | 'decline') => {
    // Accepting requires payment and goes through the payment modal (openPaymentModal
    // → handlePaymentConfirmed → /api/bookings/confirm). This handler only declines,
    // and declining is destructive, so confirm first.
    if (action !== 'decline') return
    const name = slots.find(s => s.id === slotId)?.applications.find(a => a.id === appId)?.musicianName ?? 'this musician'
    setDeclineApp({ slotId, appId, name })
  }

  const confirmDecline = async () => {
    if (!declineApp) return
    const { slotId, appId } = declineApp
    setDecliningApp(true)
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', appId)
      if (error) throw error

      toast.info('Application declined.')

      // Fire-and-forget: notify musician of decline
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        fetch('/api/notifications/application-declined', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ booking_id: appId }),
        }).catch(err => console.error('[Email] application-declined failed:', err))
      })

      setSlots(prev => prev.map(slot => {
        if (slot.id !== slotId) return slot
        return {
          ...slot,
          applications: slot.applications.map(a =>
            a.id === appId ? { ...a, status: 'cancelled' as AppStatus } : a
          ),
        }
      }))
      setDeclineApp(null)
    } catch (err) {
      console.error('Failed to decline application:', err)
      toast.error('Could not update the application. Please try again.')
    } finally {
      setDecliningApp(false)
    }
  }

  const handleEditSlot = async () => {
    if (!editingSlot || !userId) return
    // getDateOptions prepends the slot's existing (possibly past) date, so guard against saving a date in the past.
    const todayStr = new Date().toISOString().slice(0, 10)
    if (editDraft.date && editDraft.date < todayStr) {
      toast.error("That date is in the past — pick today or later.")
      return
    }
    setSavingEdit(true)
    try {
      const { error } = await supabase.from('availability').update({
        date: editDraft.date,
        start_time: editDraft.startTime,
        end_time: editDraft.endTime,
        pay: parseInt(editDraft.budget) || 0,
        description: editDraft.notes || null,
      }).eq('id', editingSlot.id).eq('restaurant_id', userId)
      if (error) throw error
      setEditingSlot(null)
      await loadSlots(userId)
      toast.success('Slot updated!')
    } catch (err) {
      console.error('Edit slot failed:', err)
      toast.error('Could not update slot. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleCancelSlot = async () => {
    if (!cancelSlotId || !userId) return
    setCancellingSlot(true)
    try {
      const slot = slots.find(s => s.id === cancelSlotId)
      if (slot && slot.applications.some(a => a.status === 'pending' || a.status === 'confirmed')) {
        await supabase.from('bookings')
          .update({ status: 'cancelled' })
          .eq('availability_id', cancelSlotId)
          .in('status', ['pending', 'confirmed'])
      }
      const { error } = await supabase.from('availability').update({ status: 'cancelled' }).eq('id', cancelSlotId)
      if (error) throw error
      setCancelSlotId(null)
      await loadSlots(userId)
      toast.info('Slot cancelled.')
    } catch (err) {
      console.error('Cancel slot failed:', err)
      toast.error('Could not cancel slot. Please try again.')
    } finally {
      setCancellingSlot(false)
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
        body: JSON.stringify({ bookingId: cancelBookingId, cancelledBy: 'restaurant' }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Cancellation failed')

      // Update the slot back to open and remove confirmed app
      setSlots(prev => prev.map(s => {
        const hasThisBooking = s.applications.some(a => a.id === cancelBookingId && a.status === 'confirmed')
        if (!hasThisBooking) return s
        return {
          ...s,
          status: 'open' as SlotStatus,
          bookedMusician: undefined,
          applications: s.applications.map(a =>
            a.id === cancelBookingId ? { ...a, status: 'cancelled' as AppStatus } : a
          ),
        }
      }))
      setCancelBookingId(null)
      toast.info('Booking cancelled. The 8% platform fee has been retained.')

      // Fire-and-forget cancellation email
      void fetch('/api/notifications/cancellation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: cancelBookingId, cancelled_by: 'restaurant' }),
      }).catch(err => console.error('[Email] cancellation notification failed:', err))
    } catch (err) {
      console.error('Cancel booking failed:', err)
      toast.error(err instanceof Error ? err.message : 'Could not cancel booking. Please try again.')
    } finally {
      setCancellingBooking(false)
    }
  }

  const handlePaymentConfirmed = async (paymentIntentId: string) => {
    if (!paymentModalData) return
    const { slot, app } = paymentModalData
    try {
      // Booking lifecycle/payment columns are server-only (DB trigger). Confirm
      // through the API, which re-verifies the Stripe authorization before it
      // marks the booking confirmed + fills the slot + declines other applicants.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/bookings/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ booking_id: app.id, payment_intent_id: paymentIntentId }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Could not confirm booking.')

      setSlots(prev => prev.map(s => {
        if (s.id !== slot.id) return s
        return {
          ...s,
          status: 'booked' as SlotStatus,
          bookedMusician: app.musicianName,
          applications: s.applications.map(a => {
            if (a.id === app.id) return { ...a, status: 'confirmed' as AppStatus }
            if (a.status === 'pending') return { ...a, status: 'cancelled' as AppStatus }
            return a
          }),
        }
      }))
      setPaymentModalData(null)
      toast.success(`Booking confirmed! Payment authorized and will be released to ${app.musicianName} after the gig on ${slot.date}.`)

      // Fire-and-forget: send booking confirmed emails to both parties
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        fetch('/api/notifications/booking-confirmed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ booking_id: app.id }),
        }).catch(err => console.error('[Email] booking-confirmed failed:', err))
      })
    } catch (err) {
      console.error('Failed to confirm booking after payment:', err)
      toast.error('Payment succeeded but booking save failed. Please contact support.')
    }
  }

  const openPaymentModal = (slot: Slot, app: Application) => {
    if (!app.stripeOnboarded) {
      toast.error("This musician hasn't set up their payout account yet. Message them to complete their Stripe setup, or choose another musician.")
      return
    }
    setPaymentModalData({ slot, app })
  }

  const openConversation = (musician: { id: string; name: string; avatar: string }) => {
    if (!musician.id) return
    setSelectedLiveMusician(null)
    setActiveTab('messages')
    setTimeout(() => {
      messagingRef.current?.openWith(musician.id, musician.name, musician.avatar)
    }, 0)
  }

  // ---- Derived ----

  const openSlots = slots.filter(s => s.status === 'open').length
  const pendingApps = slots.reduce((n, s) => n + s.applications.filter(a => a.status === 'pending').length, 0)
  const upcomingGigs = slots.filter(s => s.status === 'booked').length
  const pastGigs = slots.filter(s => s.status === 'past').length
  const activeSlots = slots.filter(s => s.status !== 'past' && s.status !== 'cancelled')
  const archiveSlots = slots.filter(s => s.status === 'past' || s.status === 'cancelled')
  const filteredSlots = (() => {
    switch (slotFilter) {
      case 'all': return activeSlots
      case 'open': return slots.filter(s => s.status === 'open')
      case 'pending': return slots.filter(s => s.status === 'open' && s.applications.some(a => a.status === 'pending'))
      case 'confirmed': return slots.filter(s => s.status === 'booked')
      case 'past': return slots.filter(s => s.status === 'past').sort((a, b) => b.rawDate.localeCompare(a.rawDate))
      case 'cancelled': return slots.filter(s => s.status === 'cancelled').sort((a, b) => b.rawDate.localeCompare(a.rawDate))
    }
  })()
  const filteredMusicians = liveMusicians
    .filter(m => {
      const q = search.toLowerCase()
      const matchSearch = !q || m.name.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q))
      const matchGenre = genreFilters.length === 0 || genreFilters.some(f => m.genres.includes(f))
      const matchType = typeFilter === 'all' || m.performerType === typeFilter
      return matchSearch && matchGenre && matchType
    })
    .sort((a, b) => {
      if (musicianSortBy === 'name-az') return a.name.localeCompare(b.name)
      if (musicianSortBy === 'name-za') return b.name.localeCompare(a.name)
      return a.distance - b.distance
    })
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
                      <svg className="w-4 h-4 text-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      View Profile
                    </button>
                    <button onClick={() => { router.push('/settings'); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4 text-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                      Settings
                    </button>
                    <div className="border-t border-charcoal/10" />
                    <button onClick={() => { handleLogout(); setHeaderMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-medium text-charcoal hover:bg-snow transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4 text-charcoal/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                      Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* ---- HOME TAB ---- */}
        {activeTab === 'home' && (
          <>
            {/* Profile hero */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.18] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 7)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-chestnut opacity-[0.18] blur-2xl pointer-events-none" />
              <div className="relative z-10 p-6 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-inner border-2 border-chestnut/40" />
                  : <div className="w-16 h-16 rounded-2xl bg-chestnut/20 border-2 border-chestnut/40 flex items-center justify-center shrink-0 shadow-inner text-chestnut"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Venue</p>
                  <p className="text-snow font-black text-xl leading-tight truncate">{profile.name}</p>
                  <p className="text-snow/55 text-xs truncate mt-1">{profile.type} · {profile.address}</p>
                </div>
                <button
                  onClick={() => setPostSlotOpen(true)}
                  className="bg-chestnut text-snow px-5 py-3 rounded-xl text-sm font-black hover:opacity-90 transition-opacity shrink-0 shadow-lg"
                >
                  + Post Slot
                </button>
              </div>
            </div>

            {/* Stats */}
            {dataLoading ? (
              <div className="grid grid-cols-4 gap-2.5 mb-7">
                <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5 mb-7">
                <StatCard value={openSlots} label="Open" color="text-teal" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>} />
                <StatCard value={pendingApps} label="Pending" color="text-chestnut" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>} highlight />
                <StatCard value={upcomingGigs} label="Booked" color="text-graphite" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>} />
                <StatCard value={pastGigs} label="Past" color="text-charcoal" icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
              </div>
            )}

            {/* Pending alert */}
            {pendingApps > 0 && (
              <div className="bg-chestnut/10 border border-chestnut/20 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-5 text-chestnut shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
                  <p className="text-chestnut font-bold text-sm">You have <span className="font-black">{pendingApps}</span> pending application{pendingApps !== 1 ? 's' : ''} waiting for review</p>
                </div>
                <button
                  onClick={() => setActiveTab('slots')}
                  className="bg-chestnut text-snow px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
                >
                  Review Now →
                </button>
              </div>
            )}

            {/* Upcoming gigs */}
            {upcomingGigs > 0 && (
              <>
                <SectionHeader eyebrow="The Calendar" title="Upcoming" accent="Gigs." />
                <div className="space-y-3 mb-6">
                  {slots.filter(s => s.status === 'booked').map(slot => {
                    const [, datePart] = slot.date.split(', ')
                    const [mon, day] = (datePart || '').split(' ')
                    return (
                      <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
                        <div className="bg-chestnut/15 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                          <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">{mon}</p>
                          <p className="text-chestnut text-2xl font-black leading-tight">{day}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-graphite font-bold text-sm truncate">{slot.bookedMusician}</p>
                          <p className="text-charcoal text-xs mt-0.5">{slot.time}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {slot.genres.map(g => <span key={g} className="text-[10px] bg-charcoal/10 text-charcoal px-2.5 py-0.5 rounded-full font-semibold">{g}</span>)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-chestnut text-lg font-black">{formatMoney(slot.budget)}</p>
                          <div className="flex items-center gap-1 justify-end mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal" />
                            <span className="text-teal text-[10px] font-bold">Confirmed</span>
                          </div>
                          <AddToCalendar
                            className="mt-2"
                            label="Calendar"
                            filename={`gig-${slot.rawDate}`}
                            event={{
                              uid: `gig-${slot.id}`,
                              title: `Live music: ${slot.bookedMusician ?? 'Musician'} at ${profile.name}`,
                              description: slot.notes || '',
                              location: profile.address || '',
                              ...gigStartEnd(slot.rawDate, slot.rawStartTime, slot.rawEndTime),
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Pending applications */}
            <SectionHeader eyebrow="Inbox" title="Pending" accent="Applications." />
            {dataLoading ? (
              <div className="space-y-3">
                <SkeletonBookingCard /><SkeletonBookingCard /><SkeletonBookingCard />
              </div>
            ) : pendingApps === 0 ? (
              <EmptyState
                icon={<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
                title="No pending applications"
                body="Post a slot to start receiving applications from musicians."
                action={{ label: 'Post Your First Slot', onClick: () => setPostSlotOpen(true) }}
              />
            ) : (
              <div className="space-y-3">
                {slots.flatMap(slot =>
                  slot.applications
                    .filter(a => a.status === 'pending')
                    .map(app => (
                      <div key={app.id} className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex items-start gap-3 mb-3">
                          <Avatar src={app.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" bg="bg-chestnut/10" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-graphite font-bold text-sm truncate">{app.musicianName}</p>
                              <div className="text-right shrink-0">
                                <p className="text-teal font-black text-sm">{formatMoney(slot.budget)}</p>
                                <p className="text-charcoal/50 text-[9px] uppercase tracking-wide">pay offered</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {app.performerType === 'solo' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal/10 text-teal"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Solo</span>
                              )}
                              {app.performerType === 'band' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-chestnut/10 text-chestnut">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> Band{app.bandMembers ? ` · ${app.bandMembers}` : ''}
                                </span>
                              )}
                              <span className="text-charcoal text-xs">{app.musicianGenre}</span>
                              {app.musicianLocation && <><span className="text-charcoal/40 text-xs">·</span><span className="inline-flex items-center gap-0.5 text-charcoal text-xs"><svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{app.musicianLocation}</span></>}
                              {app.musicianDistance && <span className="text-chestnut text-xs font-semibold">{app.musicianDistance}</span>}
                            </div>
                            <p className="text-charcoal/60 text-xs mt-0.5">For: {slot.date} · {slot.time}</p>
                          </div>
                        </div>
                        {app.note && (
                          <div className="bg-snow rounded-xl px-3 py-2.5 mb-3">
                            <p className="text-charcoal text-sm italic leading-relaxed">"{app.note}"</p>
                          </div>
                        )}
                        {(app.instagram || app.youtube || app.spotify) && (
                          <div className="flex flex-wrap gap-3 mb-3">
                            {app.instagram && <a href={buildSocialUrl('instagram', app.instagram)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>Instagram</a>}
                            {app.youtube && <a href={buildSocialUrl('youtube', app.youtube)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z"/></svg>YouTube</a>}
                            {app.spotify && <a href={buildSocialUrl('spotify', app.spotify)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Spotify</a>}
                          </div>
                        )}
                        <div className="flex gap-2">
                          {app.source === 'invite' && app.inviteAccepted === null ? (
                            <div className="flex-1 bg-chestnut/10 text-chestnut py-2.5 rounded-xl text-sm font-bold text-center">Awaiting Response</div>
                          ) : app.source === 'invite' && app.inviteAccepted === true ? (
                            <button onClick={() => openPaymentModal(slot, app)} className="flex-1 bg-teal text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Complete & Pay</button>
                          ) : (
                            <button onClick={() => openPaymentModal(slot, app)} className="flex-1 bg-teal text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Accept</button>
                          )}
                          <button aria-label={`Message ${app.musicianName}`} onClick={() => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-graphite/10 text-graphite hover:bg-graphite/20 transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
                          {app.source !== 'invite' && (
                            <button onClick={() => handleApplicationAction(slot.id, app.id, 'decline')} className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10">Decline</button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </>
        )}

        {/* ---- BOOKINGS TAB ---- */}
        {activeTab === 'slots' && (() => {
          const allPendingApps = slots.flatMap(slot =>
            slot.applications.filter(a => a.status === 'pending').map(a => ({ app: a, slot }))
          )
          const upcomingBooked = slots.filter(s => s.status === 'booked')
          const pastBooked = slots.filter(s => s.status === 'past' && s.applications.some(a => a.status === 'confirmed'))
          return (
            <>
              <div className="flex items-end justify-between mb-6 gap-3">
                <div>
                  <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Manage</p>
                  <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                    Your <span className="text-chestnut italic">Bookings.</span>
                  </h2>
                </div>
                <button onClick={() => setPostSlotOpen(true)} className="bg-chestnut text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0">
                  + New Slot
                </button>
              </div>

              {/* Section 1 — Pending Applications */}
              <div className="mb-8">
                <SectionHeader eyebrow="Review" title="Pending" accent="Applications." />
                {allPendingApps.length === 0 ? (
                  <EmptyState
                    icon={<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>}
                    title="No pending applications"
                    body="Post a slot to start receiving applications from musicians."
                    action={{ label: 'Post a Slot', onClick: () => setPostSlotOpen(true) }}
                  />
                ) : (
                  <div className="space-y-3">
                    {allPendingApps.map(({ app, slot }) => (
                      <div key={app.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-[#DC7F41]">
                        <div className="flex items-start gap-3 mb-3">
                          <Avatar src={app.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" bg="bg-chestnut/10" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <button
                                  onClick={() => router.push('/profile/' + app.musicianId)}
                                  className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left"
                                >
                                  {app.musicianName}
                                </button>
                                {app.source === 'invite' && (
                                  <span className="shrink-0 text-[9px] font-black bg-chestnut/10 text-chestnut px-1.5 py-0.5 rounded-full uppercase tracking-wide">Invite</span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-teal font-black text-sm">{formatMoney(slot.budget)}</p>
                                <p className="text-charcoal/50 text-[9px] uppercase tracking-wide">pay</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {app.performerType === 'solo' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal/10 text-teal"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg> Solo</span>
                              )}
                              {app.performerType === 'band' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-chestnut/10 text-chestnut">
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> Band{app.bandMembers ? ` · ${app.bandMembers}` : ''}
                                </span>
                              )}
                              {app.musicianGenre && <span className="text-charcoal text-xs">{app.musicianGenre}</span>}
                              {app.musicianDistance && <><span className="text-charcoal/40 text-xs">·</span><span className="text-chestnut text-xs font-semibold">{app.musicianDistance}</span></>}
                            </div>
                            <p className="text-charcoal/60 text-xs mt-0.5">For: {slot.date} · {slot.time}</p>
                          </div>
                        </div>
                        {app.note && (
                          <div className="bg-snow rounded-xl px-3 py-2.5 mb-3">
                            <p className="text-charcoal text-sm italic leading-relaxed">"{app.note}"</p>
                          </div>
                        )}
                        {(app.instagram || app.youtube || app.spotify) && (
                          <div className="flex flex-wrap gap-3 mb-3">
                            {app.instagram && <a href={buildSocialUrl('instagram', app.instagram)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>Instagram</a>}
                            {app.youtube && <a href={buildSocialUrl('youtube', app.youtube)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z"/></svg>YouTube</a>}
                            {app.spotify && <a href={buildSocialUrl('spotify', app.spotify)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Spotify</a>}
                          </div>
                        )}
                        <div className="flex gap-2">
                          {app.source === 'invite' && app.inviteAccepted === null ? (
                            <div className="flex-1 bg-chestnut/10 text-chestnut py-2.5 rounded-xl text-sm font-bold text-center">Awaiting Response</div>
                          ) : app.source === 'invite' && app.inviteAccepted === true ? (
                            <button onClick={() => openPaymentModal(slot, app)} className="flex-1 bg-teal text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Complete & Pay</button>
                          ) : (
                            <button onClick={() => openPaymentModal(slot, app)} className="flex-1 bg-chestnut text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Accept</button>
                          )}
                          <button aria-label={`Message ${app.musicianName}`} onClick={() => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-graphite/10 text-graphite hover:bg-graphite/20 transition-colors"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
                          {app.source !== 'invite' && (
                            <button onClick={() => handleApplicationAction(slot.id, app.id, 'decline')} className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10">Decline</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2 — Confirmed Bookings */}
              <div className="mb-8">
                <SectionHeader eyebrow="Confirmed" title="Booked" accent="Gigs." />
                {upcomingBooked.length === 0 && pastBooked.length === 0 ? (
                  <EmptyState
                    icon={<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                    title="No confirmed bookings yet"
                    body="Accept a musician's application to create a confirmed booking."
                  />
                ) : (
                  <div className="space-y-3">
                    {upcomingBooked.length > 0 && (
                      <>
                        <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Upcoming</p>
                        {upcomingBooked.map(slot => {
                          const confirmedApp = slot.applications.find(a => a.status === 'confirmed')
                          const musicianName = slot.bookedMusician ?? confirmedApp?.musicianName ?? 'Musician'
                          const musicianId = confirmedApp?.musicianId
                          const [, datePart] = slot.date.split(', ')
                          const [mon, day] = (datePart || '').split(' ')
                          return (
                            <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-[#6C9A8B]">
                              <div className="flex items-center gap-3">
                                <div className="bg-teal/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                                  <p className="text-teal text-[10px] font-black uppercase tracking-wide">{mon}</p>
                                  <p className="text-teal text-2xl font-black leading-tight">{day}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => musicianId && router.push('/profile/' + musicianId)}
                                    className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left block"
                                  >
                                    {musicianName}
                                  </button>
                                  <p className="text-charcoal text-xs mt-0.5">{slot.time}</p>
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {slot.genres.map(g => <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>)}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-teal font-black">{formatMoney(slot.budget)}</p>
                                  {confirmedApp?.paymentStatus === 'paid' ? (
                                    <span className="inline-block bg-teal/10 text-teal text-[9px] font-black px-2 py-0.5 rounded-full mt-0.5">Released</span>
                                  ) : confirmedApp?.paymentStatus === 'authorized' ? (
                                    <span className="inline-block bg-chestnut/10 text-chestnut text-[9px] font-black px-2 py-0.5 rounded-full mt-0.5">Authorized</span>
                                  ) : null}
                                  <button
                                    onClick={() => confirmedApp && openConversation({ id: confirmedApp.musicianId, name: confirmedApp.musicianName, avatar: confirmedApp.avatar })}
                                    className="inline-flex items-center gap-1 text-charcoal/60 text-[10px] font-medium hover:text-chestnut transition-colors mt-1"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message
                                  </button>
                                </div>
                              </div>
                              {confirmedApp?.paymentStatus === 'authorized' && (
                                <div className="flex justify-end mt-2 pt-2 border-t border-charcoal/[0.06]">
                                  <button
                                    onClick={() => confirmedApp && setCancelBookingId(confirmedApp.id)}
                                    className="text-red-400 text-xs font-semibold hover:text-red-600 transition-colors"
                                  >
                                    Cancel Booking
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </>
                    )}
                    {pastBooked.length > 0 && (
                      <>
                        <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2 mt-4">Past</p>
                        {pastBooked.map(slot => {
                          const confirmedApp = slot.applications.find(a => a.status === 'confirmed')
                          const musicianName = slot.bookedMusician ?? confirmedApp?.musicianName ?? 'Musician'
                          const musicianId = confirmedApp?.musicianId
                          return (
                            <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm opacity-70">
                              <div className="flex items-center gap-3">
                                <div className="bg-charcoal/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                                  <p className="text-charcoal/60 text-[10px] font-black uppercase tracking-wide">{slot.date.split(' ')[0]}</p>
                                  <p className="text-charcoal/60 text-2xl font-black leading-tight">{slot.date.split(' ')[2]?.replace(',', '')}</p>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => musicianId && router.push('/profile/' + musicianId)}
                                    className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors text-left block"
                                  >
                                    {musicianName}
                                  </button>
                                  <p className="text-charcoal text-xs mt-0.5">{slot.time}</p>
                                </div>
                                <p className="text-charcoal font-black shrink-0">{formatMoney(slot.budget)}</p>
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Section 3 — Your Posted Slots */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <SectionHeader eyebrow="All" title="Posted" accent="Slots." />
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border border-charcoal/10">
                      <button onClick={() => setSlotsView('list')} className={`px-3 py-2 flex items-center transition-all ${slotsView === 'list' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`} title="List view"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg></button>
                      <button onClick={() => setSlotsView('calendar')} className={`px-3 py-2 flex items-center transition-all ${slotsView === 'calendar' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`} title="Calendar view"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg></button>
                    </div>
                  </div>
                </div>
                {slotsView === 'list' ? (
                  <>
                    {/* Filter tabs */}
                    <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                      {([
                        { key: 'open' as SlotFilter, label: 'Open', count: slots.filter(s => s.status === 'open').length },
                        { key: 'pending' as SlotFilter, label: 'Pending', count: slots.filter(s => s.status === 'open' && s.applications.some(a => a.status === 'pending')).length },
                        { key: 'confirmed' as SlotFilter, label: 'Confirmed', count: slots.filter(s => s.status === 'booked').length },
                        { key: 'past' as SlotFilter, label: 'Past', count: slots.filter(s => s.status === 'past').length },
                        { key: 'cancelled' as SlotFilter, label: 'Cancelled', count: slots.filter(s => s.status === 'cancelled').length },
                        { key: 'all' as SlotFilter, label: 'All', count: activeSlots.length },
                      ]).map(({ key, label, count }) => (
                        <button
                          key={key}
                          onClick={() => { setSlotFilter(key); setSlotsDisplayCount(10) }}
                          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${slotFilter === key ? 'bg-chestnut text-snow shadow-sm' : 'bg-white text-charcoal border border-charcoal/15 hover:bg-[#E8E4E0]'}`}
                        >
                          {label}
                          {count > 0 && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none ${slotFilter === key ? 'bg-snow/25 text-snow' : 'bg-charcoal/10 text-charcoal'}`}>{count}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Slot list with pagination */}
                    {filteredSlots.length === 0 ? (
                      <EmptyState icon={<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>} title="No slots found" body="Post a slot to start receiving applications from musicians." />
                    ) : (
                      <>
                        <p className="text-charcoal/50 text-xs mb-3">Showing {Math.min(slotsDisplayCount, filteredSlots.length)} of {filteredSlots.length} slots</p>
                        <div className="space-y-4">
                          {filteredSlots.slice(0, slotsDisplayCount).map(slot => (
                            <SlotCard
                              key={slot.id}
                              slot={slot}
                              selectedSlotId={selectedSlotId}
                              setSelectedSlotId={setSelectedSlotId}
                              handleApplicationAction={handleApplicationAction}
                              onAccept={(app) => openPaymentModal(slot, app)}
                              onMessage={(app) => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })}
                              onEdit={slot.status === 'open' ? () => { setEditingSlot(slot); setEditDraft({ date: slot.rawDate, startTime: slot.rawStartTime, endTime: slot.rawEndTime, budget: String(slot.budget), notes: slot.notes }) } : undefined}
                              onCancel={(slot.status === 'open' || slot.status === 'booked') ? () => setCancelSlotId(slot.id) : undefined}
                            />
                          ))}
                        </div>
                        {filteredSlots.length > slotsDisplayCount && (
                          <button
                            onClick={() => setSlotsDisplayCount(n => n + 10)}
                            className="mt-4 w-full py-3 rounded-xl border border-charcoal/20 text-charcoal text-sm font-semibold hover:bg-white/60 transition-colors"
                          >
                            Load more
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <SlotCalendar
                    slots={slots}
                    calendarMonth={calendarMonth}
                    setCalendarMonth={setCalendarMonth}
                    calendarSelectedDay={calendarSelectedDay}
                    setCalendarSelectedDay={setCalendarSelectedDay}
                    selectedSlotId={selectedSlotId}
                    setSelectedSlotId={setSelectedSlotId}
                    handleApplicationAction={handleApplicationAction}
                    onAccept={(app) => {
                      const slot = slots.find(s => s.applications.some(a => a.id === app.id))
                      if (slot) openPaymentModal(slot, app)
                    }}
                    onMessage={(app) => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })}
                    onEditSlot={(slot) => { setEditingSlot(slot); setEditDraft({ date: slot.rawDate, startTime: slot.rawStartTime, endTime: slot.rawEndTime, budget: String(slot.budget), notes: slot.notes }) }}
                    onCancelSlot={(slotId) => setCancelSlotId(slotId)}
                  />
                )}
              </div>

              {/* ---- ARCHIVE SECTION ---- */}
              {archiveSlots.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setArchiveOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/60 rounded-xl border border-charcoal/10 hover:bg-white/80 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-4 h-4 text-charcoal/50 transition-transform ${archiveOpen ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className="text-charcoal text-sm font-bold">Archive</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-charcoal/10 text-charcoal/60">{archiveSlots.length}</span>
                    </div>
                    <span className="text-charcoal/40 text-xs">Past &amp; cancelled slots</span>
                  </button>

                  {archiveOpen && (
                    <div className="mt-3 space-y-3">
                      {archiveSlots.slice(0, 10).map(slot => {
                        const isPast = slot.status === 'past'
                        const confirmedApp = slot.applications.find(a => a.status === 'confirmed')
                        return (
                          <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm opacity-70" style={{ filter: 'grayscale(20%)' }}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="text-graphite font-bold text-sm">{slot.date}</p>
                                  {isPast && confirmedApp ? (
                                    <span className="inline-flex items-center gap-1 bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full">
                                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                      Completed
                                    </span>
                                  ) : (
                                    <span className="bg-charcoal/10 text-charcoal text-[10px] font-black px-2 py-0.5 rounded-full">Cancelled</span>
                                  )}
                                </div>
                                <p className="text-charcoal/60 text-xs">{slot.time}</p>
                                {confirmedApp && <p className="text-charcoal/60 text-xs mt-0.5">{confirmedApp.musicianName}</p>}
                              </div>
                              <p className="text-charcoal/50 font-black shrink-0">{formatMoney(slot.budget)}</p>
                            </div>
                            {isPast && confirmedApp && (
                              <div className="mt-3 flex gap-2">
                                <button
                                  onClick={() => { try { sessionStorage.setItem('drumup_open_review', '1') } catch { /* ignore */ } ; router.push('/profile/' + confirmedApp.musicianId) }}
                                  className="flex-1 flex items-center justify-center gap-1.5 border border-chestnut/40 text-chestnut py-2 rounded-xl text-xs font-bold hover:bg-chestnut/10 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                                  Review {confirmedApp.musicianName.split(' ')[0]}
                                </button>
                                <button
                                  onClick={() => setInviteModal({ musicianId: confirmedApp.musicianId, musicianName: confirmedApp.musicianName })}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-chestnut text-snow py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
                                >
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                                  Rebook
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {archiveSlots.length > 10 && (
                        <p className="text-center text-charcoal/40 text-xs py-2">+{archiveSlots.length - 10} more — use the Past / Cancelled filters above to see all</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })()}

        {/* ---- BROWSE TAB: LIST ---- */}
        {activeTab === 'browse' && !selectedLiveMusician && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Talent Pool</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Browse <span className="text-chestnut italic">Musicians.</span>
              </h2>
            </div>

            {/* Browse view toggle */}
            <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm">
              <button
                onClick={() => setBrowseView('musicians')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${browseView === 'musicians' ? 'bg-chestnut text-snow shadow-sm' : 'text-charcoal hover:text-graphite'}`}
              >
                Musicians
              </button>
              <button
                onClick={() => setBrowseView('availability')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${browseView === 'availability' ? 'bg-chestnut text-snow shadow-sm' : 'text-charcoal hover:text-graphite'}`}
              >
                Availability
              </button>
            </div>

            {/* ---- AVAILABILITY VIEW ---- */}
            {browseView === 'availability' && (() => {
              const filteredAvailability = musicianAvailability.filter(s =>
                (availMinPay === 0 || (s.min_pay ?? 0) >= availMinPay) &&
                (!availDate || s.date === availDate)
              )
              return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-charcoal/60 text-xs font-semibold">Musicians posting open slots near you</p>
                  <button
                    onClick={() => {
                      if (restaurantCoords.lat != null && restaurantCoords.lon != null) {
                        void loadMusicianAvailability(restaurantCoords.lat, restaurantCoords.lon, discoveryRadius)
                      }
                    }}
                    disabled={availabilityLoading}
                    className="text-chestnut text-xs font-bold hover:underline disabled:opacity-40"
                  >
                    {availabilityLoading ? 'Loading…' : 'Refresh'}
                  </button>
                </div>

                {/* Pay + date filters */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 shadow-sm flex-1">
                    <label htmlFor="avail-minpay" className="text-charcoal/60 text-xs font-semibold shrink-0">Min pay</label>
                    <select
                      id="avail-minpay"
                      value={availMinPay}
                      onChange={e => setAvailMinPay(Number(e.target.value))}
                      className="bg-transparent text-graphite text-sm font-bold focus:outline-none cursor-pointer flex-1"
                    >
                      <option value={0}>Any</option>
                      {[100, 150, 200, 300, 500].map(v => <option key={v} value={v}>{formatMoney(v)}+</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 shadow-sm flex-1">
                    <label htmlFor="avail-date" className="text-charcoal/60 text-xs font-semibold shrink-0">Date</label>
                    <input
                      id="avail-date"
                      type="date"
                      value={availDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setAvailDate(e.target.value)}
                      className="bg-transparent text-graphite text-sm font-bold focus:outline-none cursor-pointer flex-1 min-w-0"
                    />
                  </div>
                  {(availMinPay !== 0 || availDate) && (
                    <button onClick={() => { setAvailMinPay(0); setAvailDate('') }} aria-label="Clear filters" className="shrink-0 text-charcoal/50 hover:text-graphite p-2 rounded-lg hover:bg-white transition-colors">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  )}
                </div>

                {availabilityLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}
                  </div>
                ) : restaurantCoords.lat == null ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-charcoal/60 text-sm">Add a location to your profile to see nearby musicians.</p>
                  </div>
                ) : musicianAvailability.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-graphite font-bold text-sm mb-1">No availability posted nearby</p>
                    <p className="text-charcoal/50 text-xs">Musicians within {discoveryRadius} miles haven't posted open slots yet.</p>
                  </div>
                ) : filteredAvailability.length === 0 ? (
                  <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-graphite font-bold text-sm mb-1">No slots match your filters</p>
                    <button onClick={() => { setAvailMinPay(0); setAvailDate('') }} className="text-chestnut text-xs font-bold hover:underline mt-1">Clear filters</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAvailability.map(slot => (
                      <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-full overflow-hidden shrink-0 bg-graphite/10 flex items-center justify-center">
                            {slot.musicianAvatar
                              ? <img src={slot.musicianAvatar} alt="" className="w-full h-full object-cover" />
                              : <span className="text-graphite font-black text-sm">{slot.musicianName.slice(0, 2).toUpperCase()}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-graphite font-bold text-sm truncate">{slot.musicianName}</p>
                              <span className="text-charcoal/50 text-[10px] shrink-0">{slot.distanceStr}</span>
                            </div>
                            <p className="text-chestnut font-black text-xs mt-0.5">{slot.dateLabel}</p>
                            {slot.start_time && slot.end_time && (
                              <p className="text-charcoal text-xs">{slot.start_time} – {slot.end_time}</p>
                            )}
                          </div>
                        </div>
                        {slot.genres.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {slot.genres.slice(0, 4).map(g => (
                              <span key={g} className="text-[10px] bg-charcoal/10 text-charcoal px-2 py-0.5 rounded-full font-semibold">{g}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          {slot.min_pay != null ? (
                            <span className="text-teal text-sm font-black">{formatMoney(slot.min_pay)}+ min pay</span>
                          ) : (
                            <span className="text-charcoal/40 text-xs">No min pay set</span>
                          )}
                          <button
                            onClick={() => setInviteModal({
                              musicianId: slot.musicianId,
                              musicianName: slot.musicianName,
                              date: slot.date,
                              startTime: slot.rawStartTime ?? undefined,
                              endTime: slot.rawEndTime ?? undefined,
                            })}
                            className="bg-chestnut text-snow text-xs font-bold px-4 py-2 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                          >
                            Invite →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )
            })()}

            {/* ---- MUSICIANS VIEW ---- */}
            {browseView === 'musicians' && (<>

            {/* Radius filter bar */}
            <div className="flex items-center justify-between gap-3 mb-4 bg-white rounded-xl px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-chestnut shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <label htmlFor="browse-radius" className="text-charcoal text-sm font-semibold">Within</label>
                <select
                  id="browse-radius"
                  value={discoveryRadius}
                  onChange={e => { const v = Number(e.target.value); setRadiusDraft(v); void saveRadius(v) }}
                  disabled={savingRadius}
                  className="bg-transparent text-charcoal text-sm font-bold focus:outline-none cursor-pointer disabled:opacity-50"
                >
                  {[10, 25, 50, 100].map(r => <option key={r} value={r}>{r} miles</option>)}
                </select>
              </div>
              <button
                onClick={() => {
                  if (restaurantCoords.lat != null && restaurantCoords.lon != null) {
                    void loadMusicians(restaurantCoords.lat, restaurantCoords.lon, discoveryRadius)
                  }
                }}
                disabled={browseLoading}
                className="text-chestnut text-sm font-bold hover:underline disabled:opacity-40 transition-opacity"
              >
                {browseLoading ? 'Loading…' : <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>Refresh</span>}
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by musician name..."
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>

            {/* Sort + Type + Genres row */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1.5 flex-1 overflow-x-auto pb-0.5 no-scrollbar">
                {([
                  { key: 'distance' as const, label: 'Nearest' },
                  { key: 'name-az' as const, label: 'A → Z' },
                  { key: 'name-za' as const, label: 'Z → A' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setMusicianSortBy(opt.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${musicianSortBy === opt.key ? 'bg-chestnut text-snow shadow-sm' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
                  >{opt.label}</button>
                ))}
                <div className="w-px bg-charcoal/15 self-stretch mx-0.5 shrink-0" />
                {([
                  { key: 'all' as const, label: 'All' },
                  { key: 'solo' as const, label: 'Solo' },
                  { key: 'band' as const, label: 'Band' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setTypeFilter(opt.key)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${typeFilter === opt.key ? 'bg-teal text-snow shadow-sm' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
                  >{opt.label}</button>
                ))}
              </div>
              <button
                onClick={() => setGenrePanelOpen(o => !o)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${genrePanelOpen || genreFilters.length > 0 ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="8" x2="16" y1="12" y2="12"/><line x1="11" x2="13" y1="18" y2="18"/></svg>
                Genres{genreFilters.length > 0 ? ` (${genreFilters.length})` : ''}
              </button>
            </div>

            {/* Active genre tags */}
            {genreFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {genreFilters.map(g => (
                  <span key={g} className="inline-flex items-center gap-1 bg-graphite text-snow px-2.5 py-1 rounded-full text-xs font-semibold">
                    {g}
                    <button onClick={() => setGenreFilters(prev => prev.filter(x => x !== g))} className="hover:opacity-70 transition-opacity leading-none">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setGenreFilters([])}
                  className="text-charcoal/50 text-xs font-medium hover:text-chestnut transition-colors px-1 self-center"
                >Clear all</button>
              </div>
            )}

            {/* Genre picker panel */}
            {genrePanelOpen && (
              <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-charcoal/[0.06]">
                <div className="space-y-3.5">
                  {GENRE_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-charcoal/40 text-[10px] font-bold uppercase tracking-widest mb-2">{group.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.genres.map(g => {
                          const selected = genreFilters.includes(g)
                          return (
                            <button
                              key={g}
                              onClick={() => setGenreFilters(prev => selected ? prev.filter(x => x !== g) : [...prev, g])}
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

            {/* Loading skeleton */}
            {browseLoading && (
              <div className="space-y-3">
                <SkeletonMusicianCard /><SkeletonMusicianCard /><SkeletonMusicianCard />
              </div>
            )}

            {/* No location */}
            {!browseLoading && restaurantCoords.lat == null && (
              <EmptyState
                icon={<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>}
                title="Location not set"
                body="Add your location in Settings so we can find musicians near you."
              />
            )}

            {/* Empty state */}
            {!browseLoading && restaurantCoords.lat != null && filteredMusicians.length === 0 && (
              <EmptyState
                icon={<svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
                title={`No musicians found within ${discoveryRadius} miles`}
                body="Try widening your search radius to discover more talent nearby."
                action={discoveryRadius < 100
                  ? { label: `Widen to ${[25, 50, 100].find(r => r > discoveryRadius) ?? 100} miles`, onClick: () => void saveRadius([25, 50, 100].find(r => r > discoveryRadius) ?? 100) }
                  : undefined}
              />
            )}

            {/* Musician cards */}
            {!browseLoading && filteredMusicians.length > 0 && (
              <div className="space-y-3">
                {filteredMusicians.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm" >
                    <div className="flex items-start gap-4 mb-3">
                      <Avatar src={m.avatar} className="w-14 h-14 rounded-full shrink-0" textSize="text-2xl" bg="bg-chestnut/10" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-graphite font-bold text-sm">{m.name}</p>
                          {m.performerType === 'solo' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>Solo</span>
                          )}
                          {m.performerType === 'band' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-chestnut/10 text-chestnut">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Band{m.bandMembers ? ` · ${m.bandMembers}` : ''}
                            </span>
                          )}
                        </div>
                        {m.location && <p className="text-charcoal text-xs mt-0.5">{m.location}</p>}
                        <p className="inline-flex items-center gap-0.5 text-chestnut text-xs font-semibold mt-0.5"><svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{m.distanceStr}</p>
                        <RatingBadge rep={musicianReps.get(m.id)} className="mt-1" />
                        {m.bio && <p className="text-charcoal/70 text-xs mt-1.5 line-clamp-2 leading-relaxed">{m.bio}</p>}
                      </div>
                      <SaveButton
                        userId={userId}
                        type="musician"
                        id={m.id}
                        saved={savedMusicians.has(savedKey('musician', m.id))}
                        onChange={(next) => setSavedKey(savedKey('musician', m.id), next)}
                      />
                    </div>
                    {m.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {m.genres.map(g => <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>)}
                      </div>
                    )}
                    {(m.instagram || m.youtube || m.spotify) && (
                      <div className="flex flex-wrap gap-3 mb-3">
                        {m.instagram && <a href={buildSocialUrl('instagram', m.instagram)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>Instagram</a>}
                        {m.youtube && <a href={buildSocialUrl('youtube', m.youtube)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z"/></svg>YouTube</a>}
                        {m.spotify && <a href={buildSocialUrl('spotify', m.spotify)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Spotify</a>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openConversation({ id: m.id, name: m.name, avatar: m.avatar })}
                        className="inline-flex items-center justify-center gap-1.5 flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message
                      </button>
                      <button
                        onClick={() => router.push('/profile/' + m.id)}
                        className="flex-1 bg-chestnut text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                      >
                        View Profile →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </>)}
          </>
        )}

        {/* ---- BROWSE TAB: MUSICIAN PROFILE ---- */}
        {activeTab === 'browse' && selectedLiveMusician && (
          <div>
            <button onClick={() => setSelectedLiveMusician(null)} className="flex items-center gap-1.5 text-charcoal text-sm mb-5 hover:text-chestnut transition-colors font-medium">
              ← Back to Browse
            </button>
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <div className="flex items-center gap-4 mb-5">
                <Avatar src={selectedLiveMusician.avatar} className="w-20 h-20 rounded-2xl" textSize="text-4xl" bg="bg-chestnut/10" />
                <div>
                  <h2 className="text-graphite text-xl font-black">{selectedLiveMusician.name}</h2>
                  {selectedLiveMusician.genres.length > 0 && (
                    <p className="text-charcoal text-sm mt-0.5">{selectedLiveMusician.genres.join(' · ')}</p>
                  )}
                  <p className="inline-flex items-center gap-1 text-chestnut text-sm mt-1 font-semibold"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{selectedLiveMusician.distanceStr}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Location</p>
                  <p className="text-graphite font-bold text-sm">{selectedLiveMusician.location || '—'}</p>
                </div>
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Distance</p>
                  <p className="text-graphite font-bold text-sm">{selectedLiveMusician.distanceStr}</p>
                </div>
              </div>
              {selectedLiveMusician.bio && (
                <div className="mb-4">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">About</p>
                  <p className="text-charcoal text-sm leading-relaxed">{selectedLiveMusician.bio}</p>
                </div>
              )}
              {(selectedLiveMusician.instagram || selectedLiveMusician.youtube || selectedLiveMusician.spotify) && (
                <div>
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Links</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedLiveMusician.instagram && (
                      <a href={buildSocialUrl('instagram', selectedLiveMusician.instagram)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>Instagram</a>
                    )}
                    {selectedLiveMusician.youtube && (
                      <a href={buildSocialUrl('youtube', selectedLiveMusician.youtube)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z"/></svg>YouTube</a>
                    )}
                    {selectedLiveMusician.spotify && (
                      <a href={buildSocialUrl('spotify', selectedLiveMusician.spotify)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Spotify</a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openConversation({ id: selectedLiveMusician.id, name: selectedLiveMusician.name, avatar: selectedLiveMusician.avatar })}
                className="inline-flex items-center justify-center gap-1.5 flex-1 bg-graphite text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Message
              </button>
              <button
                onClick={() => { setSelectedLiveMusician(null) }}
                className="flex-1 bg-chestnut text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                ← Back to Browse
              </button>
            </div>
          </div>
        )}

        {/* ---- ANALYTICS TAB ---- */}
        {activeTab === 'profile' && (
          <>
            {/* Header */}
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">· The Room</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Your <span className="text-chestnut italic">Venue.</span>
              </h2>
            </div>

            {/* Hero venue card */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-4 shadow-xl">
              <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-40 h-40 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.07] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 13)} />
                ))}
              </div>
              <div className="relative z-10 p-6">
                <div className="flex items-start gap-4 mb-4">
                  {profile.avatar
                    ? <img src={profile.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover shrink-0 shadow-inner border-2 border-chestnut/40" />
                    : <div className="w-20 h-20 rounded-2xl bg-chestnut/20 border-2 border-chestnut/40 flex items-center justify-center shrink-0 shadow-inner text-chestnut">
                        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                      </div>}
                  <div className="flex-1 min-w-0">
                    {profile.type && (
                      <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-chestnut/30 text-chestnut mb-1.5">{profile.type}</span>
                    )}
                    <p className="text-snow font-black text-2xl leading-tight tracking-tight">{profile.name || 'Your Venue'}</p>
                    {profile.address && (
                      <p className="text-snow/50 text-xs mt-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                        {profile.address}
                      </p>
                    )}
                  </div>
                </div>
                {profile.description && (
                  <p className="text-snow/70 text-sm leading-relaxed">{profile.description}</p>
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

            {/* Invite a musician you already book */}
            <button
              onClick={() => setInvitePeopleOpen(true)}
              className="w-full flex items-center justify-center gap-2 bg-teal text-snow py-3.5 rounded-2xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm mb-3"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Invite a musician you book
            </button>

            {invitePeopleOpen && (
              <InvitePeopleModal invitedRole="musician" onClose={() => setInvitePeopleOpen(false)} />
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
                <p className="text-charcoal/50 text-xs mt-0.5">View spend & download payment receipts</p>
              </div>
              <svg className="w-4 h-4 text-charcoal/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>

            {/* Analytics — visibility */}
            <div className="bg-graphite rounded-2xl p-5 shadow-sm mb-4 relative overflow-hidden">
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.08] pointer-events-none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 31)} />
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
              <div className="grid grid-cols-4 divide-x divide-charcoal/[0.07]">
                {[
                  { value: analyticsShows, label: 'Shows' },
                  { value: analyticsOpenSlots, label: 'Open Slots' },
                  { value: analyticsRating != null ? analyticsRating.toFixed(1) : null, label: 'Avg Rating' },
                  { value: analyticsReviewCount, label: 'Reviews' },
                ].map(s => (
                  <div key={s.label} className="py-5 flex flex-col items-center">
                    {analyticsLoading ? (
                      <div className="h-7 w-8 bg-snow rounded animate-pulse mb-1" />
                    ) : (
                      <p className="text-chestnut text-2xl font-black">{s.value ?? '—'}</p>
                    )}
                    <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
                  </div>
                ))}
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

      {/* ---- MESSAGING (always mounted so ref is available) ---- */}
      <div className={activeTab !== 'messages' ? 'hidden' : ''}>
        <div className="max-w-2xl mx-auto px-4" style={{ paddingBottom: '96px' }}>
          {userId && (
            <MessagingTab ref={messagingRef} userId={userId} currentUserType="restaurant" onUnreadChange={setMsgUnread} onBookingsChanged={() => { if (userId) void loadSlots(userId) }} />
          )}
        </div>
      </div>

      {/* ---- BOTTOM TAB BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
          <TabButton animation="bounce" icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <TabButton animation="toss"   icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>} label="Bookings" active={activeTab === 'slots'} onClick={() => setActiveTab('slots')} badge={pendingApps > 0 ? pendingApps : undefined} />
          <TabButton animation="spin"   icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>} label="Browse" active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} />
          <TabButton animation="pop"    icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>} label="Messages" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} badge={msgUnread} />
          <TabButton animation="pulse"  icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

      {/* ---- EDIT SLOT MODAL ---- */}
      {editingSlot && (
        <Modal onClose={() => setEditingSlot(null)} labelledBy="edit-slot-title">
            <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Edit Slot</p>
                <h3 id="edit-slot-title" className="text-snow text-xl font-black tracking-tight">{editingSlot.date}</h3>
              </div>
              <button onClick={() => setEditingSlot(null)} className="text-snow/60 hover:text-snow transition-colors leading-none"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>
            <div className="p-6">
              {editingSlot.applications.some(a => a.status === 'pending') && (
                <div className="bg-chestnut/10 border border-chestnut/20 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-chestnut shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  <p className="text-chestnut text-xs leading-relaxed font-medium">This slot has pending applications. Editing the details will not automatically notify applicants.</p>
                </div>
              )}
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Date</label>
              <StyledSelect
                value={editDraft.date}
                onChange={v => setEditDraft(p => ({ ...p, date: v }))}
                options={getDateOptions(editDraft.date)}
                placeholder="Pick a date"
                className="mb-5"
              />
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Start Time</label>
                  <StyledSelect
                    value={editDraft.startTime}
                    onChange={v => setEditDraft(p => ({ ...p, startTime: v }))}
                    options={TIME_OPTIONS}
                    placeholder="Start"
                  />
                </div>
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">End Time</label>
                  <StyledSelect
                    value={editDraft.endTime}
                    onChange={v => setEditDraft(p => ({ ...p, endTime: v }))}
                    options={TIME_OPTIONS}
                    placeholder="End"
                  />
                </div>
              </div>
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Pay Offered</label>
              <div className="relative mb-5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal font-bold text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editDraft.budget}
                  onChange={e => setEditDraft(p => ({ ...p, budget: e.target.value.replace(/[^0-9]/g, '') }))}
                  className="w-full bg-white rounded-xl pl-8 pr-4 py-2.5 shadow-sm focus:outline-none text-sm border border-charcoal/10"
                />
              </div>
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
                Description <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                value={editDraft.notes}
                onChange={e => setEditDraft(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10"
              />
              <div className="flex gap-3">
                <button onClick={() => setEditingSlot(null)} disabled={savingEdit} className="flex-1 bg-snow text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50">Cancel</button>
                <button onClick={handleEditSlot} disabled={savingEdit} className="flex-1 bg-chestnut text-snow py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">{savingEdit ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </div>
        </Modal>
      )}

      {/* ---- INVITE MODAL (from Availability browse) ---- */}
      {inviteModal && (
        <InviteModal
          musicianId={inviteModal.musicianId}
          musicianName={inviteModal.musicianName}
          prefillDate={inviteModal.date}
          prefillStartTime={inviteModal.startTime}
          prefillEndTime={inviteModal.endTime}
          onClose={() => setInviteModal(null)}
          onSuccess={(bookingId) => {
            setInviteModal(null)
            setInviteSuccessBookingId(bookingId)
          }}
        />
      )}

      {/* ---- INVITE SUCCESS ---- */}
      {inviteSuccessBookingId && (
        <Modal onClose={() => setInviteSuccessBookingId(null)} size="sm" labelledBy="invite-success-title">
          <div className="p-6 text-center">
            <div className="w-12 h-12 bg-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h3 id="invite-success-title" className="text-graphite text-xl font-black mb-2">Invite Sent!</h3>
            <p className="text-charcoal/60 text-sm mb-5">The musician has been invited and will receive a notification.</p>
            <button
              onClick={() => setInviteSuccessBookingId(null)}
              className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </Modal>
      )}

      {/* ---- DECLINE APPLICATION MODAL ---- */}
      {declineApp && (
        <Modal onClose={() => setDeclineApp(null)} size="sm" labelledBy="decline-app-title">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></div>
              <h3 id="decline-app-title" className="text-graphite text-xl font-black text-center mb-2">Decline {declineApp.name}?</h3>
              <p className="text-charcoal text-sm text-center leading-relaxed mb-6">Their application will be declined and they'll be notified. This can't be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeclineApp(null)} disabled={decliningApp} className="flex-1 bg-snow text-charcoal py-3 rounded-xl text-sm font-medium border border-charcoal/10 hover:bg-[#E8E4E0] transition-colors disabled:opacity-50">Keep</button>
                <button onClick={confirmDecline} disabled={decliningApp} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50">{decliningApp ? 'Declining…' : 'Yes, Decline'}</button>
              </div>
            </div>
        </Modal>
      )}

      {/* ---- CANCEL SLOT MODAL ---- */}
      {cancelSlotId && (
        <Modal onClose={() => setCancelSlotId(null)} size="sm" labelledBy="cancel-slot-title">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg></div>
              <h3 id="cancel-slot-title" className="text-graphite text-xl font-black text-center mb-2">Cancel this slot?</h3>
              {(() => {
                const slot = slots.find(s => s.id === cancelSlotId)
                const hasConfirmed = slot?.applications.some(a => a.status === 'confirmed')
                const hasPending = slot?.applications.some(a => a.status === 'pending')
                return hasConfirmed ? (
                  <p className="text-charcoal text-sm text-center leading-relaxed mb-6">This slot has a confirmed musician. Cancelling will also cancel their booking.</p>
                ) : hasPending ? (
                  <p className="text-charcoal text-sm text-center leading-relaxed mb-6">This slot has pending applications. They will be cancelled as well.</p>
                ) : (
                  <p className="text-charcoal text-sm text-center leading-relaxed mb-6">This slot will be marked as cancelled and hidden from musicians.</p>
                )
              })()}
              <div className="flex gap-3">
                <button onClick={() => setCancelSlotId(null)} disabled={cancellingSlot} className="flex-1 bg-snow text-charcoal py-3 rounded-xl text-sm font-medium border border-charcoal/10 hover:bg-[#E8E4E0] transition-colors disabled:opacity-50">Keep Slot</button>
                <button onClick={handleCancelSlot} disabled={cancellingSlot} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50">{cancellingSlot ? 'Cancelling…' : 'Yes, Cancel'}</button>
              </div>
            </div>
        </Modal>
      )}

      {/* ---- CANCEL BOOKING MODAL (refund flow) ---- */}
      {cancelBookingId && (
        <Modal onClose={() => setCancelBookingId(null)} size="sm" labelledBy="cancel-booking-title">
            <div className="bg-graphite rounded-t-3xl px-6 py-5">
              <h3 id="cancel-booking-title" className="text-snow font-black text-xl tracking-tight">Cancel Booking?</h3>
              <p className="text-snow/60 text-sm mt-1">
                {(() => {
                  const slot = slots.find(s => s.applications.some(a => a.id === cancelBookingId))
                  const app = slot?.applications.find(a => a.id === cancelBookingId)
                  return `${app?.musicianName ?? 'Musician'} · ${slot?.date ?? ''}`
                })()}
              </p>
            </div>
            <div className="px-6 py-5">
              <div className="bg-chestnut/10 border border-chestnut/30 rounded-xl px-4 py-3 mb-4">
                <p className="text-chestnut font-bold text-sm mb-1">Non-refundable platform fee</p>
                <p className="text-graphite text-xs leading-relaxed">
                  The 8% platform fee is non-refundable on restaurant cancellations.
                  The remaining 92% will be returned to your card within 5–10 business days.
                </p>
              </div>
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
                  {cancellingBooking ? 'Cancelling…' : 'Yes, Cancel'}
                </button>
              </div>
            </div>
        </Modal>
      )}

      {/* ---- POST SLOT MODAL ---- */}
      {postSlotOpen && (
        <Modal onClose={() => setPostSlotOpen(false)} labelledBy="post-slot-title">
            <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">New Listing</p>
                <h3 id="post-slot-title" className="text-snow text-xl font-black tracking-tight">Post a <span className="text-chestnut italic">Slot.</span></h3>
              </div>
              <button onClick={() => setPostSlotOpen(false)} className="text-snow/60 hover:text-snow transition-colors leading-none relative z-10"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>
            <div className="p-6">
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Date</label>
              <StyledSelect
                value={newSlot.date}
                onChange={v => setNewSlot(p => ({ ...p, date: v }))}
                options={getDateOptions()}
                placeholder="Pick a date"
                className="mb-5"
              />
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Start Time</label>
                  <StyledSelect
                    value={newSlot.startTime}
                    onChange={v => setNewSlot(p => ({ ...p, startTime: v, endTime: '' }))}
                    options={TIME_OPTIONS}
                    placeholder="Start"
                  />
                </div>
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">End Time</label>
                  <StyledSelect
                    value={newSlot.endTime}
                    onChange={v => setNewSlot(p => ({ ...p, endTime: v }))}
                    options={endTimeOptions(newSlot.startTime)}
                    placeholder={newSlot.startTime ? 'End' : 'Pick a start first'}
                    disabled={!newSlot.startTime}
                  />
                </div>
              </div>
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Pay Offered</label>
              <div className="relative mb-5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal font-bold text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  placeholder="e.g. 200"
                  min="0"
                  step="1"
                  value={newSlot.budget}
                  onChange={e => setNewSlot(p => ({ ...p, budget: e.target.value.replace(/[^0-9]/g, '') }))}
                  className="w-full bg-white rounded-xl pl-8 pr-4 py-2.5 shadow-sm focus:outline-none text-sm border border-charcoal/10"
                />
              </div>
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
                Description <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                placeholder="Tell musicians what you're looking for — vibe, genre preferences, attire, etc."
                value={newSlot.notes}
                onChange={e => setNewSlot(p => ({ ...p, notes: e.target.value }))}
                rows={3}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10"
              />
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-3">Genre Preferences</label>
              <div className="mb-5">
                <GenreSelector
                  selected={newSlot.genres}
                  onToggle={g => setNewSlot(p => ({ ...p, genres: p.genres.includes(g) ? p.genres.filter(x => x !== g) : [...p.genres, g] }))}
                />
              </div>

              {/* Preview */}
              {(newSlot.date || newSlot.budget) && (
                <div className="mb-5">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Preview — What musicians will see</p>
                  <div className="bg-[#F5F0EC] rounded-xl p-3 border border-charcoal/10">
                    <div className="bg-white rounded-xl p-3 border-l-4 border-l-[#6C9A8B]">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-graphite font-bold text-sm">{profile.name || 'Your Venue'}</p>
                          <p className="text-charcoal text-xs">{profile.address || 'Your Location'}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-teal font-black text-lg">{newSlot.budget ? formatMoney(Number(newSlot.budget)) : '—'}</p>
                          <p className="text-charcoal/50 text-[9px] font-semibold uppercase tracking-wide">pay offered</p>
                        </div>
                      </div>
                      {newSlot.date && <p className="text-charcoal text-xs mb-1">
                        {new Date(newSlot.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {newSlot.startTime ? ` · ${formatTime(newSlot.startTime)}` : ''}
                        {newSlot.endTime ? ` – ${formatTime(newSlot.endTime)}` : ''}
                      </p>}
                      {newSlot.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {newSlot.genres.map(g => <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full">{g}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {postSlotError && (
                <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-3 text-xs">{postSlotError}</p>
              )}
              <button
                onClick={handlePostSlot}
                disabled={postingSlot || !newSlot.date || !newSlot.startTime || !newSlot.endTime || !newSlot.budget}
                className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-black text-sm shadow-md hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {postingSlot ? 'Posting…' : 'Post Slot'}
              </button>
            </div>
        </Modal>
      )}

      {/* ---- PAYMENT MODAL ---- */}
      {paymentModalData && (
        <Elements
          stripe={stripePromise}
          options={{
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#DC7F41',
                fontFamily: 'Inter, sans-serif',
                borderRadius: '12px',
              },
            },
          }}
        >
          <PaymentModalInner
            slot={paymentModalData.slot}
            app={paymentModalData.app}
            onClose={() => setPaymentModalData(null)}
            onConfirmed={handlePaymentConfirmed}
          />
        </Elements>
      )}

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
          <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 17)} />
        ))}
      </div>
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-chestnut opacity-15 blur-2xl pointer-events-none" />
      <div className="relative z-10 p-8 text-center">
        <div className="w-16 h-16 bg-chestnut/20 border border-chestnut/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner text-chestnut">{icon}</div>
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

function StatCard({ value, label, color, icon, highlight }: { value: number | string; label: string; color: string; icon: React.ReactNode; highlight?: boolean }) {
  if (highlight) {
    return (
      <div className="relative bg-chestnut rounded-2xl p-4 shadow-md overflow-hidden">
        <span className="absolute top-2 right-2 text-snow/20 pointer-events-none">{icon}</span>
        <p className="text-snow text-3xl font-black tracking-tight leading-none">{value}</p>
        <p className="text-snow/70 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
      </div>
    )
  }
  return (
    <div className="relative bg-white rounded-2xl p-4 shadow-sm overflow-hidden">
      <span className="absolute top-2 right-2 text-charcoal/10 pointer-events-none">{icon}</span>
      <p className={`text-3xl font-black tracking-tight leading-none ${color}`}>{value}</p>
      <p className="text-charcoal text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
    </div>
  )
}

function TabButton({ icon, label, active, onClick, badge, animation = 'bounce' }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number; animation?: string }) {
  return (
    <button onClick={onClick} className={`py-1 min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors relative tab-hover-${animation}`}>
      <div className={`relative w-11 h-9 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-chestnut shadow-md' : ''}`}>
        <span className={`tab-icon flex items-center justify-center ${active ? 'text-snow' : 'text-charcoal/60'}`}>{icon}</span>
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-chestnut border-2 border-graphite rounded-full text-[9px] text-snow font-bold flex items-center justify-center">{badge}</span>
        )}
      </div>
      <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-chestnut' : 'text-snow/50'}`}>{label}</span>
    </button>
  )
}

function SlotCard({ slot, selectedSlotId, setSelectedSlotId, handleApplicationAction, onAccept, onMessage, onEdit, onCancel }: {
  slot: Slot
  selectedSlotId: string | null
  setSelectedSlotId: (id: string | null) => void
  handleApplicationAction: (slotId: string, appId: string, action: 'accept' | 'decline') => void
  onAccept: (app: Application) => void
  onMessage: (app: Application) => void
  onEdit?: () => void
  onCancel?: () => void
}) {
  const borderColor = slot.status === 'open' ? 'border-l-[#6C9A8B]' : slot.status === 'booked' ? 'border-l-[#DC7F41]' : 'border-l-[#bbb]'
  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${borderColor}`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p className="text-graphite font-bold">{slot.date}</p>
            <p className="text-charcoal text-sm mt-0.5">{slot.time}</p>
          </div>
          <StatusBadge status={slot.status} />
        </div>
        <div className="flex flex-wrap gap-1 mb-3">
          {slot.genres.map(g => <span key={g} className="text-xs bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>)}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-sm text-charcoal flex-wrap">
            <span>Pay Offered: <span className="text-teal font-black">{formatMoney(slot.budget)}</span></span>
            {slot.status === 'open' && (
              <span>{slot.applications.length} application{slot.applications.length !== 1 ? 's' : ''}</span>
            )}
            {slot.bookedMusician && slot.status !== 'open' && (
              <span className="text-chestnut font-semibold">{slot.bookedMusician}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {slot.status === 'open' && onEdit && (
              <button onClick={onEdit} className="text-charcoal/60 text-xs font-semibold hover:text-chestnut transition-colors">Edit</button>
            )}
            {(slot.status === 'open' || slot.status === 'booked') && onCancel && (
              <button onClick={onCancel} className="text-red-400 text-xs font-semibold hover:text-red-600 transition-colors">Cancel</button>
            )}
            {slot.status === 'open' && slot.applications.length > 0 && (
              <button
                onClick={() => setSelectedSlotId(selectedSlotId === slot.id ? null : slot.id)}
                className="text-chestnut text-sm font-bold hover:underline"
              >
                {selectedSlotId === slot.id ? 'Hide' : 'View Applications'}
              </button>
            )}
          </div>
        </div>
      </div>
      {selectedSlotId === slot.id && (
        <div className="border-t border-charcoal/10 bg-snow/50 p-4 space-y-3">
          {slot.applications.map(app => (
            <div key={app.id} className="bg-white rounded-xl p-3">
              <div className="flex items-start gap-3 mb-2">
                <Avatar src={app.avatar} className="w-9 h-9 rounded-full" textSize="text-base" bg="bg-chestnut/10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-graphite font-bold text-sm truncate">{app.musicianName}</p>
                    <div className="text-right shrink-0">
                      <p className="text-teal font-black text-sm">{formatMoney(slot.budget)}</p>
                      <p className="text-charcoal/50 text-[9px] uppercase tracking-wide">pay offered</p>
                    </div>
                  </div>
                  <p className="text-charcoal text-xs">{app.musicianGenre}</p>
                  {app.musicianLocation && <p className="inline-flex items-center gap-0.5 text-charcoal/60 text-xs mt-0.5"><svg className="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{app.musicianLocation}{app.musicianDistance ? ` · ${app.musicianDistance}` : ''}</p>}
                </div>
              </div>
              {(app.instagram || app.youtube || app.spotify) && (
                <div className="flex flex-wrap gap-3 mb-2">
                  {app.instagram && <a href={buildSocialUrl('instagram', app.instagram)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>Instagram</a>}
                  {app.youtube && <a href={buildSocialUrl('youtube', app.youtube)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z"/></svg>YouTube</a>}
                  {app.spotify && <a href={buildSocialUrl('spotify', app.spotify)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors"><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Spotify</a>}
                </div>
              )}
              {app.note && <div className="bg-snow rounded-lg px-3 py-2 mb-2"><p className="text-charcoal text-sm italic">"{app.note}"</p></div>}
              {app.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => onAccept(app)} className="flex-1 bg-teal text-snow py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">Accept</button>
                  <button onClick={() => onMessage(app)} className="px-3 py-2 rounded-lg text-xs font-medium bg-graphite/10 text-graphite hover:bg-graphite/20"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
                  <button onClick={() => handleApplicationAction(slot.id, app.id, 'decline')} className="flex-1 bg-snow text-charcoal py-2 rounded-lg text-xs font-medium hover:bg-[#E8E4E0] border border-charcoal/10">Decline</button>
                </div>
              ) : (
                <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase ${app.status === 'confirmed' ? 'bg-teal/10 text-teal' : 'bg-charcoal/10 text-charcoal'}`}>
                  {app.status === 'confirmed' ? 'Accepted' : 'Declined'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SlotCalendar({ slots, calendarMonth, setCalendarMonth, calendarSelectedDay, setCalendarSelectedDay, selectedSlotId, setSelectedSlotId, handleApplicationAction, onAccept, onMessage, onEditSlot, onCancelSlot }: {
  slots: Slot[]
  calendarMonth: Date
  setCalendarMonth: (d: Date) => void
  calendarSelectedDay: string | null
  setCalendarSelectedDay: (d: string | null) => void
  selectedSlotId: string | null
  setSelectedSlotId: (id: string | null) => void
  handleApplicationAction: (slotId: string, appId: string, action: 'accept' | 'decline') => void
  onAccept: (app: Application) => void
  onMessage: (app: Application) => void
  onEditSlot?: (slot: Slot) => void
  onCancelSlot?: (slotId: string) => void
}) {
  const year = calendarMonth.getFullYear()
  const month = calendarMonth.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDow = new Date(year, month, 1).getDay()
  const todayStr = new Date().toISOString().slice(0, 10)

  const slotsByDate: Record<string, Slot[]> = {}
  slots.forEach(slot => {
    if (!slotsByDate[slot.rawDate]) slotsByDate[slot.rawDate] = []
    slotsByDate[slot.rawDate].push(slot)
  })

  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const selectedDaySlots = calendarSelectedDay ? (slotsByDate[calendarSelectedDay] || []) : []
  const selectedDayLabel = calendarSelectedDay
    ? new Date(calendarSelectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button aria-label="Previous month" onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="text-charcoal hover:text-graphite transition-colors text-xl min-w-[44px] min-h-[44px] flex items-center justify-center">‹</button>
        <span className="text-graphite font-bold">{monthLabel}</span>
        <button aria-label="Next month" onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="text-charcoal hover:text-graphite transition-colors text-xl min-w-[44px] min-h-[44px] flex items-center justify-center">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-charcoal py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 bg-white rounded-2xl p-3 shadow-sm mb-4">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const daySlots = slotsByDate[dateStr] || []
          const isToday = dateStr === todayStr
          const isSelected = calendarSelectedDay === dateStr
          const hasOpen = daySlots.some(s => s.status === 'open')
          const hasBooked = daySlots.some(s => s.status === 'booked')
          const hasPast = daySlots.some(s => s.status === 'past')
          return (
            <button
              key={dateStr}
              onClick={() => setCalendarSelectedDay(isSelected ? null : dateStr)}
              className={`flex flex-col items-center py-2 rounded-xl text-sm font-medium transition-all ${isSelected ? 'bg-graphite text-snow' : isToday ? 'ring-2 ring-chestnut text-chestnut' : 'text-graphite hover:bg-snow'}`}
            >
              <span>{day}</span>
              {daySlots.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasOpen && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-snow/70' : 'bg-teal'}`} />}
                  {hasBooked && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-snow/70' : 'bg-chestnut'}`} />}
                  {hasPast && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-snow/40' : 'bg-charcoal/40'}`} />}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex gap-4 mb-5 px-1">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal" /><span className="text-xs text-charcoal font-medium">Open</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-chestnut" /><span className="text-xs text-charcoal font-medium">Booked</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-charcoal/40" /><span className="text-xs text-charcoal font-medium">Past</span></div>
      </div>
      {calendarSelectedDay ? (
        <>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-1 h-5 bg-chestnut rounded-full" />
            <h3 className="text-graphite font-bold text-sm">{selectedDayLabel}</h3>
          </div>
          {selectedDaySlots.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <p className="text-charcoal text-sm">No slots on this day.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedDaySlots.map(slot => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  selectedSlotId={selectedSlotId}
                  setSelectedSlotId={setSelectedSlotId}
                  handleApplicationAction={handleApplicationAction}
                  onAccept={onAccept}
                  onMessage={onMessage}
                  onEdit={slot.status === 'open' && onEditSlot ? () => onEditSlot(slot) : undefined}
                  onCancel={(slot.status === 'open' || slot.status === 'booked') && onCancelSlot ? () => onCancelSlot(slot.id) : undefined}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
          <p className="text-charcoal text-sm">Tap a day to see your slots.</p>
        </div>
      )}
    </>
  )
}


function getDateOptions(currentValue?: string) {
  const options: { value: string; label: string }[] = []
  const today = new Date()
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const value = d.toISOString().split('T')[0]
    const prefix = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' })
    options.push({ value, label: `${prefix} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })
  }
  if (currentValue && !options.some(o => o.value === currentValue)) {
    const d = new Date(currentValue + 'T00:00:00')
    options.unshift({
      value: currentValue,
      label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
    })
  }
  return options
}

function StyledSelect({ value, onChange, options, placeholder, className = '', disabled = false }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  disabled?: boolean
}) {
  return (
    <div className={`relative ${className}`}>
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
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}

