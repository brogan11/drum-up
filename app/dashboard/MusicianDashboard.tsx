'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'

// ---- Types ----

type BookingStatus = 'pending' | 'confirmed' | 'cancelled'
type BookingFilter = 'all' | 'pending' | 'confirmed' | 'cancelled'

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
}

interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
  time: string
}

interface Conversation {
  id: string
  venue: string
  avatar: string
  lastMessage: string
  time: string
  unread: boolean
  messages: ChatMessage[]
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
}

// ---- Constants ----

const GENRES = ['Jazz', 'Blues', 'Acoustic', 'Folk', 'R&B', 'Soul', 'Rock', 'Country', 'Pop', 'Classical']

// ---- Initial data ----

const INITIAL_GIGS: Gig[] = []
const INITIAL_BOOKINGS: Booking[] = []
const INITIAL_CONVERSATIONS: Conversation[] = []
const INITIAL_PROFILE: MusicianProfile = {
  name: 'Your Name',
  bio: '',
  avatar: '',
  genres: [],
  instagram: '',
  youtube: '',
  spotify: '',
  website: '',
}

// ---- Helpers ----

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
  const [activeTab, setActiveTab] = useState('home')
  const [gigs, setGigs] = useState<Gig[]>(INITIAL_GIGS)
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS)
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS)
  const [profile, setProfile] = useState<MusicianProfile>(INITIAL_PROFILE)

  // Gig browsing
  const [gigSearch, setGigSearch] = useState('')
  const [gigGenreFilter, setGigGenreFilter] = useState<string | null>(null)
  const [selectedGig, setSelectedGig] = useState<Gig | null>(null)

  // Apply modal
  const [applyGigId, setApplyGigId] = useState<string | null>(null)
  const [applyPrice, setApplyPrice] = useState('')
  const [applyNote, setApplyNote] = useState('')

  // Bookings
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>('all')

  // Messages
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')

  // Profile
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<MusicianProfile>(INITIAL_PROFILE)
  const [userId, setUserId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!data) return
      const meta = data.role_metadata ?? {}
      setProfile({
        name: data.full_name ?? '',
        bio: data.bio ?? '',
        avatar: data.avatar_url ?? '',
        genres: Array.isArray(meta.genres) ? meta.genres : [],
        instagram: data.instagram_url ?? '',
        youtube: data.youtube_url ?? '',
        spotify: data.spotify_url ?? '',
        website: data.website ?? '',
      })

      // Load open gigs, filter by distance against musician's coords
      const myLat = data.latitude as number | null
      const myLon = data.longitude as number | null
      const maxMiles = (data.max_distance_miles as number | null) ?? 20
      if (myLat == null || myLon == null) return // no coords → no gigs to show

      const today = new Date().toISOString().slice(0, 10)

      // Find availability_ids the musician has already applied to (any status)
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('availability_id')
        .eq('musician_id', user.id)
      const appliedIds = new Set((existingBookings ?? []).map(b => b.availability_id))

      const { data: slots } = await supabase
        .from('availability')
        .select('id, restaurant_id, date, start_time, end_time, description, pay, genres, latitude, longitude')
        .eq('status', 'open')
        .gte('date', today)
        .order('date', { ascending: true })

      if (!slots || slots.length === 0) return

      const unappliedSlots = slots.filter(s => !appliedIds.has(s.id))
      if (unappliedSlots.length === 0) {
        setGigs([])
        return
      }

      // Compute distance + filter before fetching venue profiles (saves a roundtrip when far)
      const inRange = unappliedSlots
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({
          slot: s,
          distance: milesBetween(myLat, myLon, s.latitude as number, s.longitude as number),
        }))
        .filter(x => x.distance <= maxMiles)
        .sort((a, b) => a.distance - b.distance)

      if (inRange.length === 0) {
        setGigs([])
        return
      }

      const venueIds = Array.from(new Set(inRange.map(x => x.slot.restaurant_id)))
      const { data: venues } = await supabase
        .from('profiles')
        .select('id, full_name, role_metadata, avatar_url')
        .in('id', venueIds)
      const venueById = new Map((venues ?? []).map(v => [v.id, v]))

      const fmt = (t: string) => {
        if (!t) return ''
        const [h, m] = t.split(':').map(Number)
        const period = h >= 12 ? 'PM' : 'AM'
        return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${period}`
      }

      const nearby: Gig[] = inRange.map(({ slot: s, distance }) => {
        const v = venueById.get(s.restaurant_id)
        const meta = v?.role_metadata ?? {}
        const name = meta.venue_name ?? v?.full_name ?? 'Venue'
        const dateLabel = new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        return {
          id: s.id,
          venue: {
            id: s.restaurant_id,
            name,
            type: meta.cuisine_type ?? '',
            distance: `${distance.toFixed(1)} mi`,
            avatar: v?.avatar_url || '🍽',
          },
          date: dateLabel,
          rawDate: s.date,
          time: `${fmt(s.start_time?.slice(0, 5) ?? '')} – ${fmt(s.end_time?.slice(0, 5) ?? '')}`,
          genres: Array.isArray(s.genres) ? s.genres : [],
          budget: Number(s.pay) || 0,
          description: s.description ?? '',
        }
      })
      setGigs(nearby)
    }
    load()
  }, [])

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    const { data: existing } = await supabase
      .from('profiles').select('role_metadata').eq('id', userId).maybeSingle()
    const meta = { ...(existing?.role_metadata ?? {}), genres: profileDraft.genres }
    const { error: upErr } = await supabase.from('profiles').update({
      full_name: profileDraft.name || null,
      bio: profileDraft.bio || null,
      instagram_url: profileDraft.instagram || null,
      youtube_url: profileDraft.youtube || null,
      spotify_url: profileDraft.spotify || null,
      website: profileDraft.website || null,
      role_metadata: meta,
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

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState('')

  const handleApply = async () => {
    if (!applyGigId || !applyPrice || !userId) return
    const gig = gigs.find(g => g.id === applyGigId)
    if (!gig) return
    setApplying(true)
    setApplyError('')
    const { error: insertErr } = await supabase.from('bookings').insert({
      availability_id: gig.id,
      restaurant_id: gig.venue.id,
      musician_id: userId,
      status: 'pending',
      pay_amount: parseInt(applyPrice),
      note: applyNote || null,
    })
    setApplying(false)
    if (insertErr) {
      console.error('Apply failed', insertErr)
      setApplyError(insertErr.message)
      return
    }

    const booking: Booking = {
      id: Date.now().toString(),
      gig,
      status: 'pending',
      price: parseInt(applyPrice),
      note: applyNote,
    }
    setBookings(prev => [booking, ...prev])
    // Drop the gig from Browse Gigs so it disappears immediately
    setGigs(prev => prev.filter(g => g.id !== gig.id))
    setApplyGigId(null)
    setApplyPrice('')
    setApplyNote('')
    setActiveTab('bookings')
  }

  const handleSendMessage = () => {
    if (!chatInput.trim() || !selectedConvId) return
    const text = chatInput
    setConversations(prev => prev.map(conv =>
      conv.id !== selectedConvId ? conv : {
        ...conv,
        lastMessage: text,
        time: 'now',
        messages: [...conv.messages, { id: Date.now().toString(), text, from: 'me', time: 'now' }],
      }
    ))
    setChatInput('')
  }

  const openConversationWithVenue = (gig: Gig) => {
    const existing = conversations.find(c => c.venue === gig.venue.name)
    if (existing) {
      setSelectedConvId(existing.id)
      setConversations(prev => prev.map(c => c.id === existing.id ? { ...c, unread: false } : c))
    } else {
      const newConv: Conversation = {
        id: Date.now().toString(),
        venue: gig.venue.name,
        avatar: gig.venue.avatar,
        lastMessage: '',
        time: 'now',
        unread: false,
        messages: [],
      }
      setConversations(prev => [newConv, ...prev])
      setSelectedConvId(newConv.id)
    }
    setSelectedGig(null)
    setActiveTab('messages')
  }

  // Derived
  const upcomingGigs = bookings.filter(b => b.status === 'confirmed').length
  const pendingApps = bookings.filter(b => b.status === 'pending').length
  const totalEarned = bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + b.price, 0)
  const filteredGigs = gigs.filter(g => {
    const q = gigSearch.toLowerCase()
    const matchSearch = !q || g.venue.name.toLowerCase().includes(q) || g.genres.some(x => x.toLowerCase().includes(q))
    const matchGenre = !gigGenreFilter || g.genres.includes(gigGenreFilter)
    return matchSearch && matchGenre
  })
  const filteredBookings = bookingFilter === 'all' ? bookings : bookings.filter(b => b.status === bookingFilter)
  const selectedConv = conversations.find(c => c.id === selectedConvId)
  const unreadCount = conversations.filter(c => c.unread).length
  const applyGig = gigs.find(g => g.id === applyGigId)

  return (
    <div className="min-h-screen bg-snow pb-24">

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

        {/* ---- HOME TAB ---- */}
        {activeTab === 'home' && (
          <>
            {/* Profile hero — the headliner */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 13)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <span className="absolute top-3 right-3 bg-chestnut text-snow text-[9px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full shadow-md uppercase z-20">★ Headliner</span>

              <div className="relative z-10 p-5 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-inner border border-chestnut/30" />
                  : <div className="w-14 h-14 rounded-2xl bg-chestnut/20 border border-chestnut/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">♪</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">For Musicians</p>
                  <p className="text-snow font-black text-lg leading-tight truncate">{profile.name}</p>
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

            {/* Stats — earnings highlighted */}
            <div className="grid grid-cols-3 gap-2.5 mb-7">
              <StatCard value={upcomingGigs} label="Upcoming" color="text-teal" icon="✅" />
              <StatCard value={pendingApps} label="Pending" color="text-chestnut" icon="📬" />
              <StatCard value={`$${totalEarned}`} label="Earned" color="text-graphite" icon="💰" highlight />
            </div>

            {/* Upcoming confirmed gigs */}
            {upcomingGigs > 0 && (
              <>
                <SectionHeader eyebrow="The Calendar" title="Upcoming" accent="Gigs." />
                <div className="space-y-3 mb-6">
                  {bookings.filter(b => b.status === 'confirmed').map(b => {
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
                          <p className="text-graphite font-black">${b.price}</p>
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
            {pendingApps === 0 ? (
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
                        <p className="text-graphite font-black text-sm">${b.price}</p>
                        <div className="mt-1"><BookingBadge status={b.status} /></div>
                      </div>
                    </div>
                    {b.note && (
                      <div className="bg-snow rounded-xl px-3 py-2">
                        <p className="text-charcoal text-xs italic">Your note: "{b.note}"</p>
                      </div>
                    )}
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

            {filteredGigs.length === 0 ? (
              <EmptyState
                icon="🎵"
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
                        <p className="text-graphite font-black">${gig.budget}</p>
                        <span className="bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Open</span>
                      </div>
                    </div>
                    <p className="text-charcoal text-xs mb-2">{gig.date} · {gig.time}</p>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {gig.genres.map(g => (
                        <span key={g} className="text-xs bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
                      ))}
                    </div>
                    {gig.description && (
                      <p className="text-charcoal text-xs mb-3 italic">"{gig.description}"</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedGig(gig)}
                        className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => { setApplyGigId(gig.id); setApplyPrice(gig.budget.toString()) }}
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
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Budget</p>
                  <p className="text-chestnut font-black text-sm">${selectedGig.budget}</p>
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
                onClick={() => { setApplyGigId(selectedGig.id); setApplyPrice(selectedGig.budget.toString()); setSelectedGig(null) }}
                className="flex-1 bg-chestnut text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                Apply Now →
              </button>
            </div>
          </div>
        )}

        {/* ---- BOOKINGS TAB ---- */}
        {activeTab === 'bookings' && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">The Setlist</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                My <span className="text-chestnut italic">Bookings.</span>
              </h2>
            </div>
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {(['all', 'pending', 'confirmed', 'cancelled'] as BookingFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setBookingFilter(f)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all ${bookingFilter === f ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {filteredBookings.length === 0 ? (
              <EmptyState
                icon="📋"
                title={bookingFilter === 'all' ? 'No applications yet' : `No ${bookingFilter} applications`}
                body="Apply to open gig slots and track your applications here."
                action={bookingFilter === 'all' ? { label: 'Browse Gigs', onClick: () => setActiveTab('gigs') } : undefined}
              />
            ) : (
              <div className="space-y-4">
                {filteredBookings.map(b => {
                  const borderColor = b.status === 'confirmed'
                    ? 'border-l-[#6C9A8B]'
                    : b.status === 'pending'
                    ? 'border-l-[#DC7F41]'
                    : 'border-l-[#bbb]'
                  return (
                    <div key={b.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${borderColor}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar src={b.gig.venue.avatar} className="w-11 h-11 rounded-full" textSize="text-xl" />
                            <div>
                              <p className="text-graphite font-bold text-sm">{b.gig.venue.name}</p>
                              <p className="text-charcoal text-xs mt-0.5">{b.gig.date} · {b.gig.time}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-graphite font-black text-sm">${b.price}</p>
                            <div className="mt-1"><BookingBadge status={b.status} /></div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {b.gig.genres.map(g => (
                            <span key={g} className="text-xs bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
                          ))}
                        </div>
                        {b.note && (
                          <div className="bg-snow rounded-xl px-3 py-2">
                            <p className="text-charcoal text-xs italic">Your note: "{b.note}"</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ---- MESSAGES TAB: LIST ---- */}
        {activeTab === 'messages' && !selectedConv && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Inbox</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Your <span className="text-chestnut italic">Messages.</span>
              </h2>
            </div>
            {conversations.length === 0 ? (
              <EmptyState icon="💬" title="No messages yet" body="Browse gigs and message a venue directly to start a conversation." />
            ) : (
              <div className="space-y-2">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      setSelectedConvId(conv.id)
                      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c))
                    }}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow text-left"
                  >
                    <Avatar src={conv.avatar} className="w-12 h-12 rounded-full" textSize="text-2xl" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-sm font-bold ${conv.unread ? 'text-graphite' : 'text-charcoal'}`}>{conv.venue}</p>
                        <p className="text-charcoal text-xs">{conv.time}</p>
                      </div>
                      <p className={`text-xs truncate ${conv.unread ? 'text-graphite font-medium' : 'text-charcoal'}`}>
                        {conv.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    {conv.unread && <div className="w-2.5 h-2.5 rounded-full bg-chestnut shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- MESSAGES TAB: CHAT ---- */}
        {activeTab === 'messages' && selectedConv && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <button onClick={() => setSelectedConvId(null)} className="text-charcoal hover:text-chestnut transition-colors text-sm font-medium">← Back</button>
              <Avatar src={selectedConv.avatar} className="w-9 h-9 rounded-full" textSize="text-lg" />
              <p className="text-graphite font-bold">{selectedConv.venue}</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {selectedConv.messages.length === 0 && (
                <p className="text-charcoal text-sm text-center mt-10">Say hello to {selectedConv.venue}! 👋</p>
              )}
              {selectedConv.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${msg.from === 'me' ? 'bg-chestnut text-snow rounded-br-sm' : 'bg-white text-graphite shadow-sm rounded-bl-sm'}`}>
                    <p>{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${msg.from === 'me' ? 'text-snow/60' : 'text-charcoal'}`}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 shrink-0">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-white rounded-xl px-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
              <button onClick={handleSendMessage} className="bg-chestnut text-snow px-5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                Send
              </button>
            </div>
          </div>
        )}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === 'profile' && (
          <>
            <div className="flex items-end justify-between mb-5 gap-3">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">The Artist</p>
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

            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-4 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 41)} />
                ))}
              </div>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-chestnut opacity-15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-10 w-40 h-40 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />
              <span className="absolute top-3 right-3 bg-chestnut text-snow text-[9px] font-bold tracking-[0.2em] px-2.5 py-1 rounded-full shadow-md uppercase z-20">★ Headliner</span>

              <div className="relative z-10 p-8 flex flex-col items-center text-center">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-24 h-24 rounded-2xl object-cover mb-4 shadow-inner border-2 border-chestnut/30" />
                  : <div className="w-24 h-24 bg-chestnut/20 border-2 border-chestnut/30 rounded-2xl flex items-center justify-center text-5xl mb-4 shadow-inner">♪</div>}
                <p className="text-snow font-black text-2xl tracking-tight">{profile.name}</p>
                {profile.genres.length > 0 && (
                  <p className="text-snow/50 text-sm mt-1">{profile.genres.slice(0, 3).join(' · ')}</p>
                )}
              </div>
            </div>

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
                placeholder="Tell venues about your style and experience..."
              />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-3">Genres</p>
              {editingProfile ? (
                <div className="flex flex-wrap gap-2">
                  {GENRES.map(g => (
                    <button
                      key={g}
                      onClick={() => setProfileDraft(p => ({
                        ...p,
                        genres: p.genres.includes(g) ? p.genres.filter(x => x !== g) : [...p.genres, g],
                      }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        profileDraft.genres.includes(g)
                          ? 'bg-chestnut text-snow'
                          : 'bg-snow text-charcoal hover:bg-[#E8E4E0] border border-charcoal/10'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              ) : profile.genres.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.genres.map(g => (
                    <span key={g} className="px-3 py-1 rounded-full text-xs font-semibold bg-chestnut/10 text-chestnut">{g}</span>
                  ))}
                </div>
              ) : (
                <p className="text-charcoal/50 text-sm">No genres set — tap Edit to add some.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mb-4">
              <p className="text-charcoal text-xs font-semibold uppercase tracking-wide">Social & Links</p>
              <ProfileField label="Instagram" value={editingProfile ? profileDraft.instagram : profile.instagram} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, instagram: v }))} placeholder="https://instagram.com/yourhandle" />
              <ProfileField label="YouTube" value={editingProfile ? profileDraft.youtube : profile.youtube} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, youtube: v }))} placeholder="https://youtube.com/yourchannel" />
              <ProfileField label="Spotify" value={editingProfile ? profileDraft.spotify : profile.spotify} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, spotify: v }))} placeholder="https://open.spotify.com/artist/..." />
              <ProfileField label="Website" value={editingProfile ? profileDraft.website : profile.website} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, website: v }))} placeholder="https://yourwebsite.com" />
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
        <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
          <TabButton icon="🏠" label="Home"     active={activeTab === 'home'}     onClick={() => setActiveTab('home')} />
          <TabButton icon="🎵" label="Gigs"     active={activeTab === 'gigs'}     onClick={() => setActiveTab('gigs')} />
          <TabButton icon="📋" label="Bookings" active={activeTab === 'bookings'} onClick={() => setActiveTab('bookings')} />
          <TabButton icon="💬" label="Messages" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} badge={unreadCount} />
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
                onClick={() => { setApplyGigId(null); setApplyPrice(''); setApplyNote('') }}
                className="text-snow/60 hover:text-snow transition-colors text-xl leading-none relative z-10"
              >✕</button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5 p-3 bg-white rounded-xl">
                <Avatar src={applyGig.venue.avatar} className="w-10 h-10 rounded-full" textSize="text-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-graphite font-bold text-sm truncate">{applyGig.venue.name}</p>
                  <p className="text-charcoal text-xs">{applyGig.date} · {applyGig.time}</p>
                </div>
                <p className="text-chestnut font-black shrink-0">Pays ${applyGig.budget}</p>
              </div>

              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Your Rate ($)</label>
              <input
                type="number"
                placeholder={applyGig.budget.toString()}
                value={applyPrice}
                onChange={e => setApplyPrice(e.target.value)}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm border border-charcoal/10"
              />

              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
                Note to Venue <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                placeholder="Tell them about your style, experience, or any questions..."
                value={applyNote}
                onChange={e => setApplyNote(e.target.value)}
                rows={3}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10"
              />

              {applyError && (
                <p className="bg-red-100 text-red-600 p-3 rounded-xl mb-3 text-xs">{applyError}</p>
              )}
              <button
                onClick={handleApply}
                disabled={!applyPrice || applying}
                className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-black text-sm shadow-md hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {applying ? 'Sending…' : 'Send Application →'}
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
