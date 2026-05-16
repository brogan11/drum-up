'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { Avatar } from '@/components/Avatar'

// ---- Types ----

type AppStatus = 'pending' | 'accepted' | 'declined'
type SlotStatus = 'open' | 'booked' | 'past'
type SlotFilter = 'all' | 'open' | 'booked' | 'past'
type SlotsView = 'list' | 'calendar'

interface Application {
  id: string
  musicianName: string
  musicianGenre: string
  rating: number
  price: number
  note: string
  avatar: string
  status: AppStatus
}

interface Slot {
  id: string
  date: string
  rawDate: string
  time: string
  genres: string[]
  budget: number
  status: SlotStatus
  bookedMusician?: string
  applications: Application[]
}

interface Musician {
  id: string
  name: string
  genres: string[]
  rating: number
  reviewCount: number
  priceRange: string
  distance: string
  bio: string
  avatar: string
}

interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
  time: string
}

interface Conversation {
  id: string
  musician: string
  avatar: string
  lastMessage: string
  time: string
  unread: boolean
  messages: ChatMessage[]
}

interface VenueProfile {
  name: string
  type: string
  address: string
  description: string
  website: string
  avatar: string
}

// ---- Constants ----

const GENRES = ['Jazz', 'Blues', 'Acoustic', 'Folk', 'R&B', 'Soul', 'Rock', 'Country', 'Pop', 'Classical']

// ---- Mock Data ----

const INITIAL_SLOTS: Slot[] = []
const MUSICIANS: Musician[] = []
const INITIAL_CONVERSATIONS: Conversation[] = []

const INITIAL_PROFILE: VenueProfile = {
  name: 'Your Venue',
  type: 'Restaurant',
  address: '123 Main St, City, State',
  description: 'A warm and welcoming dining experience with a passion for live music.',
  website: '',
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
  return <span className="bg-charcoal/10 text-charcoal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Past</span>
}

// ---- Main Component ----

export default function RestaurantDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('home')
  const [slots, setSlots] = useState<Slot[]>(INITIAL_SLOTS)
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS)
  const [profile, setProfile] = useState<VenueProfile>(INITIAL_PROFILE)

  const [postSlotOpen, setPostSlotOpen] = useState(false)
  const [newSlot, setNewSlot] = useState({ date: '', startTime: '', endTime: '', genres: [] as string[], budget: '', notes: '' })

  const [slotFilter, setSlotFilter] = useState<SlotFilter>('all')
  const [slotsView, setSlotsView] = useState<SlotsView>('list')
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [genreFilter, setGenreFilter] = useState<string | null>(null)
  const [selectedMusician, setSelectedMusician] = useState<Musician | null>(null)

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<VenueProfile>(INITIAL_PROFILE)
  const [userId, setUserId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })

  const loadSlots = async (rid: string) => {
    const { data } = await supabase
      .from('availability')
      .select('*')
      .eq('restaurant_id', rid)
      .order('date', { ascending: true })
    if (!data) return
    const today = new Date().toISOString().slice(0, 10)
    const mapped: Slot[] = data.map(row => {
      const dateLabel = new Date(row.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      const dbStatus = row.status as string
      const isPast = row.date < today
      const status: SlotStatus = isPast ? 'past' : dbStatus === 'filled' ? 'booked' : 'open'
      return {
        id: row.id,
        date: dateLabel,
        rawDate: row.date,
        time: `${formatTime(row.start_time?.slice(0, 5) ?? '')} – ${formatTime(row.end_time?.slice(0, 5) ?? '')}`,
        genres: Array.isArray(row.genres) ? row.genres : [],
        budget: Number(row.pay) || 0,
        status,
        applications: [],
      }
    })
    setSlots(mapped)
  }

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
        name: meta.venue_name ?? data.full_name ?? '',
        type: meta.cuisine_type ?? '',
        address: data.location_text ?? '',
        description: data.bio ?? '',
        website: data.website ?? '',
        avatar: data.avatar_url ?? '',
      })
      setRestaurantCoords({ lat: data.latitude ?? null, lon: data.longitude ?? null })
      await loadSlots(user.id)
    }
    load()
  }, [])

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    const { data: existing } = await supabase
      .from('profiles').select('role_metadata').eq('id', userId).maybeSingle()
    const meta = {
      ...(existing?.role_metadata ?? {}),
      venue_name: profileDraft.name || null,
      cuisine_type: profileDraft.type || null,
    }
    const { error: upErr } = await supabase.from('profiles').update({
      bio: profileDraft.description || null,
      location_text: profileDraft.address || null,
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

  const [postingSlot, setPostingSlot] = useState(false)
  const [postSlotError, setPostSlotError] = useState('')

  const handlePostSlot = async () => {
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime || !newSlot.budget) return
    if (!userId) return
    if (restaurantCoords.lat == null || restaurantCoords.lon == null) {
      setPostSlotError('Add a location to your profile (Settings) before posting slots — musicians can\'t see slots without coordinates.')
      return
    }
    setPostingSlot(true)
    setPostSlotError('')
    const { error: insertErr } = await supabase.from('availability').insert({
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
    })
    setPostingSlot(false)
    if (insertErr) {
      console.error('Slot insert failed', insertErr)
      setPostSlotError(insertErr.message)
      return
    }
    setPostSlotOpen(false)
    setNewSlot({ date: '', startTime: '', endTime: '', genres: [], budget: '', notes: '' })
    await loadSlots(userId)
    setActiveTab('slots')
  }

  const handleApplicationAction = (slotId: string, appId: string, action: 'accept' | 'decline') => {
    setSlots(prev => prev.map(slot => {
      if (slot.id !== slotId) return slot
      const app = slot.applications.find(a => a.id === appId)
      return {
        ...slot,
        status: action === 'accept' ? 'booked' : slot.status,
        bookedMusician: action === 'accept' ? app?.musicianName : slot.bookedMusician,
        applications: slot.applications.map(a =>
          a.id === appId ? { ...a, status: action === 'accept' ? 'accepted' : 'declined' } : a
        ),
      }
    }))
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

  const openConversation = (musician: Musician) => {
    const existing = conversations.find(c => c.musician === musician.name)
    if (existing) {
      setSelectedConvId(existing.id)
      setConversations(prev => prev.map(c => c.id === existing.id ? { ...c, unread: false } : c))
    } else {
      const newConv: Conversation = {
        id: Date.now().toString(),
        musician: musician.name,
        avatar: musician.avatar,
        lastMessage: '',
        time: 'now',
        unread: false,
        messages: [],
      }
      setConversations(prev => [newConv, ...prev])
      setSelectedConvId(newConv.id)
    }
    setSelectedMusician(null)
    setActiveTab('messages')
  }

  const openSlots = slots.filter(s => s.status === 'open').length
  const pendingApps = slots.reduce((n, s) => n + s.applications.filter(a => a.status === 'pending').length, 0)
  const upcomingGigs = slots.filter(s => s.status === 'booked').length
  const pastGigs = slots.filter(s => s.status === 'past').length
  const filteredSlots = slotFilter === 'all' ? slots : slots.filter(s => s.status === slotFilter)
  const filteredMusicians = MUSICIANS.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q))
    const matchGenre = !genreFilter || m.genres.includes(genreFilter)
    return matchSearch && matchGenre
  })
  const selectedConv = conversations.find(c => c.id === selectedConvId)
  const unreadCount = conversations.filter(c => c.unread).length

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
            {/* Profile hero — mini stage */}
            <div className="relative bg-graphite rounded-3xl overflow-hidden mb-6 shadow-xl">
              <div className="absolute inset-x-0 bottom-0 top-1/2 flex items-end justify-around opacity-[0.10] pointer-events-none">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 7)} />
                ))}
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-36 h-36 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />

              <div className="relative z-10 p-5 flex items-center gap-4">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 shadow-inner border border-chestnut/30" />
                  : <div className="w-14 h-14 rounded-2xl bg-chestnut/20 border border-chestnut/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">🍽</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">For Restaurants</p>
                  <p className="text-snow font-black text-lg leading-tight truncate">{profile.name}</p>
                  <p className="text-snow/50 text-xs truncate mt-0.5">{profile.type} · {profile.address}</p>
                </div>
                <button
                  onClick={() => setPostSlotOpen(true)}
                  className="bg-chestnut text-snow px-4 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0 shadow-lg"
                >
                  + Post Slot
                </button>
              </div>
            </div>

            {/* Stats — bigger, bolder */}
            <div className="grid grid-cols-4 gap-2.5 mb-7">
              <StatCard value={openSlots} label="Open" color="text-teal" icon="🎵" />
              <StatCard value={pendingApps} label="Pending" color="text-chestnut" icon="📬" highlight />
              <StatCard value={upcomingGigs} label="Booked" color="text-graphite" icon="✅" />
              <StatCard value={pastGigs} label="Past" color="text-charcoal" icon="🕐" />
            </div>

            {/* Upcoming gigs */}
            {upcomingGigs > 0 && (
              <>
                <SectionHeader eyebrow="The Calendar" title="Upcoming" accent="Gigs." />
                <div className="space-y-3 mb-6">
                  {slots.filter(s => s.status === 'booked').map(slot => {
                    const [, datePart] = slot.date.split(', ')
                    const [mon, day] = (datePart || '').split(' ')
                    return (
                      <div key={slot.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                        <div className="bg-chestnut/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
                          <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">{mon}</p>
                          <p className="text-chestnut text-2xl font-black leading-tight">{day}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-graphite font-bold text-sm truncate">{slot.bookedMusician}</p>
                          <p className="text-charcoal text-xs mt-0.5">{slot.time}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {slot.genres.map(g => <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-graphite font-black">${slot.budget}</p>
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

            {/* Recent applications */}
            <SectionHeader eyebrow="Inbox" title="Recent" accent="Applications." />
            {pendingApps === 0 ? (
              <EmptyState
                icon="🎵"
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
                              <span className="text-chestnut font-black text-sm shrink-0">${app.price}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-charcoal text-xs">{app.musicianGenre}</span>
                              <span className="text-charcoal/40 text-xs">·</span>
                              <span className="text-charcoal text-xs">⭐ {app.rating}</span>
                            </div>
                            <p className="text-charcoal/60 text-xs mt-0.5">For: {slot.date} · {slot.time}</p>
                          </div>
                        </div>
                        {app.note && (
                          <div className="bg-snow rounded-xl px-3 py-2.5 mb-3">
                            <p className="text-charcoal text-sm italic leading-relaxed">"{app.note}"</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleApplicationAction(slot.id, app.id, 'accept')} className="flex-1 bg-teal text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Accept</button>
                          <button onClick={() => handleApplicationAction(slot.id, app.id, 'decline')} className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10">Decline</button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </>
        )}

        {/* ---- SLOTS TAB ---- */}
        {activeTab === 'slots' && (
          <>
            <div className="flex items-end justify-between mb-5 gap-3">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Manage</p>
                <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                  Your <span className="text-chestnut italic">Slots.</span>
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border border-charcoal/10">
                  <button
                    onClick={() => setSlotsView('list')}
                    className={`px-3 py-2 text-sm font-medium transition-all ${slotsView === 'list' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
                    title="List view"
                  >☰</button>
                  <button
                    onClick={() => setSlotsView('calendar')}
                    className={`px-3 py-2 text-sm font-medium transition-all ${slotsView === 'calendar' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
                    title="Calendar view"
                  >▦</button>
                </div>
                <button onClick={() => setPostSlotOpen(true)} className="bg-chestnut text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                  + New Slot
                </button>
              </div>
            </div>

            {slotsView === 'list' ? (
              <>
                <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                  {(['all', 'open', 'booked', 'past'] as SlotFilter[]).map(f => (
                    <button key={f} onClick={() => setSlotFilter(f)} className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all ${slotFilter === f ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {filteredSlots.length === 0 ? (
                  <EmptyState icon="📅" title="No slots found" body="Post a slot to start receiving applications from musicians." />
                ) : (
                  <div className="space-y-4">
                    {filteredSlots.map(slot => (
                      <SlotCard key={slot.id} slot={slot} selectedSlotId={selectedSlotId} setSelectedSlotId={setSelectedSlotId} handleApplicationAction={handleApplicationAction} />
                    ))}
                  </div>
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
              />
            )}
          </>
        )}

        {/* ---- BROWSE TAB: LIST ---- */}
        {activeTab === 'browse' && !selectedMusician && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Talent Pool</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Browse <span className="text-chestnut italic">Musicians.</span>
              </h2>
            </div>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40 text-sm pointer-events-none">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or genre..."
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              <button onClick={() => setGenreFilter(null)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!genreFilter ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}>
                All
              </button>
              {GENRES.map(g => (
                <button key={g} onClick={() => setGenreFilter(genreFilter === g ? null : g)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${genreFilter === g ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}>
                  {g}
                </button>
              ))}
            </div>
            {filteredMusicians.length === 0 ? (
              <EmptyState icon="🎸" title="No musicians yet" body="Musicians on Drum Up will appear here once they join. Check back soon." />
            ) : (
              <div className="space-y-3">
                {filteredMusicians.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                    <Avatar src={m.avatar} className="w-12 h-12 rounded-full" textSize="text-2xl" bg="bg-chestnut/10" />
                    <div className="flex-1 min-w-0">
                      <p className="text-graphite font-bold text-sm">{m.name}</p>
                      <p className="text-charcoal text-xs">{m.genres.join(' · ')}</p>
                      <p className="text-charcoal text-xs mt-0.5">⭐ {m.rating} ({m.reviewCount}) · {m.distance} · {m.priceRange}</p>
                    </div>
                    <button onClick={() => setSelectedMusician(m)} className="text-chestnut text-sm font-bold hover:underline shrink-0">View →</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- BROWSE TAB: MUSICIAN PROFILE ---- */}
        {activeTab === 'browse' && selectedMusician && (
          <div>
            <button onClick={() => setSelectedMusician(null)} className="flex items-center gap-1.5 text-charcoal text-sm mb-5 hover:text-chestnut transition-colors font-medium">
              ← Back to Browse
            </button>
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
              <div className="flex items-center gap-4 mb-5">
                <Avatar src={selectedMusician.avatar} className="w-20 h-20 rounded-2xl" textSize="text-4xl" bg="bg-chestnut/10" />
                <div>
                  <h2 className="text-graphite text-xl font-black">{selectedMusician.name}</h2>
                  <p className="text-charcoal text-sm mt-0.5">{selectedMusician.genres.join(' · ')}</p>
                  <p className="text-charcoal text-sm">⭐ {selectedMusician.rating} ({selectedMusician.reviewCount} reviews)</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Price Range</p>
                  <p className="text-graphite font-bold text-sm">{selectedMusician.priceRange}</p>
                </div>
                <div className="bg-snow rounded-xl p-3">
                  <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">Distance</p>
                  <p className="text-graphite font-bold text-sm">{selectedMusician.distance}</p>
                </div>
              </div>
              <p className="text-charcoal text-sm leading-relaxed">{selectedMusician.bio}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => openConversation(selectedMusician)} className="flex-1 bg-graphite text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                Message
              </button>
              <button className="flex-1 bg-chestnut text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                Invite to Slot
              </button>
            </div>
          </div>
        )}

        {/* ---- MESSAGES TAB: CONVERSATION LIST ---- */}
        {activeTab === 'messages' && !selectedConv && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Inbox</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Your <span className="text-chestnut italic">Messages.</span>
              </h2>
            </div>
            {conversations.length === 0 ? (
              <EmptyState icon="💬" title="No messages yet" body="Browse musicians and reach out to start a conversation." />
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
                    <Avatar src={conv.avatar} className="w-12 h-12 rounded-full" textSize="text-2xl" bg="bg-chestnut/10" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-sm font-bold ${conv.unread ? 'text-graphite' : 'text-charcoal'}`}>{conv.musician}</p>
                        <p className="text-charcoal text-xs">{conv.time}</p>
                      </div>
                      <p className={`text-xs truncate ${conv.unread ? 'text-graphite font-medium' : 'text-charcoal'}`}>{conv.lastMessage || 'No messages yet'}</p>
                    </div>
                    {conv.unread && <div className="w-2.5 h-2.5 rounded-full bg-chestnut shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- MESSAGES TAB: CHAT VIEW ---- */}
        {activeTab === 'messages' && selectedConv && (
          <div className="flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <button onClick={() => setSelectedConvId(null)} className="text-charcoal hover:text-chestnut transition-colors text-sm font-medium">← Back</button>
              <Avatar src={selectedConv.avatar} className="w-9 h-9 rounded-full" textSize="text-lg" bg="bg-chestnut/10" />
              <p className="text-graphite font-bold">{selectedConv.musician}</p>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {selectedConv.messages.length === 0 && (
                <p className="text-charcoal text-sm text-center mt-10">Say hello to {selectedConv.musician}! 👋</p>
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
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">The Room</p>
                <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                  Venue <span className="text-chestnut italic">Profile.</span>
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
                  <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 31)} />
                ))}
              </div>
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-chestnut opacity-15 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -right-10 w-40 h-40 rounded-full bg-teal opacity-15 blur-2xl pointer-events-none" />

              <div className="relative z-10 p-8 flex flex-col items-center text-center">
                {profile.avatar
                  ? <img src={profile.avatar} alt="" className="w-24 h-24 rounded-2xl object-cover mb-4 shadow-inner border-2 border-chestnut/30" />
                  : <div className="w-24 h-24 bg-chestnut/20 border-2 border-chestnut/30 rounded-2xl flex items-center justify-center text-5xl mb-4 shadow-inner">🍽</div>}
                <p className="text-snow font-black text-2xl tracking-tight">{profile.name}</p>
                <p className="text-snow/50 text-sm mt-1">{profile.type}</p>
                {editingProfile && (
                  <button className="text-chestnut text-xs font-bold uppercase tracking-[0.2em] mt-3 hover:underline">Change Photo</button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mb-4">
              <ProfileField label="Venue Name" value={editingProfile ? profileDraft.name : profile.name} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, name: v }))} />
              <ProfileField label="Venue Type" value={editingProfile ? profileDraft.type : profile.type} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, type: v }))} />
              <ProfileField label="Address" value={editingProfile ? profileDraft.address : profile.address} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, address: v }))} />
              <ProfileField label="About" value={editingProfile ? profileDraft.description : profile.description} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, description: v }))} multiline />
              <ProfileField label="Website" value={editingProfile ? profileDraft.website : profile.website} editing={editingProfile} onChange={v => setProfileDraft(p => ({ ...p, website: v }))} placeholder="https://yourrestaurant.com" />
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
          <TabButton icon="🏠" label="Home" active={activeTab === 'home'} onClick={() => setActiveTab('home')} />
          <TabButton icon="📅" label="Slots" active={activeTab === 'slots'} onClick={() => setActiveTab('slots')} />
          <TabButton icon="🔍" label="Browse" active={activeTab === 'browse'} onClick={() => setActiveTab('browse')} />
          <TabButton icon="💬" label="Messages" active={activeTab === 'messages'} onClick={() => setActiveTab('messages')} badge={unreadCount} />
          <TabButton icon="🍽" label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

      {/* ---- POST SLOT MODAL ---- */}
      {postSlotOpen && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">New Listing</p>
                <h3 className="text-snow text-xl font-black tracking-tight">Post a <span className="text-chestnut italic">Slot.</span></h3>
              </div>
              <button onClick={() => setPostSlotOpen(false)} className="text-snow/60 hover:text-snow transition-colors text-xl leading-none relative z-10">✕</button>
            </div>
            <div className="p-6">
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Date</label>
              <input
                type="date"
                value={newSlot.date}
                onChange={e => setNewSlot(p => ({ ...p, date: e.target.value }))}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm border border-charcoal/10"
              />

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Start Time</label>
                  <input type="time" value={newSlot.startTime} onChange={e => setNewSlot(p => ({ ...p, startTime: e.target.value }))} className="w-full bg-white rounded-xl px-4 py-2.5 shadow-sm focus:outline-none text-sm border border-charcoal/10" />
                </div>
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">End Time</label>
                  <input type="time" value={newSlot.endTime} onChange={e => setNewSlot(p => ({ ...p, endTime: e.target.value }))} className="w-full bg-white rounded-xl px-4 py-2.5 shadow-sm focus:outline-none text-sm border border-charcoal/10" />
                </div>
              </div>

              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Genre Preferences</label>
              <div className="flex flex-wrap gap-2 mb-5">
                {GENRES.map(g => (
                  <button
                    key={g}
                    onClick={() => setNewSlot(p => ({ ...p, genres: p.genres.includes(g) ? p.genres.filter(x => x !== g) : [...p.genres, g] }))}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${newSlot.genres.includes(g) ? 'bg-chestnut text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0] border border-charcoal/10'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Budget ($)</label>
              <input
                type="number"
                placeholder="e.g. 200"
                value={newSlot.budget}
                onChange={e => setNewSlot(p => ({ ...p, budget: e.target.value }))}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm border border-charcoal/10"
              />

              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
                Notes <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                placeholder="Any additional details for musicians..."
                value={newSlot.notes}
                onChange={e => setNewSlot(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10"
              />

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
          <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, 17)} />
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

function StatCard({ value, label, color, icon, highlight }: { value: number | string; label: string; color: string; icon: string; highlight?: boolean }) {
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

function TabButton({ icon, label, active, onClick, badge }: { icon: string; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick} className="py-1 flex flex-col items-center gap-1 transition-colors relative">
      <div className={`relative w-11 h-9 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-chestnut shadow-md' : ''}`}>
        <span className="text-lg leading-none">{icon}</span>
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-chestnut border-2 border-graphite rounded-full text-[9px] text-snow font-bold flex items-center justify-center">{badge}</span>
        )}
      </div>
      <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-chestnut' : 'text-snow/50'}`}>{label}</span>
    </button>
  )
}

function SlotCard({ slot, selectedSlotId, setSelectedSlotId, handleApplicationAction }: {
  slot: Slot
  selectedSlotId: string | null
  setSelectedSlotId: (id: string | null) => void
  handleApplicationAction: (slotId: string, appId: string, action: 'accept' | 'decline') => void
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
            <span>Budget: <span className="text-graphite font-black">${slot.budget}</span></span>
            {slot.status === 'open' && (
              <span>{slot.applications.length} application{slot.applications.length !== 1 ? 's' : ''}</span>
            )}
            {slot.bookedMusician && slot.status !== 'open' && (
              <span className="text-chestnut font-semibold">{slot.bookedMusician}</span>
            )}
          </div>
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
      {selectedSlotId === slot.id && (
        <div className="border-t border-charcoal/10 bg-snow/50 p-4 space-y-3">
          {slot.applications.map(app => (
            <div key={app.id} className="bg-white rounded-xl p-3">
              <div className="flex items-start gap-3 mb-2">
                <Avatar src={app.avatar} className="w-9 h-9 rounded-full" textSize="text-base" bg="bg-chestnut/10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-graphite font-bold text-sm truncate">{app.musicianName}</p>
                    <span className="text-chestnut font-black text-sm shrink-0">${app.price}</span>
                  </div>
                  <p className="text-charcoal text-xs">{app.musicianGenre} · ⭐ {app.rating}</p>
                </div>
              </div>
              {app.note && <div className="bg-snow rounded-lg px-3 py-2 mb-2"><p className="text-charcoal text-sm italic">"{app.note}"</p></div>}
              {app.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => handleApplicationAction(slot.id, app.id, 'accept')} className="flex-1 bg-teal text-snow py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">Accept</button>
                  <button onClick={() => handleApplicationAction(slot.id, app.id, 'decline')} className="flex-1 bg-snow text-charcoal py-2 rounded-lg text-xs font-medium hover:bg-[#E8E4E0] border border-charcoal/10">Decline</button>
                </div>
              ) : (
                <span className={`inline-block text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase ${app.status === 'accepted' ? 'bg-teal/10 text-teal' : 'bg-charcoal/10 text-charcoal'}`}>
                  {app.status === 'accepted' ? 'Accepted' : 'Declined'}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SlotCalendar({ slots, calendarMonth, setCalendarMonth, calendarSelectedDay, setCalendarSelectedDay, selectedSlotId, setSelectedSlotId, handleApplicationAction }: {
  slots: Slot[]
  calendarMonth: Date
  setCalendarMonth: (d: Date) => void
  calendarSelectedDay: string | null
  setCalendarSelectedDay: (d: string | null) => void
  selectedSlotId: string | null
  setSelectedSlotId: (id: string | null) => void
  handleApplicationAction: (slotId: string, appId: string, action: 'accept' | 'decline') => void
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
        <button onClick={() => setCalendarMonth(new Date(year, month - 1, 1))} className="text-charcoal hover:text-graphite transition-colors text-xl px-2 py-1">‹</button>
        <span className="text-graphite font-bold">{monthLabel}</span>
        <button onClick={() => setCalendarMonth(new Date(year, month + 1, 1))} className="text-charcoal hover:text-graphite transition-colors text-xl px-2 py-1">›</button>
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
              className={`flex flex-col items-center py-2 rounded-xl text-sm font-medium transition-all
                ${isSelected ? 'bg-graphite text-snow' : isToday ? 'ring-2 ring-chestnut text-chestnut' : 'text-graphite hover:bg-snow'}
              `}
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
                <SlotCard key={slot.id} slot={slot} selectedSlotId={selectedSlotId} setSelectedSlotId={setSelectedSlotId} handleApplicationAction={handleApplicationAction} />
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
        <p className="text-graphite text-sm">{value || <span className="text-charcoal/50">{placeholder || 'Not set'}</span>}</p>
      )}
    </div>
  )
}
