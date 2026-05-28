'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'
import MessagingTab, { MessagingTabRef } from '@/components/MessagingTab'
import { useToast } from '@/components/Toast'
import NotificationBell from '@/components/NotificationBell'
import {
  SkeletonStatCard,
  SkeletonMusicianCard,
  SkeletonGigCard,
} from '@/components/Skeleton'

// ---- Types ----

type DiscoverView = 'venues' | 'musicians'

interface FeedGig {
  id: string
  restaurantId: string
  restaurantName: string
  restaurantAvatar: string
  restaurantLocation: string
  musicianId: string
  musicianName: string
  musicianAvatar: string
  performerType: 'solo' | 'band' | null
  bandMembers: number | null
  rawDate: string
  date: string
  time: string
  rawEndDatetime: string
  distance: number | null
}

interface DiscoverVenue {
  id: string
  name: string
  type: string
  location: string
  avatar: string
  distance: string
}

interface DiscoverMusician {
  id: string
  name: string
  genres: string[]
  avatar: string
  bio: string
  distance: string
}

interface FanProfile {
  name: string
  bio: string
  location: string
  avatar: string
}

const RADIUS_OPTIONS = [10, 25, 50, 100]
const INITIAL_PROFILE: FanProfile = { name: 'Your Name', bio: '', location: '', avatar: '' }

// ---- Helpers ----

function fmt(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function getDateGroupLabel(rawDate: string): string {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d = new Date(rawDate + 'T00:00:00'); d.setHours(0, 0, 0, 0)
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000)
  if (diffDays === 0) return 'TODAY'
  if (diffDays === 1) return 'TOMORROW'
  const dow = d.getDay()
  if (diffDays > 0 && diffDays <= 7 && (dow === 0 || dow === 6)) return 'THIS WEEKEND'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }).toUpperCase()
}

function groupGigsByDate(gigs: FeedGig[]): { label: string; gigs: FeedGig[] }[] {
  const groups: { label: string; gigs: FeedGig[] }[] = []
  for (const gig of gigs) {
    const label = getDateGroupLabel(gig.rawDate)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.gigs.push(gig)
    } else {
      groups.push({ label, gigs: [gig] })
    }
  }
  return groups
}

// ---- Main Component ----

export default function FanDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('feed')

  // Feed
  const [feedGigs, setFeedGigs] = useState<FeedGig[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  // Discover
  const [venues, setVenues] = useState<DiscoverVenue[]>([])
  const [musicians, setMusicians] = useState<DiscoverMusician[]>([])
  const [discoverView, setDiscoverView] = useState<DiscoverView>('venues')
  const [discoverSearch, setDiscoverSearch] = useState('')
  const [discoverRadius, setDiscoverRadius] = useState(25)
  const [discoverLoading, setDiscoverLoading] = useState(false)

  // Events sub-view
  const [eventsView, setEventsView] = useState<'events' | 'browse'>('events')
  const [eventsDateFilter, setEventsDateFilter] = useState<'all' | 'weekend' | 'week' | 'month'>('all')
  const [eventsDistanceFilter, setEventsDistanceFilter] = useState(25)

  // Fan state
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [fanCoords, setFanCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })
  const fanCoordsRef = useRef<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })

  // Profile
  const [profile, setProfile] = useState<FanProfile>(INITIAL_PROFILE)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<FanProfile>(INITIAL_PROFILE)
  const [userId, setUserId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const { toast } = useToast()

  // Messaging
  const messagingRef = useRef<MessagingTabRef>(null)
  const [msgUnread, setMsgUnread] = useState(0)

  // Return from profile page → messages tab
  useEffect(() => {
    const go = sessionStorage.getItem('drumup_goto_messages')
    if (go) { sessionStorage.removeItem('drumup_goto_messages'); setActiveTab('messages') }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep coords ref in sync so the realtime callback always has fresh coords
  useEffect(() => { fanCoordsRef.current = fanCoords }, [fanCoords])

  // ---- Data loading ----

  const loadFeed = useCallback(async (lat: number | null, lon: number | null) => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const thirtyDays = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

      const { data: bookings, error: bErr } = await supabase
        .from('bookings')
        .select('id, restaurant_id, musician_id, availability_id')
        .eq('status', 'confirmed')

      if (bErr) { console.error('[Feed] bookings:', bErr.message); return }
      if (!bookings?.length) { setFeedGigs([]); return }

      const availIds = [...new Set(bookings.map(b => b.availability_id))]
      const venueIds = [...new Set(bookings.map(b => b.restaurant_id))]
      const musicianIds = [...new Set(bookings.map(b => b.musician_id))]

      const [{ data: avails }, { data: vProfiles }, { data: mProfiles }] = await Promise.all([
        supabase.from('availability')
          .select('id, date, start_time, end_time')
          .in('id', availIds)
          .gte('date', today)
          .lte('date', thirtyDays),
        supabase.from('profiles')
          .select('id, full_name, avatar_url, role_metadata, location_text, latitude, longitude')
          .in('id', venueIds),
        supabase.from('profiles')
          .select('id, full_name, avatar_url, performer_type, band_members')
          .in('id', musicianIds),
      ])

      const availById = new Map((avails ?? []).map(a => [a.id, a as Record<string, unknown>]))
      const venueById = new Map((vProfiles ?? []).map(v => [v.id, v as Record<string, unknown>]))
      const musicianById = new Map((mProfiles ?? []).map(m => [m.id, m as Record<string, unknown>]))

      const now = new Date()
      const gigs: FeedGig[] = bookings
        .filter(b => availById.has(b.availability_id))
        .flatMap(b => {
          const a = availById.get(b.availability_id)!
          const venue = venueById.get(b.restaurant_id)
          const musician = musicianById.get(b.musician_id)

          const rawDate = a.date as string ?? ''
          const endTime = a.end_time as string ?? '23:59:00'
          const rawEndDatetime = `${rawDate}T${endTime}`
          if (new Date(rawEndDatetime) < now) return []

          const meta = (venue?.role_metadata ?? {}) as Record<string, unknown>
          const vLat = venue?.latitude as number | null ?? null
          const vLng = venue?.longitude as number | null ?? null
          const distance = (lat != null && lon != null && vLat != null && vLng != null)
            ? milesBetween(lat, lon, vLat, vLng)
            : null

          const pt = musician?.performer_type as string | null
          const performerType: 'solo' | 'band' | null = (pt === 'solo' || pt === 'band') ? pt : null
          const startTime = a.start_time as string ?? ''

          return [{
            id: b.id,
            restaurantId: b.restaurant_id,
            restaurantName: (meta.venue_name as string | undefined) ?? venue?.full_name as string ?? 'Venue',
            restaurantAvatar: venue?.avatar_url as string ?? '',
            restaurantLocation: venue?.location_text as string ?? '',
            musicianId: b.musician_id,
            musicianName: musician?.full_name as string ?? 'Musician',
            musicianAvatar: musician?.avatar_url as string ?? '',
            performerType,
            bandMembers: musician?.band_members as number | null ?? null,
            rawDate,
            date: rawDate
              ? new Date(rawDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : '',
            time: `${fmt(startTime.slice(0, 5))} – ${fmt(endTime.slice(0, 5))}`,
            rawEndDatetime,
            distance,
          } satisfies FeedGig]
        })
        .sort((a, b) => a.rawDate.localeCompare(b.rawDate) || a.time.localeCompare(b.time))

      setFeedGigs(gigs)
    } catch (err) {
      console.error('[Feed] loadFeed error:', err)
    }
  }, [])

  const loadDiscover = useCallback(async (lat: number, lon: number, radius: number, uid: string) => {
    setDiscoverLoading(true)
    try {
      const { data: profiles, error: discErr } = await supabase
        .from('profiles')
        .select('id, full_name, user_type, avatar_url, bio, location_text, latitude, longitude, role_metadata')
        .in('user_type', ['restaurant', 'musician'])
        .neq('id', uid)

      if (discErr) throw discErr
      if (!profiles) return

      const inRange = profiles
        .filter(p => p.latitude != null && p.longitude != null)
        .map(p => ({ ...p, dist: milesBetween(lat, lon, p.latitude as number, p.longitude as number) }))
        .filter(p => p.dist <= radius)
        .sort((a, b) => a.dist - b.dist)

      const newVenues: DiscoverVenue[] = []
      const newMusicians: DiscoverMusician[] = []
      for (const p of inRange) {
        const meta = (p.role_metadata ?? {}) as Record<string, unknown>
        if (p.user_type === 'restaurant') {
          newVenues.push({
            id: p.id,
            name: (meta.venue_name as string | undefined) ?? p.full_name ?? 'Venue',
            type: (meta.cuisine_type as string | undefined) ?? '',
            location: p.location_text ?? '',
            avatar: p.avatar_url ?? '',
            distance: `${p.dist.toFixed(1)} mi`,
          })
        } else {
          newMusicians.push({
            id: p.id,
            name: p.full_name ?? 'Musician',
            genres: Array.isArray(meta.genres) ? (meta.genres as string[]) : [],
            avatar: p.avatar_url ?? '',
            bio: p.bio ?? '',
            distance: `${p.dist.toFixed(1)} mi`,
          })
        }
      }
      setVenues(newVenues)
      setMusicians(newMusicians)
    } catch (err) {
      console.error('Failed to load discover:', err)
      toast.error('Could not load nearby venues and musicians.')
    } finally {
      setDiscoverLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        if (!user) return
        setUserId(user.id)

        // NOTE: Never include legal_name in queries unless fetching the current user's own profile
        // or in server-side Stripe routes. legal_name is private.
        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('full_name, bio, location_text, avatar_url, latitude, longitude')
          .eq('id', user.id).maybeSingle()
        if (profileErr) throw profileErr
        if (!data) return

        setProfile({
          name: data.full_name ?? '',
          bio: data.bio ?? '',
          location: data.location_text ?? '',
          avatar: data.avatar_url ?? '',
        })

        const lat = data.latitude as number | null
        const lon = data.longitude as number | null
        setFanCoords({ lat, lon })
        setDataLoading(false)

        const { data: followsData } = await supabase
          .from('follows').select('following_id').eq('follower_id', user.id)
        if (followsData) setFollowedIds(new Set(followsData.map(f => f.following_id)))

        await loadFeed(lat, lon)
        setFeedLoading(false)
        setLastRefreshed(new Date())

        if (lat != null && lon != null) loadDiscover(lat, lon, 25, user.id)
      } catch (err) {
        console.error('Failed to load fan dashboard:', err)
        toast.error('Failed to load your dashboard. Please refresh.')
        setDataLoading(false)
        setFeedLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFeed, loadDiscover])

  // Re-run discover when radius changes
  useEffect(() => {
    if (fanCoords.lat == null || fanCoords.lon == null || !userId) return
    loadDiscover(fanCoords.lat, fanCoords.lon, discoverRadius, userId)
  }, [discoverRadius, fanCoords, userId, loadDiscover])

  // Realtime: new confirmed bookings → refetch feed
  useEffect(() => {
    const channel = supabase
      .channel('fan-feed-bookings')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: 'status=eq.confirmed',
      }, () => {
        const { lat, lon } = fanCoordsRef.current
        loadFeed(lat, lon)
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [loadFeed])

  // ---- Actions ----

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    try {
      const { error: upErr } = await supabase.from('profiles').update({
        full_name: profileDraft.name || null,
        bio: profileDraft.bio || null,
        location_text: profileDraft.location || null,
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

  const toggleFollow = async (id: string) => {
    if (!userId) return
    const wasFollowing = followedIds.has(id)
    // Optimistic update
    setFollowedIds(prev => {
      const next = new Set(prev)
      if (wasFollowing) next.delete(id); else next.add(id)
      return next
    })
    try {
      if (wasFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: id })
        if (error) throw error
      }
    } catch (err) {
      // Revert optimistic update on failure
      setFollowedIds(prev => {
        const next = new Set(prev)
        if (wasFollowing) next.add(id); else next.delete(id)
        return next
      })
      console.error('Follow toggle failed:', err)
      toast.error('Could not update follow. Please try again.')
    }
  }

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await loadFeed(fanCoords.lat, fanCoords.lon)
      setLastRefreshed(new Date())
    } finally {
      setRefreshing(false)
    }
  }

  // ---- Derived ----

  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const followingGigs = feedGigs.filter(g =>
    followedIds.has(g.restaurantId) || followedIds.has(g.musicianId)
  )

  const nearbyGigs = feedGigs
    .filter(g => {
      if (followedIds.has(g.restaurantId) || followedIds.has(g.musicianId)) return false
      return g.distance != null && g.distance <= discoverRadius
    })
    .slice(0, 20)

  const followingCount = followedIds.size
  const tonightCount = followingGigs.filter(g => g.rawDate === today).length
  const thisWeekCount = followingGigs.filter(g => g.rawDate >= today && g.rawDate <= sevenDaysFromNow).length

  const followedVenues = venues.filter(v => followedIds.has(v.id))
  const followedMusicians = musicians.filter(m => followedIds.has(m.id))

  const filteredVenues = venues.filter(v => {
    const q = discoverSearch.toLowerCase()
    return !q || v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q) || v.location.toLowerCase().includes(q)
  })
  const filteredMusicians = musicians.filter(m => {
    const q = discoverSearch.toLowerCase()
    return !q || m.name.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q))
  })

  const formatLastRefreshed = () => {
    if (!lastRefreshed) return ''
    const diff = Math.round((Date.now() - lastRefreshed.getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return `${Math.floor(diff / 3600)}h ago`
  }

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
              <button onClick={() => setHeaderMenuOpen(o => !o)} className="flex items-center gap-2 group">
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

        {/* ---- FEED TAB ---- */}
        {activeTab === 'feed' && (
          <>
            {/* Profile hero */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/3 flex items-end justify-around opacity-[0.18] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-teal rounded-t" style={eqBarStyle(i, 19)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-teal opacity-20 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-teal opacity-[0.18] blur-2xl pointer-events-none" />
              <div className="relative z-10 p-6 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0 shadow-inner border-2 border-teal/40" />
                  : <div className="w-16 h-16 rounded-2xl bg-teal/20 border-2 border-teal/40 flex items-center justify-center shrink-0 shadow-inner text-teal"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-teal text-[10px] font-bold uppercase tracking-[0.3em] mb-1">Fan</p>
                  <p className="text-snow font-black text-xl leading-tight truncate">{profile.name}</p>
                  <p className="text-snow/55 text-xs mt-1 truncate">{profile.location || 'Set your location in Profile'}</p>
                </div>
                <button onClick={() => setActiveTab('discover')} className="bg-chestnut text-snow px-5 py-3 rounded-xl text-sm font-black hover:opacity-90 transition-opacity shrink-0 shadow-lg">
                  Discover
                </button>
              </div>
            </div>

            {/* Stats */}
            {dataLoading ? (
              <div className="grid grid-cols-3 gap-2.5 mb-7">
                <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 mb-7">
                <StatCard value={followingCount} label="Following" color="text-chestnut" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>} />
                <StatCard value={tonightCount} label="Tonight" color="text-teal" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>} highlight={tonightCount > 0} />
                <StatCard value={thisWeekCount} label="This Week" color="text-graphite" icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>} />
              </div>
            )}

            {/* Section header + refresh */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-0.5">The Feed</p>
                <h2 className="text-graphite text-2xl font-black tracking-tight leading-none">
                  Your <span className="text-chestnut italic">Shows.</span>
                </h2>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 shadow-sm text-charcoal text-xs font-semibold hover:shadow-md transition-shadow disabled:opacity-60"
              >
                <svg className={`w-3.5 h-3.5 transition-transform ${refreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                {refreshing ? 'Refreshing…' : lastRefreshed ? `Updated ${formatLastRefreshed()}` : 'Refresh'}
              </button>
            </div>

            {/* ── FOLLOWING FEED ── */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-0.5 h-5 bg-chestnut rounded-full shrink-0" />
              <p className="text-charcoal text-[11px] font-black uppercase tracking-[0.2em]">Following Feed</p>
            </div>

            {followedIds.size === 0 ? (
              <div className="mb-8">
                <EmptyState
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
                  title="You're not following anyone yet"
                  body="Follow restaurants and musicians to see their upcoming gigs right here in your feed."
                  twoActions={[
                    { label: 'Browse Musicians →', onClick: () => { setActiveTab('discover'); setDiscoverView('musicians') } },
                    { label: 'Browse Venues →', onClick: () => { setActiveTab('discover'); setDiscoverView('venues') } },
                  ]}
                />
              </div>
            ) : feedLoading ? (
              <div className="space-y-4 mb-8">
                <SkeletonGigCard />
                <SkeletonGigCard />
                <SkeletonGigCard />
              </div>
            ) : followingGigs.length === 0 ? (
              <div className="mb-8">
                <EmptyState
                  icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>}
                  title="No upcoming shows from your follows"
                  body="The venues and artists you follow don't have confirmed shows in the next 30 days yet."
                  action={{ label: 'Discover More', onClick: () => setActiveTab('discover') }}
                />
              </div>
            ) : (
              <div className="mb-8">
                {groupGigsByDate(followingGigs).map(group => (
                  <div key={group.label}>
                    <DateGroupHeader label={group.label} />
                    <div className="space-y-3 mb-2">
                      {group.gigs.map(gig => (
                        <GigCard
                          key={gig.id}
                          gig={gig}
                          followedIds={followedIds}
                          onFollow={toggleFollow}
                          onViewProfile={id => router.push('/profile/' + id)}
                          showFollowButtons={false}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── DISCOVER NEARBY ── */}
            <div className="mb-4">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Local Scene</p>
              <h3 className="text-graphite text-2xl font-black tracking-tight leading-none">
                Discover <span className="text-chestnut italic">Nearby.</span>
              </h3>
              {fanCoords.lat != null && (
                <p className="text-charcoal text-xs mt-1.5">Upcoming shows within {discoverRadius} miles</p>
              )}
            </div>

            {fanCoords.lat == null ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>}
                title="Set your location to discover live music near you"
                body="Update your location in your profile to see shows near you."
                action={{ label: 'Update Location →', onClick: () => setActiveTab('profile') }}
              />
            ) : feedLoading ? (
              <div className="space-y-4">
                <SkeletonGigCard />
                <SkeletonGigCard />
              </div>
            ) : nearbyGigs.length === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>}
                title={`No upcoming shows within ${discoverRadius} miles`}
                body="Try increasing your discovery radius in the Discover tab."
              />
            ) : (
              <div>
                {groupGigsByDate(nearbyGigs).map(group => (
                  <div key={group.label}>
                    <DateGroupHeader label={group.label} />
                    <div className="space-y-3 mb-2">
                      {group.gigs.map(gig => (
                        <GigCard
                          key={gig.id}
                          gig={gig}
                          followedIds={followedIds}
                          onFollow={toggleFollow}
                          onViewProfile={id => router.push('/profile/' + id)}
                          showFollowButtons
                          showDistance
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- DISCOVER TAB ---- */}
        {activeTab === 'discover' && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Local Scene</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                {eventsView === 'events' ? <>Live <span className="text-chestnut italic">Events.</span></> : <>Find Your <span className="text-chestnut italic">Sound.</span></>}
              </h2>
            </div>

            {/* Events / Browse top toggle */}
            <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm">
              <button
                onClick={() => setEventsView('events')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${eventsView === 'events' ? 'bg-chestnut text-snow shadow-sm' : 'text-charcoal hover:text-graphite'}`}
              >
                Events
              </button>
              <button
                onClick={() => setEventsView('browse')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${eventsView === 'browse' ? 'bg-chestnut text-snow shadow-sm' : 'text-charcoal hover:text-graphite'}`}
              >
                Browse
              </button>
            </div>

            {/* ---- EVENTS VIEW ---- */}
            {eventsView === 'events' && (() => {
              const now = new Date()
              const weekendStart = new Date(); weekendStart.setHours(0,0,0,0)
              const day = weekendStart.getDay()
              const daysUntilFri = day <= 5 ? (5 - day) : 6
              const fridayDate = new Date(weekendStart); fridayDate.setDate(weekendStart.getDate() + daysUntilFri)
              const sundayDate = new Date(fridayDate); sundayDate.setDate(fridayDate.getDate() + 2); sundayDate.setHours(23,59,59,999)
              const weekEnd = new Date(weekendStart); weekEnd.setDate(weekendStart.getDate() + 7); weekEnd.setHours(23,59,59,999)
              const monthEnd = new Date(weekendStart); monthEnd.setDate(weekendStart.getDate() + 30); monthEnd.setHours(23,59,59,999)

              const eventGigs = feedGigs
                .filter(g => {
                  const endDt = new Date(g.rawEndDatetime)
                  if (endDt < now) return false
                  if (g.distance != null && g.distance > eventsDistanceFilter) return false
                  if (eventsDateFilter === 'weekend') {
                    const d = new Date(g.rawDate + 'T00:00:00')
                    return d >= fridayDate && d <= sundayDate
                  }
                  if (eventsDateFilter === 'week') return new Date(g.rawDate + 'T00:00:00') <= weekEnd
                  if (eventsDateFilter === 'month') return new Date(g.rawDate + 'T00:00:00') <= monthEnd
                  return true
                })

              const groupedEvents = groupGigsByDate(eventGigs)

              return (
                <>
                  {fanCoords.lat == null && (
                    <div className="bg-chestnut/10 border border-chestnut/20 rounded-2xl p-4 mb-4 text-sm text-chestnut font-medium">
                      <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Set your location in Profile to see distance.</span>
                    </div>
                  )}

                  {/* Date filter chips */}
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-0.5 no-scrollbar">
                    {([
                      { key: 'all' as const, label: 'All Dates' },
                      { key: 'weekend' as const, label: 'This Weekend' },
                      { key: 'week' as const, label: 'This Week' },
                      { key: 'month' as const, label: 'This Month' },
                    ]).map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setEventsDateFilter(opt.key)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${eventsDateFilter === opt.key ? 'bg-chestnut text-snow shadow-sm' : 'bg-white text-charcoal hover:bg-snow shadow-sm'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Distance filter */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-charcoal text-xs font-semibold uppercase tracking-wide shrink-0">Within</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {RADIUS_OPTIONS.map(r => (
                        <button
                          key={r}
                          onClick={() => setEventsDistanceFilter(r)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${eventsDistanceFilter === r ? 'bg-teal text-snow shadow-sm' : 'bg-white text-charcoal shadow-sm hover:bg-snow'}`}
                        >
                          {r} mi
                        </button>
                      ))}
                    </div>
                  </div>

                  {feedLoading ? (
                    <div className="space-y-3">
                      <SkeletonGigCard /><SkeletonGigCard /><SkeletonGigCard />
                    </div>
                  ) : eventGigs.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                      <div className="w-12 h-12 bg-charcoal/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-charcoal/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      </div>
                      <p className="text-graphite font-bold text-sm mb-1">No events found</p>
                      <p className="text-charcoal/50 text-xs">Try a wider date or distance filter.</p>
                    </div>
                  ) : (
                    <div>
                      {groupedEvents.map(group => (
                        <div key={group.label} className="mb-5">
                          <p className="text-charcoal/50 text-[10px] font-black uppercase tracking-[0.25em] mb-2">{group.label}</p>
                          <div className="space-y-3">
                            {group.gigs.map(gig => {
                              const venueFollowing = followedIds.has(gig.restaurantId)
                              const artistFollowing = followedIds.has(gig.musicianId)
                              return (
                                <div key={gig.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-start gap-3 mb-3">
                                    <button onClick={() => router.push('/profile/' + gig.restaurantId)} className="shrink-0">
                                      <Avatar src={gig.restaurantAvatar} className="w-11 h-11 rounded-full" textSize="text-xl" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                      <button onClick={() => router.push('/profile/' + gig.restaurantId)} className="text-left">
                                        <p className="text-graphite font-bold text-sm hover:text-chestnut transition-colors truncate">{gig.restaurantName}</p>
                                      </button>
                                      <p className="text-charcoal text-xs">{gig.time}</p>
                                      {gig.distance != null && (
                                        <p className="inline-flex items-center gap-0.5 text-teal text-xs font-semibold mt-0.5">
                                          <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                          {gig.distance < 1 ? '<1 mi' : `${gig.distance.toFixed(1)} mi`}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 mb-3 pl-14">
                                    <button onClick={() => router.push('/profile/' + gig.musicianId)}>
                                      <Avatar src={gig.musicianAvatar} className="w-7 h-7 rounded-full" textSize="text-sm" />
                                    </button>
                                    <button onClick={() => router.push('/profile/' + gig.musicianId)} className="flex-1 min-w-0 text-left">
                                      <p className="text-charcoal text-xs font-semibold truncate">
                                        {gig.musicianName}
                                        {gig.performerType === 'solo' && <span className="text-charcoal/40"> · Solo</span>}
                                        {gig.performerType === 'band' && <span className="text-charcoal/40"> · Band</span>}
                                      </p>
                                    </button>
                                  </div>
                                  <div className="flex gap-2 pl-0">
                                    <button
                                      onClick={() => toggleFollow(gig.restaurantId)}
                                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${venueFollowing ? 'bg-teal/10 text-teal border border-teal/30' : 'bg-snow text-charcoal border border-charcoal/10 hover:border-teal hover:text-teal'}`}
                                    >
                                      {venueFollowing ? 'Following Venue ✓' : '+ Follow Venue'}
                                    </button>
                                    <button
                                      onClick={() => toggleFollow(gig.musicianId)}
                                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${artistFollowing ? 'bg-teal/10 text-teal border border-teal/30' : 'bg-snow text-charcoal border border-charcoal/10 hover:border-teal hover:text-teal'}`}
                                    >
                                      {artistFollowing ? 'Following Artist ✓' : '+ Follow Artist'}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}

            {/* ---- BROWSE VIEW (original discover content) ---- */}
            {eventsView === 'browse' && (
              <>
            {fanCoords.lat == null && (
              <div className="bg-chestnut/10 border border-chestnut/20 rounded-2xl p-4 mb-5 text-sm text-chestnut font-medium">
                <span className="inline-flex items-center gap-1"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>Set your location in Profile to discover nearby venues and musicians.</span>
              </div>
            )}

            {/* Segmented control */}
            <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border border-charcoal/10 mb-4">
              <button
                onClick={() => { setDiscoverView('venues'); setDiscoverSearch('') }}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${discoverView === 'venues' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
              >
                <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>Venues</span> {discoverView === 'venues' && !discoverLoading && `(${filteredVenues.length})`}
              </button>
              <button
                onClick={() => { setDiscoverView('musicians'); setDiscoverSearch('') }}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${discoverView === 'musicians' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
              >
                <span className="inline-flex items-center gap-1.5"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>Musicians</span> {discoverView === 'musicians' && !discoverLoading && `(${filteredMusicians.length})`}
              </button>
            </div>

            {/* Radius picker */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-charcoal text-xs font-semibold uppercase tracking-wide shrink-0">Within</span>
              <div className="flex gap-1.5 flex-wrap">
                {RADIUS_OPTIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => setDiscoverRadius(r)}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${discoverRadius === r ? 'bg-teal text-snow shadow-sm' : 'bg-white text-charcoal shadow-sm hover:bg-snow'}`}
                  >
                    {r} mi
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal/40 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input
                value={discoverSearch}
                onChange={e => setDiscoverSearch(e.target.value)}
                placeholder={discoverView === 'venues' ? 'Search by name, type, or location...' : 'Search by name or genre...'}
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>

            {discoverLoading ? (
              <div className="space-y-3">
                <SkeletonMusicianCard /><SkeletonMusicianCard /><SkeletonMusicianCard /><SkeletonMusicianCard />
              </div>
            ) : (
              <>
                {discoverView === 'venues' && (
                  filteredVenues.length === 0 ? (
                    <EmptyState
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>}
                      title="No venues nearby"
                      body={fanCoords.lat == null ? 'Set your location in Profile to find venues.' : `No venues found within ${discoverRadius} miles. Try a larger radius.`}
                    />
                  ) : (
                    <div className="space-y-3">
                      {filteredVenues.map(v => {
                        const isFollowing = followedIds.has(v.id)
                        return (
                          <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                            <button onClick={() => router.push('/profile/' + v.id)} className="shrink-0">
                              <Avatar src={v.avatar} className="w-12 h-12 rounded-full" textSize="text-2xl" />
                            </button>
                            <button onClick={() => router.push('/profile/' + v.id)} className="flex-1 min-w-0 text-left">
                              <p className="text-graphite font-bold text-sm hover:text-chestnut transition-colors">{v.name}</p>
                              <p className="text-charcoal text-xs">{[v.type, v.location].filter(Boolean).join(' · ')}</p>
                              <p className="inline-flex items-center gap-0.5 text-teal text-xs font-semibold mt-0.5"><svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{v.distance}</p>
                            </button>
                            <button
                              onClick={() => toggleFollow(v.id)}
                              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isFollowing ? 'bg-teal text-snow hover:bg-teal/80' : 'border border-teal text-teal hover:bg-teal hover:text-snow'}`}
                            >
                              {isFollowing ? 'Following ✓' : '+ Follow'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}

                {discoverView === 'musicians' && (
                  filteredMusicians.length === 0 ? (
                    <EmptyState
                      icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>}
                      title="No musicians nearby"
                      body={fanCoords.lat == null ? 'Set your location in Profile to find musicians.' : `No musicians found within ${discoverRadius} miles. Try a larger radius.`}
                    />
                  ) : (
                    <div className="space-y-3">
                      {filteredMusicians.map(m => {
                        const isFollowing = followedIds.has(m.id)
                        return (
                          <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-4 mb-2">
                              <button onClick={() => router.push('/profile/' + m.id)} className="shrink-0">
                                <Avatar src={m.avatar} className="w-12 h-12 rounded-full" textSize="text-2xl" bg="bg-chestnut/10" />
                              </button>
                              <button onClick={() => router.push('/profile/' + m.id)} className="flex-1 min-w-0 text-left">
                                <p className="text-graphite font-bold text-sm hover:text-chestnut transition-colors">{m.name}</p>
                                <p className="text-charcoal text-xs">{m.genres.join(' · ')}</p>
                                <p className="inline-flex items-center gap-0.5 text-teal text-xs font-semibold mt-0.5"><svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{m.distance}</p>
                              </button>
                              <button
                                onClick={() => toggleFollow(m.id)}
                                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${isFollowing ? 'bg-teal text-snow hover:bg-teal/80' : 'border border-teal text-teal hover:bg-teal hover:text-snow'}`}
                              >
                                {isFollowing ? 'Following ✓' : '+ Follow'}
                              </button>
                            </div>
                            {m.bio && <p className="text-charcoal text-xs leading-relaxed pl-16">{m.bio}</p>}
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </>
            )}
              </>
            )}
          </>
        )}

        {/* ---- FOLLOWING TAB ---- */}
        {activeTab === 'following' && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Your Lineup</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                You&apos;re <span className="text-chestnut italic">Following.</span>
              </h2>
            </div>

            {followingCount === 0 ? (
              <EmptyState
                icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>}
                title="Not following anyone yet"
                body="Discover venues and musicians and follow them to see their shows in your feed."
                action={{ label: 'Start Discovering', onClick: () => setActiveTab('discover') }}
              />
            ) : (
              <>
                {followedVenues.length > 0 && (
                  <>
                    <SectionHeader title={`Venues · ${followedVenues.length}`} />
                    <div className="space-y-2 mb-6">
                      {followedVenues.map(v => (
                        <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                          <button onClick={() => router.push('/profile/' + v.id)} className="shrink-0">
                            <Avatar src={v.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" />
                          </button>
                          <button onClick={() => router.push('/profile/' + v.id)} className="flex-1 min-w-0 text-left">
                            <p className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors">{v.name}</p>
                            <p className="text-charcoal text-xs">{[v.type, v.location].filter(Boolean).join(' · ')}</p>
                          </button>
                          <button
                            onClick={() => toggleFollow(v.id)}
                            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            Unfollow
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {followedMusicians.length > 0 && (
                  <>
                    <SectionHeader title={`Musicians · ${followedMusicians.length}`} />
                    <div className="space-y-2">
                      {followedMusicians.map(m => (
                        <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                          <button onClick={() => router.push('/profile/' + m.id)} className="shrink-0">
                            <Avatar src={m.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" bg="bg-chestnut/10" />
                          </button>
                          <button onClick={() => router.push('/profile/' + m.id)} className="flex-1 min-w-0 text-left">
                            <p className="text-graphite font-bold text-sm truncate hover:text-chestnut transition-colors">{m.name}</p>
                            <p className="text-charcoal text-xs">{m.genres.join(' · ')}</p>
                          </button>
                          <button
                            onClick={() => toggleFollow(m.id)}
                            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            Unfollow
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === 'profile' && (
          <>
            <div className="flex items-end justify-between mb-5 gap-3">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Your Seat</p>
                <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                  Your <span className="text-chestnut italic">Profile.</span>
                </h2>
              </div>
              {!editingProfile ? (
                <button onClick={() => { setEditingProfile(true); setProfileDraft(profile) }} className="text-chestnut text-sm font-bold hover:underline shrink-0">Edit</button>
              ) : (
                <div className="flex gap-3 shrink-0">
                  <button onClick={() => setEditingProfile(false)} disabled={savingProfile} className="text-charcoal text-sm font-medium hover:underline disabled:opacity-50">Cancel</button>
                  <button onClick={saveProfile} disabled={savingProfile} className="bg-chestnut text-snow px-4 py-1.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">{savingProfile ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>

            <button onClick={() => router.push('/profile/' + userId)} className="flex items-center gap-1 text-chestnut text-sm font-bold hover:underline mb-4">
              View Public Profile →
            </button>

            {/* Hero card */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-4 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-teal rounded-t" style={eqBarStyle(i, 47)} />
                ))}
              </div>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-chestnut opacity-15 blur-3xl pointer-events-none" />
              <div className="relative z-10 p-8 flex flex-col items-center text-center">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-24 h-24 rounded-2xl object-cover mb-4 shadow-inner border-2 border-chestnut/30" />
                  : <div className="w-24 h-24 bg-chestnut/20 border-2 border-chestnut/30 rounded-2xl flex items-center justify-center mb-4 shadow-inner text-chestnut"><svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>}
                <p className="text-snow font-black text-2xl tracking-tight">{profile.name}</p>
                {profile.location && <p className="inline-flex items-center gap-1 text-snow/50 text-sm mt-1"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{profile.location}</p>}
              </div>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="relative bg-white rounded-2xl p-4 shadow-sm text-center overflow-hidden">
                <span className="absolute -bottom-1 -right-1 w-9 h-9 opacity-10 pointer-events-none select-none text-graphite"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></span>
                <p className="text-chestnut text-3xl font-black tracking-tight leading-none">{followedVenues.length}</p>
                <p className="text-charcoal text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Venues</p>
              </div>
              <div className="relative bg-white rounded-2xl p-4 shadow-sm text-center overflow-hidden">
                <span className="absolute -bottom-1 -right-1 w-9 h-9 opacity-10 pointer-events-none select-none text-graphite"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></span>
                <p className="text-chestnut text-3xl font-black tracking-tight leading-none">{followedMusicians.length}</p>
                <p className="text-charcoal text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Musicians</p>
              </div>
            </div>

            {/* Edit fields */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mb-4">
              <ProfileField label="Display Name" value={editingProfile ? profileDraft.name : profile.name} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, name: v }))} />
              <ProfileField label="Bio" value={editingProfile ? profileDraft.bio : profile.bio} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, bio: v }))} multiline placeholder="Tell us what kind of music you love..." />
              <ProfileField label="Location" value={editingProfile ? profileDraft.location : profile.location} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, location: v }))} placeholder="City, State" />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-graphite font-bold mb-3">Account</h3>
              <button onClick={handleLogout} className="w-full text-left text-sm text-charcoal hover:text-chestnut transition-colors py-1 font-medium">
                Log Out
              </button>
            </div>
          </>
        )}

      </main>

      {/* ---- MESSAGING (always mounted so ref is available) ---- */}
      <div className={activeTab !== 'messages' ? 'hidden' : ''}>
        <div className="max-w-2xl mx-auto px-4" style={{ paddingBottom: '96px' }}>
          {userId && <MessagingTab ref={messagingRef} userId={userId} onUnreadChange={setMsgUnread} />}
        </div>
      </div>

      {/* ---- BOTTOM TAB BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
          <TabButton animation="sway"    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>} label="Feed"      active={activeTab === 'feed'}      onClick={() => setActiveTab('feed')} />
          <TabButton animation="shake"   icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>} label="Events"  active={activeTab === 'discover'}  onClick={() => setActiveTab('discover')} />
          <TabButton animation="ping"    icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>} label="Following" active={activeTab === 'following'} onClick={() => setActiveTab('following')} badge={followingCount} />
          <TabButton animation="pop"     icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} label="Messages"  active={activeTab === 'messages'}  onClick={() => setActiveTab('messages')} badge={msgUnread} />
          <TabButton animation="float"   icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} label="Profile"   active={activeTab === 'profile'}   onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

    </div>
  )
}

// ---- Sub-components ----

function GigCard({
  gig,
  followedIds,
  onFollow,
  onViewProfile,
  showFollowButtons = false,
  showDistance = false,
}: {
  gig: FeedGig
  followedIds: Set<string>
  onFollow: (id: string) => void
  onViewProfile: (id: string) => void
  showFollowButtons?: boolean
  showDistance?: boolean
}) {
  const isFollowingRestaurant = followedIds.has(gig.restaurantId)
  const isFollowingMusician = followedIds.has(gig.musicianId)

  return (
    <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden animate-fade-in">
      {/* Restaurant header */}
      <div className="px-4 pt-3.5 pb-3 flex items-center gap-3">
        <Avatar src={gig.restaurantAvatar} className="w-10 h-10 rounded-full" textSize="text-lg" />
        <div className="flex-1 min-w-0">
          <p className="font-black text-graphite text-sm truncate">{gig.restaurantName}</p>
          <p className="inline-flex items-center gap-0.5 text-charcoal text-xs truncate"><svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{gig.restaurantLocation || 'See profile for location'}</p>
        </div>
        {showDistance && gig.distance != null && (
          <span className="text-[10px] font-semibold text-charcoal shrink-0 bg-snow px-2 py-0.5 rounded-full">
            {gig.distance.toFixed(1)} mi
          </span>
        )}
        {!showFollowButtons && isFollowingRestaurant && (
          <span className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded-full shrink-0">Following</span>
        )}
      </div>

      {/* Musician section — graphite with subtle glow */}
      <div
        className="px-4 py-5"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(220,127,65,0.05), transparent 70%), radial-gradient(ellipse 80% 60% at 90% 80%, rgba(108,154,139,0.05), transparent 70%), #333333',
        }}
      >
        <p className="inline-flex items-center gap-1 text-teal text-[10px] font-bold uppercase tracking-[0.2em] mb-2"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Live Music</p>
        <p className="text-snow font-black text-xl leading-tight mb-2">{gig.musicianName}</p>
        {gig.performerType ? (
          <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mb-3 ${gig.performerType === 'solo' ? 'bg-teal/20 text-teal' : 'bg-chestnut/20 text-chestnut'}`}>
            {gig.performerType === 'solo' ? <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>Solo Artist</span> : <span className="inline-flex items-center gap-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Band{gig.bandMembers ? ` · ${gig.bandMembers} members` : ''}</span>}
          </span>
        ) : <div className="mb-3" />}
        <p className="text-chestnut font-black text-sm">{gig.date} · {gig.time}</p>
      </div>

      {/* Action row */}
      <div className="px-4 py-3 flex gap-2 border-t border-charcoal/[0.07]">
        {showFollowButtons ? (
          <>
            <button
              onClick={() => onFollow(gig.restaurantId)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${isFollowingRestaurant ? 'bg-teal text-snow' : 'border border-teal text-teal hover:bg-teal hover:text-snow'}`}
            >
              {isFollowingRestaurant ? 'Following Venue ✓' : 'Follow Venue'}
            </button>
            <button
              onClick={() => onFollow(gig.musicianId)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${isFollowingMusician ? 'bg-teal text-snow' : 'border border-teal text-teal hover:bg-teal hover:text-snow'}`}
            >
              {isFollowingMusician ? 'Following Artist ✓' : 'Follow Artist'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onViewProfile(gig.restaurantId)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-charcoal border border-charcoal/20 hover:bg-snow transition-colors"
            >
              View Venue
            </button>
            <button
              onClick={() => onViewProfile(gig.musicianId)}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-charcoal border border-charcoal/20 hover:bg-snow transition-colors"
            >
              View Artist
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-5 mb-3 first:mt-0">
      <div className="w-0.5 h-4 bg-chestnut rounded-full shrink-0" />
      <span className="text-charcoal text-[10px] font-black uppercase tracking-[0.25em]">{label}</span>
      <div className="flex-1 h-px bg-charcoal/10" />
    </div>
  )
}

function SectionHeader({ title, eyebrow, accent, live }: { title: string; eyebrow?: string; accent?: string; live?: boolean }) {
  return (
    <div className="mb-5 mt-3">
      {(eyebrow || live) && (
        <div className="flex items-center gap-2 mb-1">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
            </span>
          )}
          {eyebrow && <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${live ? 'text-teal' : 'text-chestnut'}`}>{eyebrow}</p>}
        </div>
      )}
      <h3 className="text-graphite text-[1.65rem] font-black tracking-tight leading-none">
        {title}
        {accent && <span className={`italic ${live ? 'text-teal' : 'text-chestnut'}`}> {accent}</span>}
      </h3>
    </div>
  )
}

function EmptyState({ icon, title, body, action, twoActions }: {
  icon: React.ReactNode
  title: string
  body: string
  action?: { label: string; onClick: () => void }
  twoActions?: { label: string; onClick: () => void }[]
}) {
  return (
    <div className="relative bg-graphite rounded-3xl overflow-hidden shadow-md">
      <div className="absolute inset-x-0 bottom-0 top-2/3 flex items-end justify-around opacity-[0.08] pointer-events-none">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 29)} />
        ))}
      </div>
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-chestnut opacity-15 blur-2xl pointer-events-none" />
      <div className="relative z-10 p-8 text-center">
        <div className="w-16 h-16 bg-chestnut/20 border border-chestnut/30 rounded-2xl flex items-center justify-center text-chestnut mx-auto mb-4 shadow-inner">{icon}</div>
        <p className="text-snow font-black text-lg mb-1.5 tracking-tight">{title}</p>
        <p className="text-snow/60 text-sm leading-relaxed mb-5 max-w-xs mx-auto">{body}</p>
        {twoActions ? (
          <div className="flex gap-3 justify-center">
            {twoActions.map(a => (
              <button key={a.label} onClick={a.onClick} className="bg-chestnut/20 border border-chestnut/40 text-snow px-4 py-2 rounded-xl font-bold text-xs hover:bg-chestnut transition-colors">
                {a.label}
              </button>
            ))}
          </div>
        ) : action ? (
          <button onClick={action.onClick} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity">
            {action.label} →
          </button>
        ) : null}
      </div>
    </div>
  )
}

function StatCard({ value, label, color, icon, highlight }: {
  value: number
  label: string
  color: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  if (highlight) {
    return (
      <div className="relative bg-teal rounded-2xl p-4 shadow-md overflow-hidden">
        <span className="absolute -bottom-1 -right-1 w-10 h-10 opacity-20 pointer-events-none select-none text-snow">{icon}</span>
        <p className="text-snow text-3xl font-black tracking-tight leading-none">{value}</p>
        <p className="text-snow/80 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
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
          <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="w-full bg-snow rounded-xl px-3 py-2 text-sm text-graphite focus:outline-none resize-none border border-charcoal/10" placeholder={placeholder} />
        ) : (
          <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-snow rounded-xl px-3 py-2 text-sm text-graphite focus:outline-none border border-charcoal/10" placeholder={placeholder} />
        )
      ) : (
        <p className="text-graphite text-sm">
          {value || <span className="text-charcoal/50">{placeholder || 'Not set'}</span>}
        </p>
      )}
    </div>
  )
}
