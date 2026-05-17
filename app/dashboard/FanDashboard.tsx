'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'

// ---- Types ----

type DiscoverView = 'venues' | 'musicians'

interface DiscoverVenue {
  id: string
  name: string
  type: string
  location: string
  avatar: string
  nextShow: string | null
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

interface Show {
  id: string
  venueId: string
  venueName: string
  venueAvatar: string
  musicianName: string
  date: string
  rawDate: string
  time: string
  genres: string[]
  isTonight: boolean
}

interface FanProfile {
  name: string
  bio: string
  location: string
  avatar: string
}

const RADIUS_OPTIONS = [10, 25, 50, 100]
const INITIAL_PROFILE: FanProfile = { name: 'Your Name', bio: '', location: '', avatar: '' }

// ---- Main Component ----

export default function FanDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('feed')

  const [venues, setVenues] = useState<DiscoverVenue[]>([])
  const [musicians, setMusicians] = useState<DiscoverMusician[]>([])
  const [shows, setShows] = useState<Show[]>([])

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  const [discoverView, setDiscoverView] = useState<DiscoverView>('venues')
  const [discoverSearch, setDiscoverSearch] = useState('')
  const [discoverRadius, setDiscoverRadius] = useState(25)
  const [discoverLoading, setDiscoverLoading] = useState(false)
  const [fanCoords, setFanCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })

  const [profile, setProfile] = useState<FanProfile>(INITIAL_PROFILE)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<FanProfile>(INITIAL_PROFILE)
  const [userId, setUserId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const loadShows = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10)

    // Step 1: confirmed bookings (needs bk_select_confirmed_public RLS policy)
    const { data: bookingsData, error: bookingsErr } = await supabase
      .from('bookings')
      .select('id, restaurant_id, musician_id, availability_id')
      .eq('status', 'confirmed')
    if (bookingsErr) { console.error('[Feed] bookings error:', bookingsErr.message); return }
    if (!bookingsData || bookingsData.length === 0) return

    // Step 2: fetch availability rows directly (avoids FK-join dependency)
    const availIds = [...new Set(bookingsData.map(b => b.availability_id))]
    const { data: availData, error: availErr } = await supabase
      .from('availability')
      .select('id, date, start_time, end_time, genres')
      .in('id', availIds)
      .gte('date', today)
    if (availErr) { console.error('[Feed] availability error:', availErr.message); return }
    if (!availData || availData.length === 0) return

    const availById = new Map(availData.map(a => [a.id, a]))
    const upcoming = bookingsData.filter(b => availById.has(b.availability_id))
    if (upcoming.length === 0) return

    // Step 3: venue + musician profiles
    const venueIds = [...new Set(upcoming.map(b => b.restaurant_id))]
    const musicianIds = [...new Set(upcoming.map(b => b.musician_id))]
    const [{ data: venueProfiles }, { data: musicianProfiles }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, role_metadata').in('id', venueIds),
      supabase.from('profiles').select('id, full_name').in('id', musicianIds),
    ])
    const venueById = new Map((venueProfiles ?? []).map(v => [v.id, v]))
    const musicianById = new Map((musicianProfiles ?? []).map(m => [m.id, m]))

    const fmtTime = (t: string) => {
      if (!t) return ''
      const [h, m] = t.split(':').map(Number)
      return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
    }

    const mapped: Show[] = upcoming.map(b => {
      const a = availById.get(b.availability_id)!
      const venue = venueById.get(b.restaurant_id)
      const musician = musicianById.get(b.musician_id)
      const meta = (venue?.role_metadata ?? {}) as Record<string, unknown>
      const rawDate = a.date ?? ''
      const dateLabel = rawDate
        ? new Date(rawDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : ''
      return {
        id: b.id,
        venueId: b.restaurant_id,
        venueName: (meta.venue_name as string | undefined) ?? venue?.full_name ?? 'Venue',
        venueAvatar: venue?.avatar_url ?? '',
        musicianName: musician?.full_name ?? 'Musician',
        date: dateLabel,
        rawDate,
        time: `${fmtTime(a.start_time?.slice(0, 5) ?? '')} – ${fmtTime(a.end_time?.slice(0, 5) ?? '')}`,
        genres: Array.isArray(a.genres) ? (a.genres as string[]) : [],
        isTonight: rawDate === today,
      }
    }).sort((a, b) => a.rawDate.localeCompare(b.rawDate))

    setShows(mapped)
  }, [])

  const loadDiscover = useCallback(async (lat: number, lon: number, radius: number, uid: string) => {
    setDiscoverLoading(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, user_type, avatar_url, bio, location_text, latitude, longitude, role_metadata')
      .in('user_type', ['restaurant', 'musician'])
      .neq('id', uid)

    if (!profiles) { setDiscoverLoading(false); return }

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
          nextShow: null,
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
    setDiscoverLoading(false)
  }, [])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle()
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

      const { data: followsData } = await supabase
        .from('follows').select('following_id').eq('follower_id', user.id)
      if (followsData) setFollowedIds(new Set(followsData.map(f => f.following_id)))

      await loadShows()
      if (lat != null && lon != null) loadDiscover(lat, lon, 25, user.id)
    }
    load()
  }, [loadDiscover, loadShows])

  useEffect(() => {
    if (fanCoords.lat == null || fanCoords.lon == null || !userId) return
    loadDiscover(fanCoords.lat, fanCoords.lon, discoverRadius, userId)
  }, [discoverRadius, fanCoords, userId, loadDiscover])

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    const { error: upErr } = await supabase.from('profiles').update({
      full_name: profileDraft.name || null,
      bio: profileDraft.bio || null,
      location_text: profileDraft.location || null,
    }).eq('id', userId)
    setSavingProfile(false)
    if (upErr) {
      console.error('Profile save failed', upErr)
      return
    }
    setProfile(profileDraft)
    setEditingProfile(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleFollow = async (id: string) => {
    if (!userId) return
    if (followedIds.has(id)) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', id)
      setFollowedIds(prev => { const next = new Set(prev); next.delete(id); return next })
    } else {
      await supabase.from('follows').insert({ follower_id: userId, following_id: id })
      setFollowedIds(prev => new Set([...prev, id]))
    }
  }

  // Derived
  const followingCount = followedIds.size
  const feedShows = shows.filter(s => followedIds.has(s.venueId))
  const tonightShows = feedShows.filter(s => s.isTonight)
  const upcomingShows = feedShows.filter(s => !s.isTonight)
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/settings')}
              className="text-[11px] font-semibold uppercase tracking-[0.15em] text-snow/60 hover:text-chestnut transition-colors"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="text-[11px] font-semibold uppercase tracking-[0.15em] text-snow/60 hover:text-chestnut transition-colors"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* ---- FEED TAB ---- */}
        {activeTab === 'feed' && (
          <>
            {/* Profile hero — front row */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-teal rounded-t" style={eqBarStyle(i, 19)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-teal opacity-20 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />

              <div className="relative z-10 p-5 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-inner border border-chestnut/30" />
                  : <div className="w-14 h-14 rounded-2xl bg-chestnut/20 border border-chestnut/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">★</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">For Fans</p>
                  <p className="text-snow font-black text-lg leading-tight truncate">{profile.name}</p>
                  <p className="text-snow/50 text-xs mt-0.5 truncate">
                    {profile.location || 'Set your location in Profile'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="bg-chestnut text-snow px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0 shadow-lg"
                >
                  Discover
                </button>
              </div>
            </div>

            {/* Stats — tonight is the hero */}
            <div className="grid grid-cols-3 gap-2.5 mb-7">
              <StatCard value={followingCount} label="Following" color="text-chestnut" icon="❤️" />
              <StatCard value={tonightShows.length} label="Tonight" color="text-teal" icon="🎶" highlight />
              <StatCard value={upcomingShows.length} label="This Week" color="text-graphite" icon="📅" />
            </div>

            {/* Tonight */}
            {tonightShows.length > 0 && (
              <>
                <SectionHeader eyebrow="Live" title="Playing" accent="Tonight." live />
                <div className="space-y-3 mb-6">
                  {tonightShows.map(show => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              </>
            )}

            {/* Upcoming this week */}
            <SectionHeader eyebrow="The Feed" title="Upcoming" accent="Shows." />
            {feedShows.length === 0 ? (
              <EmptyState
                icon="🎵"
                title="Your feed is empty"
                body="Follow some venues and musicians to see their upcoming shows here."
                action={{ label: 'Discover Music', onClick: () => setActiveTab('discover') }}
              />
            ) : upcomingShows.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Nothing coming up this week"
                body="The venues you follow haven't posted upcoming shows yet. Check back soon."
              />
            ) : (
              <div className="space-y-3">
                {upcomingShows.map(show => (
                  <ShowCard key={show.id} show={show} />
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
                Find Your <span className="text-chestnut italic">Sound.</span>
              </h2>
            </div>

            {/* No location warning */}
            {fanCoords.lat == null && (
              <div className="bg-chestnut/10 border border-chestnut/20 rounded-2xl p-4 mb-5 text-sm text-chestnut font-medium">
                📍 Set your location in Profile to discover nearby venues and musicians.
              </div>
            )}

            {/* Segmented control */}
            <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border border-charcoal/10 mb-4">
              <button
                onClick={() => { setDiscoverView('venues'); setDiscoverSearch('') }}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${discoverView === 'venues' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
              >
                🍽 Venues {discoverView === 'venues' && !discoverLoading && `(${filteredVenues.length})`}
              </button>
              <button
                onClick={() => { setDiscoverView('musicians'); setDiscoverSearch('') }}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${discoverView === 'musicians' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
              >
                ♪ Musicians {discoverView === 'musicians' && !discoverLoading && `(${filteredMusicians.length})`}
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
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                      discoverRadius === r
                        ? 'bg-teal text-snow shadow-sm'
                        : 'bg-white text-charcoal shadow-sm hover:bg-snow'
                    }`}
                  >
                    {r} mi
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40 text-sm pointer-events-none">🔍</span>
              <input
                value={discoverSearch}
                onChange={e => setDiscoverSearch(e.target.value)}
                placeholder={discoverView === 'venues' ? 'Search by name, type, or location...' : 'Search by name or genre...'}
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>

            {discoverLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="eq-bar w-2 bg-chestnut rounded-t" style={eqBarStyle(i, 7)} />
                  ))}
                </div>
                <p className="text-charcoal text-sm font-medium">Finding local music…</p>
              </div>
            ) : (
              <>
                {/* Venues list */}
                {discoverView === 'venues' && (
                  filteredVenues.length === 0 ? (
                    <EmptyState
                      icon="🍽"
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
                              <p className="text-teal text-xs font-semibold mt-0.5">📍 {v.distance}</p>
                            </button>
                            <button
                              onClick={() => toggleFollow(v.id)}
                              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                isFollowing
                                  ? 'bg-chestnut/10 text-chestnut hover:bg-red-50 hover:text-red-500'
                                  : 'bg-chestnut text-snow hover:opacity-90'
                              }`}
                            >
                              {isFollowing ? 'Following' : '+ Follow'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}

                {/* Musicians list */}
                {discoverView === 'musicians' && (
                  filteredMusicians.length === 0 ? (
                    <EmptyState
                      icon="♪"
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
                                <p className="text-teal text-xs font-semibold mt-0.5">📍 {m.distance}</p>
                              </button>
                              <button
                                onClick={() => toggleFollow(m.id)}
                                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                  isFollowing
                                    ? 'bg-chestnut/10 text-chestnut hover:bg-red-50 hover:text-red-500'
                                    : 'bg-chestnut text-snow hover:opacity-90'
                                }`}
                              >
                                {isFollowing ? 'Following' : '+ Follow'}
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

        {/* ---- FOLLOWING TAB ---- */}
        {activeTab === 'following' && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Your Lineup</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                You're <span className="text-chestnut italic">Following.</span>
              </h2>
            </div>

            {followingCount === 0 ? (
              <EmptyState
                icon="❤️"
                title="Not following anyone yet"
                body="Discover venues and musicians and follow them to see their shows in your feed."
                action={{ label: 'Start Discovering', onClick: () => setActiveTab('discover') }}
              />
            ) : (
              <>
                {/* Followed venues */}
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
                            <p className="text-charcoal text-xs">{v.type} · {v.location}</p>
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

                {/* Followed musicians */}
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

            {/* Hero card */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-4 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-teal rounded-t" style={eqBarStyle(i, 47)} />
                ))}
              </div>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-chestnut opacity-15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-10 w-40 h-40 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />

              <div className="relative z-10 p-8 flex flex-col items-center text-center">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-24 h-24 rounded-2xl object-cover mb-4 shadow-inner border-2 border-chestnut/30" />
                  : <div className="w-24 h-24 bg-chestnut/20 border-2 border-chestnut/30 rounded-2xl flex items-center justify-center text-5xl mb-4 shadow-inner">★</div>}
                <p className="text-snow font-black text-2xl tracking-tight">{profile.name}</p>
                {profile.location && (
                  <p className="text-snow/50 text-sm mt-1">📍 {profile.location}</p>
                )}
              </div>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="relative bg-white rounded-2xl p-4 shadow-sm text-center overflow-hidden">
                <span className="absolute -bottom-2 -right-1 text-4xl opacity-10 pointer-events-none select-none">🍽</span>
                <p className="text-chestnut text-3xl font-black tracking-tight leading-none">{followedVenues.length}</p>
                <p className="text-charcoal text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Venues</p>
              </div>
              <div className="relative bg-white rounded-2xl p-4 shadow-sm text-center overflow-hidden">
                <span className="absolute -bottom-2 -right-1 text-4xl opacity-10 pointer-events-none select-none">♪</span>
                <p className="text-chestnut text-3xl font-black tracking-tight leading-none">{followedMusicians.length}</p>
                <p className="text-charcoal text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Musicians</p>
              </div>
            </div>

            {/* Edit fields */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mb-4">
              <ProfileField
                label="Display Name"
                value={editingProfile ? profileDraft.name : profile.name}
                editing={editingProfile}
                onChange={v => setProfileDraft(p => ({ ...p, name: v }))}
              />
              <ProfileField
                label="Bio"
                value={editingProfile ? profileDraft.bio : profile.bio}
                editing={editingProfile}
                onChange={v => setProfileDraft(p => ({ ...p, bio: v }))}
                multiline
                placeholder="Tell us what kind of music you love..."
              />
              <ProfileField
                label="Location"
                value={editingProfile ? profileDraft.location : profile.location}
                editing={editingProfile}
                onChange={v => setProfileDraft(p => ({ ...p, location: v }))}
                placeholder="City, State"
              />
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

      {/* ---- BOTTOM TAB BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-4 px-2 py-2">
          <TabButton icon="🎶" label="Feed"      active={activeTab === 'feed'}      onClick={() => setActiveTab('feed')} />
          <TabButton icon="🔍" label="Discover"  active={activeTab === 'discover'}  onClick={() => setActiveTab('discover')} />
          <TabButton icon="❤️" label="Following" active={activeTab === 'following'} onClick={() => setActiveTab('following')} badge={followingCount} />
          <TabButton icon="★"  label="Profile"   active={activeTab === 'profile'}   onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

    </div>
  )
}

// ---- Sub-components ----

function ShowCard({ show }: { show: Show }) {
  const [, datePart] = show.date.split(', ')
  const [mon, day] = (datePart || show.date).split(' ')
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className="bg-chestnut/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
        {show.isTonight ? (
          <>
            <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">LIVE</p>
            <p className="text-chestnut text-lg font-black leading-tight">★</p>
          </>
        ) : (
          <>
            <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">{mon}</p>
            <p className="text-chestnut text-2xl font-black leading-tight">{day}</p>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-graphite font-bold text-sm truncate">{show.musicianName}</p>
        <p className="text-charcoal text-xs mt-0.5">@ {show.venueName} · {show.time}</p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {show.genres.map(g => (
            <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
          ))}
        </div>
      </div>
      <Avatar src={show.venueAvatar} className="w-10 h-10 rounded-full shrink-0" textSize="text-xl" />
    </div>
  )
}

function SectionHeader({ title, eyebrow, accent, live }: { title: string; eyebrow?: string; accent?: string; live?: boolean }) {
  return (
    <div className="mb-4 mt-2">
      {(eyebrow || live) && (
        <div className="flex items-center gap-2 mb-1">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
            </span>
          )}
          {eyebrow && <p className={`text-[10px] font-semibold uppercase tracking-[0.3em] ${live ? 'text-teal' : 'text-chestnut'}`}>{eyebrow}</p>}
        </div>
      )}
      <h3 className="text-graphite text-2xl font-black tracking-tight leading-none">
        {title}
        {accent && <span className={`italic ${live ? 'text-teal' : 'text-chestnut'}`}> {accent}</span>}
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
          <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 29)} />
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
  value: number
  label: string
  color: string
  icon: string
  highlight?: boolean
}) {
  if (highlight) {
    return (
      <div className="relative bg-teal rounded-2xl p-3 shadow-md overflow-hidden">
        <span className="absolute -bottom-2 -right-1 text-4xl opacity-25 pointer-events-none select-none">{icon}</span>
        <p className="text-snow text-2xl font-black tracking-tight leading-none">{value}</p>
        <p className="text-snow/80 text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
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
