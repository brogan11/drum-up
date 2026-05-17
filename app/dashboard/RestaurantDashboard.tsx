'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'

// ---- Types ----

type AppStatus = 'pending' | 'confirmed' | 'cancelled'
type SlotStatus = 'open' | 'booked' | 'past' | 'cancelled'
type SlotFilter = 'all' | 'open' | 'booked' | 'past'
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
  otherUserId: string
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

function fmtMsgTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// Deterministic conversation UUID from two user UUIDs (XOR + valid v4 header)
function getConversationId(uid1: string, uid2: string): string {
  const [a, b] = [uid1, uid2].sort()
  const aClean = a.replace(/-/g, '')
  const bClean = b.replace(/-/g, '')
  let xored = ''
  for (let i = 0; i < 32; i++) {
    xored += (parseInt(aClean[i], 16) ^ parseInt(bClean[i], 16)).toString(16)
  }
  // Force version 4 + variant bits
  xored = xored.slice(0, 12) + '4' + xored.slice(13, 16) +
    ((parseInt(xored[16], 16) & 0x3) | 0x8).toString(16) + xored.slice(17)
  return `${xored.slice(0, 8)}-${xored.slice(8, 12)}-${xored.slice(12, 16)}-${xored.slice(16, 20)}-${xored.slice(20)}`
}

function StatusBadge({ status }: { status: SlotStatus }) {
  if (status === 'open') return <span className="bg-teal/10 text-teal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Open</span>
  if (status === 'booked') return <span className="bg-chestnut/10 text-chestnut text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Booked</span>
  if (status === 'cancelled') return <span className="bg-red-100 text-red-500 text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Cancelled</span>
  return <span className="bg-charcoal/10 text-charcoal text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase">Past</span>
}

// ---- Main Component ----

export default function RestaurantDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('home')
  const [slots, setSlots] = useState<Slot[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
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
  const [selectedLiveMusician, setSelectedLiveMusician] = useState<LiveMusician | null>(null)

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [chatInput, setChatInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<VenueProfile>(INITIAL_PROFILE)
  const [userId, setUserId] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null })
  const [discoveryRadius, setDiscoveryRadius] = useState(25)
  const [radiusDraft, setRadiusDraft] = useState(25)
  const [savingRadius, setSavingRadius] = useState(false)
  const [radiusSaved, setRadiusSaved] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [liveMusicians, setLiveMusicians] = useState<LiveMusician[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)

  // ---- Data loading ----

  const loadSlots = async (rid: string, resLat?: number | null, resLon?: number | null) => {
    const lat = resLat !== undefined ? resLat : restaurantCoords.lat
    const lon = resLon !== undefined ? resLon : restaurantCoords.lon

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
        .select('id, availability_id, musician_id, status, pay_amount, note')
        .eq('restaurant_id', rid)
        .in('status', ['pending', 'confirmed'])
        .in('availability_id', slotIds)

      if (bookingsData && bookingsData.length > 0) {
        const musicianIds = [...new Set(bookingsData.map(b => b.musician_id))]
        const { data: musicianData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role_metadata, location_text, latitude, longitude, instagram_url, youtube_url, spotify_url')
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
            }
          })
          return { ...slot, applications }
        })
        setSlots(slotsWithApps)
        return
      }
    }

    setSlots(mapped)
  }

  const loadConversations = async (uid: string) => {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: true })

    if (!msgs || msgs.length === 0) return

    const convMap = new Map<string, typeof msgs>()
    msgs.forEach(m => {
      if (!convMap.has(m.conversation_id)) convMap.set(m.conversation_id, [])
      convMap.get(m.conversation_id)!.push(m)
    })

    const otherIds = new Set<string>()
    convMap.forEach(convMsgs => {
      const first = convMsgs[0]
      const otherId = first.sender_id === uid ? first.receiver_id : first.sender_id
      otherIds.add(otherId)
    })

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', [...otherIds])

    const profileById = new Map((profiles ?? []).map(p => [p.id, p]))

    const convs: Conversation[] = []
    convMap.forEach((convMsgs, convId) => {
      const first = convMsgs[0]
      const otherId = first.sender_id === uid ? first.receiver_id : first.sender_id
      const other = profileById.get(otherId)
      const lastMsg = convMsgs[convMsgs.length - 1]
      const hasUnread = convMsgs.some(m => m.receiver_id === uid && !m.read)

      convs.push({
        id: convId,
        musician: other?.full_name ?? 'Unknown',
        avatar: other?.avatar_url ?? '',
        lastMessage: lastMsg.content,
        time: fmtMsgTime(lastMsg.created_at),
        unread: hasUnread,
        messages: convMsgs.map(m => ({
          id: m.id,
          text: m.content,
          from: m.sender_id === uid ? 'me' : 'them',
          time: fmtMsgTime(m.created_at),
        })),
        otherUserId: otherId,
      })
    })

    const lastMsgAt = (convId: string) => convMap.get(convId)?.at(-1)?.created_at ?? ''
    setConversations(convs.sort((a, b) => lastMsgAt(b.id).localeCompare(lastMsgAt(a.id))))
  }

  const loadMusicians = async (lat: number, lon: number, radius: number) => {
    setBrowseLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, location_text, latitude, longitude, instagram_url, youtube_url, spotify_url, role_metadata')
      .eq('user_type', 'musician')
    setBrowseLoading(false)
    if (!data) return

    const results: LiveMusician[] = data
      .filter(m => m.latitude != null && m.longitude != null)
      .map(m => {
        const dist = milesBetween(lat, lon, m.latitude as number, m.longitude as number)
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
        }
      })
      .filter(m => m.distance <= radius)
      .sort((a, b) => a.distance - b.distance)

    setLiveMusicians(results)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase
        .from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!data) return
      const meta = (data.role_metadata ?? {}) as Record<string, unknown>
      setProfile({
        name: (meta.venue_name as string | undefined) ?? data.full_name ?? '',
        type: (meta.cuisine_type as string | undefined) ?? '',
        address: data.location_text ?? '',
        description: data.bio ?? '',
        website: data.website ?? '',
        avatar: data.avatar_url ?? '',
      })
      const lat = data.latitude ?? null
      const lon = data.longitude ?? null
      const radius = (data.discovery_radius_miles as number | null) ?? 25
      setRestaurantCoords({ lat, lon })
      setDiscoveryRadius(radius)
      setRadiusDraft(radius)
      await loadSlots(user.id, lat, lon)
      await loadConversations(user.id)
      if (lat != null && lon != null) {
        void loadMusicians(lat, lon, radius)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Realtime: new booking applications on any of this restaurant's slots
  useEffect(() => {
    if (!userId) return
    const sub = supabase
      .channel(`bookings-restaurant-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bookings',
        filter: `restaurant_id=eq.${userId}`,
      }, () => {
        // Re-fetch all slots so the new application is reflected immediately
        loadSlots(userId)
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [userId])

  // Refresh slots whenever the restaurant switches to the slots tab
  useEffect(() => {
    if (activeTab === 'slots' && userId) loadSlots(userId)
  }, [activeTab, userId])

  // Realtime: incoming messages on the open conversation
  useEffect(() => {
    if (!userId || !selectedConvId) return
    const sub = supabase
      .channel(`conv-${selectedConvId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConvId}`,
      }, (payload) => {
        const msg = payload.new as { id: string; sender_id: string; content: string; created_at: string }
        if (msg.sender_id === userId) return
        setConversations(prev => prev.map(c =>
          c.id !== selectedConvId ? c : {
            ...c,
            lastMessage: msg.content,
            messages: [...c.messages, {
              id: msg.id,
              text: msg.content,
              from: 'them' as const,
              time: fmtMsgTime(msg.created_at),
            }],
          }
        ))
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [userId, selectedConvId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversations, selectedConvId])

  // ---- Actions ----

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
      full_name: profileDraft.name || null,
      bio: profileDraft.description || null,
      location_text: profileDraft.address || null,
      website: profileDraft.website || null,
      role_metadata: meta,
    }).eq('id', userId)
    setSavingProfile(false)
    if (upErr) { console.error('Profile save failed', upErr); return }
    setProfile(profileDraft)
    setEditingProfile(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2000)
  }

  const saveRadius = async () => {
    if (!userId) return
    setSavingRadius(true)
    const { error } = await supabase.from('profiles').update({
      discovery_radius_miles: radiusDraft,
    }).eq('id', userId)
    setSavingRadius(false)
    if (error) { console.error('Failed to save radius', error); return }
    setDiscoveryRadius(radiusDraft)
    setRadiusSaved(true)
    setTimeout(() => setRadiusSaved(false), 2000)
    if (restaurantCoords.lat != null && restaurantCoords.lon != null) {
      await loadMusicians(restaurantCoords.lat, restaurantCoords.lon, radiusDraft)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const [postingSlot, setPostingSlot] = useState(false)
  const [postSlotError, setPostSlotError] = useState('')

  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [editDraft, setEditDraft] = useState({ date: '', startTime: '', endTime: '', budget: '', notes: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  const [cancelSlotId, setCancelSlotId] = useState<string | null>(null)
  const [cancellingSlot, setCancellingSlot] = useState(false)

  const [bookingConfirmedMsg, setBookingConfirmedMsg] = useState<string | null>(null)

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
    if (insertErr) { console.error('Slot insert failed', insertErr); setPostSlotError(insertErr.message); return }
    setPostSlotOpen(false)
    setNewSlot({ date: '', startTime: '', endTime: '', genres: [], budget: '', notes: '' })
    await loadSlots(userId)
    setActiveTab('slots')
  }

  const handleApplicationAction = async (slotId: string, appId: string, action: 'accept' | 'decline') => {
    const newStatus = action === 'accept' ? 'confirmed' : 'cancelled'
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', appId)
    if (error) { console.error('Failed to update booking', error); return }

    if (action === 'accept') {
      await supabase.from('availability').update({ status: 'filled' }).eq('id', slotId)
      // Auto-decline all other pending applications for this slot
      await supabase.from('bookings')
        .update({ status: 'cancelled' })
        .eq('availability_id', slotId)
        .eq('status', 'pending')
        .neq('id', appId)

      const slot = slots.find(s => s.id === slotId)
      const app = slot?.applications.find(a => a.id === appId)
      if (slot && app) {
        setBookingConfirmedMsg(`Booking confirmed! ${app.musicianName} has been booked for ${slot.date}.`)
        setTimeout(() => setBookingConfirmedMsg(null), 4000)
      }
    }

    setSlots(prev => prev.map(slot => {
      if (slot.id !== slotId) return slot
      const app = slot.applications.find(a => a.id === appId)
      return {
        ...slot,
        status: action === 'accept' ? 'booked' : slot.status,
        bookedMusician: action === 'accept' ? app?.musicianName : slot.bookedMusician,
        applications: slot.applications.map(a => {
          if (a.id === appId) return { ...a, status: action === 'accept' ? 'confirmed' : 'cancelled' }
          if (action === 'accept' && a.status === 'pending') return { ...a, status: 'cancelled' as AppStatus }
          return a
        }),
      }
    }))
  }

  const handleEditSlot = async () => {
    if (!editingSlot || !userId) return
    setSavingEdit(true)
    const { error } = await supabase.from('availability').update({
      date: editDraft.date,
      start_time: editDraft.startTime,
      end_time: editDraft.endTime,
      pay: parseInt(editDraft.budget) || 0,
      description: editDraft.notes || null,
    }).eq('id', editingSlot.id).eq('restaurant_id', userId)
    setSavingEdit(false)
    if (error) { console.error('Edit slot failed', error); return }
    setEditingSlot(null)
    await loadSlots(userId)
  }

  const handleCancelSlot = async () => {
    if (!cancelSlotId || !userId) return
    setCancellingSlot(true)
    const slot = slots.find(s => s.id === cancelSlotId)
    if (slot && slot.applications.some(a => a.status === 'pending' || a.status === 'confirmed')) {
      await supabase.from('bookings')
        .update({ status: 'cancelled' })
        .eq('availability_id', cancelSlotId)
        .in('status', ['pending', 'confirmed'])
    }
    await supabase.from('availability').update({ status: 'cancelled' }).eq('id', cancelSlotId)
    setCancelSlotId(null)
    setCancellingSlot(false)
    await loadSlots(userId)
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedConvId || !userId) return
    const text = chatInput.trim()
    const conv = conversations.find(c => c.id === selectedConvId)
    if (!conv) return
    setChatInput('')

    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({
        sender_id: userId,
        receiver_id: conv.otherUserId,
        content: text,
        conversation_id: selectedConvId,
        read: false,
      })
      .select()
      .single()

    if (error) { console.error('Failed to send message', error); return }

    setConversations(prev => prev.map(c =>
      c.id !== selectedConvId ? c : {
        ...c,
        lastMessage: text,
        time: 'now',
        messages: [...c.messages, { id: newMsg.id, text, from: 'me', time: 'now' }],
      }
    ))
  }

  const openConversation = async (musician: { id: string; name: string; avatar: string }) => {
    if (!userId || !musician.id) return
    const convId = getConversationId(userId, musician.id)
    const existing = conversations.find(c => c.id === convId)

    if (existing) {
      setSelectedConvId(convId)
      await supabase.from('messages').update({ read: true })
        .eq('conversation_id', convId).eq('receiver_id', userId)
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: false } : c))
    } else {
      const { data: existingMsgs } = await supabase
        .from('messages').select('*')
        .eq('conversation_id', convId).order('created_at', { ascending: true })

      const newConv: Conversation = {
        id: convId,
        musician: musician.name,
        avatar: musician.avatar,
        lastMessage: existingMsgs?.at(-1)?.content ?? '',
        time: existingMsgs?.length ? fmtMsgTime(existingMsgs.at(-1)!.created_at) : '',
        unread: false,
        messages: (existingMsgs ?? []).map(m => ({
          id: m.id,
          text: m.content,
          from: m.sender_id === userId ? 'me' : 'them',
          time: fmtMsgTime(m.created_at),
        })),
        otherUserId: musician.id,
      }
      setConversations(prev => [newConv, ...prev.filter(c => c.id !== convId)])
      setSelectedConvId(convId)
    }

    setSelectedLiveMusician(null)
    setActiveTab('messages')
  }

  // ---- Derived ----

  const openSlots = slots.filter(s => s.status === 'open').length
  const pendingApps = slots.reduce((n, s) => n + s.applications.filter(a => a.status === 'pending').length, 0)
  const upcomingGigs = slots.filter(s => s.status === 'booked').length
  const pastGigs = slots.filter(s => s.status === 'past').length
  const filteredSlots = slotFilter === 'all' ? slots : slots.filter(s => s.status === slotFilter)
  const filteredMusicians = liveMusicians.filter(m => {
    const q = search.toLowerCase()
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q))
    const matchGenre = !genreFilter || m.genres.includes(genreFilter)
    return matchSearch && matchGenre
  })
  const selectedConv = conversations.find(c => c.id === selectedConvId)
  const unreadCount = conversations.filter(c => c.unread).length

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

        {/* ---- HOME TAB ---- */}
        {activeTab === 'home' && (
          <>
            {/* Profile hero */}
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

            {/* Stats */}
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

            {/* Pending applications */}
            <SectionHeader eyebrow="Inbox" title="Pending" accent="Applications." />
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
                              <div className="text-right shrink-0">
                                <p className="text-teal font-black text-sm">${slot.budget}</p>
                                <p className="text-charcoal/50 text-[9px] uppercase tracking-wide">pay offered</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-charcoal text-xs">{app.musicianGenre}</span>
                              {app.musicianLocation && <><span className="text-charcoal/40 text-xs">·</span><span className="text-charcoal text-xs">📍 {app.musicianLocation}</span></>}
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
                            {app.instagram && <a href={app.instagram} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">📷 Instagram</a>}
                            {app.youtube && <a href={app.youtube} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">▶ YouTube</a>}
                            {app.spotify && <a href={app.spotify} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">🎵 Spotify</a>}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button onClick={() => handleApplicationAction(slot.id, app.id, 'accept')} className="flex-1 bg-teal text-snow py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Accept</button>
                          <button onClick={() => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-graphite/10 text-graphite hover:bg-graphite/20 transition-colors">💬</button>
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
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        selectedSlotId={selectedSlotId}
                        setSelectedSlotId={setSelectedSlotId}
                        handleApplicationAction={handleApplicationAction}
                        onMessage={(app) => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })}
                        onEdit={slot.status === 'open' ? () => { setEditingSlot(slot); setEditDraft({ date: slot.rawDate, startTime: slot.rawStartTime, endTime: slot.rawEndTime, budget: String(slot.budget), notes: slot.notes }) } : undefined}
                        onCancel={(slot.status === 'open' || slot.status === 'booked') ? () => setCancelSlotId(slot.id) : undefined}
                      />
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
                onMessage={(app) => openConversation({ id: app.musicianId, name: app.musicianName, avatar: app.avatar })}
                onEditSlot={(slot) => { setEditingSlot(slot); setEditDraft({ date: slot.rawDate, startTime: slot.rawStartTime, endTime: slot.rawEndTime, budget: String(slot.budget), notes: slot.notes }) }}
                onCancelSlot={(slotId) => setCancelSlotId(slotId)}
              />
            )}
          </>
        )}

        {/* ---- BROWSE TAB: LIST ---- */}
        {activeTab === 'browse' && !selectedLiveMusician && (
          <>
            <div className="mb-5">
              <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em] mb-1">Talent Pool</p>
              <h2 className="text-graphite text-3xl font-black tracking-tight leading-none">
                Browse <span className="text-chestnut italic">Musicians.</span>
              </h2>
            </div>

            {/* Radius filter bar */}
            <div className="flex items-center justify-between gap-3 mb-4 bg-white rounded-xl px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-chestnut shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-charcoal text-sm font-semibold">Within {discoveryRadius} miles</span>
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
                {browseLoading ? 'Loading…' : '↺ Refresh'}
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40 text-sm pointer-events-none">🔍</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or genre..."
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>

            {/* Genre filter chips */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              <button onClick={() => setGenreFilter(null)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!genreFilter ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}>All</button>
              {GENRES.map(g => (
                <button key={g} onClick={() => setGenreFilter(genreFilter === g ? null : g)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${genreFilter === g ? 'bg-graphite text-snow' : 'bg-white text-charcoal hover:bg-[#E8E4E0]'}`}>{g}</button>
              ))}
            </div>

            {/* Loading skeleton */}
            {browseLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="w-14 h-14 rounded-full bg-charcoal/10 shrink-0" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-4 bg-charcoal/10 rounded w-2/3" />
                        <div className="h-3 bg-charcoal/10 rounded w-1/2" />
                        <div className="h-3 bg-charcoal/10 rounded w-3/4" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 bg-charcoal/10 rounded-xl flex-1" />
                      <div className="h-9 bg-charcoal/10 rounded-xl flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No location */}
            {!browseLoading && restaurantCoords.lat == null && (
              <EmptyState
                icon="📍"
                title="Location not set"
                body="Add your location in Settings so we can find musicians near you."
              />
            )}

            {/* Empty state */}
            {!browseLoading && restaurantCoords.lat != null && filteredMusicians.length === 0 && (
              <EmptyState
                icon="🎸"
                title={`No musicians found within ${discoveryRadius} miles`}
                body="Try increasing your discovery radius in your profile settings."
                action={{ label: 'Update Radius in Profile', onClick: () => setActiveTab('profile') }}
              />
            )}

            {/* Musician cards */}
            {!browseLoading && filteredMusicians.length > 0 && (
              <div className="space-y-3">
                {filteredMusicians.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start gap-4 mb-3">
                      <Avatar src={m.avatar} className="w-14 h-14 rounded-full shrink-0" textSize="text-2xl" bg="bg-chestnut/10" />
                      <div className="flex-1 min-w-0">
                        <p className="text-graphite font-bold text-sm">{m.name}</p>
                        {m.location && <p className="text-charcoal text-xs mt-0.5">{m.location}</p>}
                        <p className="text-chestnut text-xs font-semibold mt-0.5">📍 {m.distanceStr}</p>
                        {m.bio && <p className="text-charcoal/70 text-xs mt-1.5 line-clamp-2 leading-relaxed">{m.bio}</p>}
                      </div>
                    </div>
                    {m.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {m.genres.map(g => <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>)}
                      </div>
                    )}
                    {(m.instagram || m.youtube || m.spotify) && (
                      <div className="flex flex-wrap gap-3 mb-3">
                        {m.instagram && <a href={m.instagram} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">📷 Instagram</a>}
                        {m.youtube && <a href={m.youtube} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">▶ YouTube</a>}
                        {m.spotify && <a href={m.spotify} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">🎵 Spotify</a>}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => openConversation({ id: m.id, name: m.name, avatar: m.avatar })}
                        className="flex-1 bg-snow text-charcoal py-2.5 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                      >
                        💬 Message
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
                  <p className="text-chestnut text-sm mt-1 font-semibold">📍 {selectedLiveMusician.distanceStr}</p>
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
                      <a href={selectedLiveMusician.instagram} target="_blank" rel="noopener noreferrer" className="bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors">📷 Instagram</a>
                    )}
                    {selectedLiveMusician.youtube && (
                      <a href={selectedLiveMusician.youtube} target="_blank" rel="noopener noreferrer" className="bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors">▶ YouTube</a>
                    )}
                    {selectedLiveMusician.spotify && (
                      <a href={selectedLiveMusician.spotify} target="_blank" rel="noopener noreferrer" className="bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors">🎵 Spotify</a>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => openConversation({ id: selectedLiveMusician.id, name: selectedLiveMusician.name, avatar: selectedLiveMusician.avatar })}
                className="flex-1 bg-graphite text-snow py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
              >
                💬 Message
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
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-charcoal/[0.06]">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={async () => {
                      setSelectedConvId(conv.id)
                      if (conv.unread) {
                        await supabase.from('messages').update({ read: true })
                          .eq('conversation_id', conv.id).eq('receiver_id', userId)
                        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread: false } : c))
                      }
                    }}
                    className="w-full px-4 py-3.5 flex items-center gap-3.5 hover:bg-snow/80 transition-colors text-left"
                  >
                    <div className="relative shrink-0">
                      <Avatar src={conv.avatar} className="w-12 h-12 rounded-full" textSize="text-2xl" bg="bg-chestnut/10" />
                      {conv.unread && (
                        <span className="absolute top-0 right-0 w-3 h-3 bg-chestnut rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <p className={`text-sm truncate ${conv.unread ? 'font-bold text-graphite' : 'font-semibold text-charcoal'}`}>
                          {conv.musician}
                        </p>
                        <p className="text-[11px] text-charcoal/40 shrink-0">{conv.time}</p>
                      </div>
                      <p className={`text-xs truncate ${conv.unread ? 'font-medium text-graphite' : 'text-charcoal/55'}`}>
                        {conv.lastMessage || 'Start a conversation'}
                      </p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-charcoal/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- MESSAGES TAB: CHAT VIEW ---- */}
        {activeTab === 'messages' && selectedConv && (
          <div className="-mx-4 -mt-5 flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-charcoal/[0.08] shadow-sm shrink-0">
              <button
                onClick={() => setSelectedConvId(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-snow transition-colors text-charcoal hover:text-chestnut shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <Avatar src={selectedConv.avatar} className="w-10 h-10 rounded-full" textSize="text-lg" bg="bg-chestnut/10" />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => router.push('/profile/' + selectedConv.otherUserId)}
                  className="text-graphite font-bold text-sm leading-tight truncate hover:text-chestnut transition-colors text-left"
                >
                  {selectedConv.musician}
                </button>
                <p className="text-charcoal/40 text-[11px] leading-tight">Musician · tap to view profile</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1" style={{ background: '#F5F0EC' }}>
              {selectedConv.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl">👋</div>
                  <p className="text-graphite font-bold">Say hello!</p>
                  <p className="text-charcoal/60 text-sm max-w-[200px] leading-relaxed">
                    Start a conversation with {selectedConv.musician}
                  </p>
                </div>
              )}
              {selectedConv.messages.map((msg, i) => {
                const isMe = msg.from === 'me'
                const prev = selectedConv.messages[i - 1]
                const groupBreak = prev && prev.from !== msg.from
                return (
                  <div key={msg.id}>
                    {groupBreak && <div className="h-2" />}
                    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[72%] px-4 py-2.5 text-sm shadow-sm ${
                        isMe
                          ? 'bg-chestnut text-snow rounded-2xl rounded-br-sm'
                          : 'bg-white text-graphite rounded-2xl rounded-bl-sm'
                      }`}>
                        <p className="leading-relaxed">{msg.text}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? 'text-snow/50 text-right' : 'text-charcoal/40'}`}>{msg.time}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="bg-white border-t border-charcoal/[0.08] px-4 py-3 flex items-center gap-2.5 shrink-0">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder="Message..."
                className="flex-1 bg-snow rounded-full px-4 py-2.5 text-sm focus:outline-none focus:shadow-md transition-shadow placeholder:text-charcoal/40"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="w-10 h-10 bg-chestnut rounded-full flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-30"
              >
                <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
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
                <div className="flex items-center gap-3 shrink-0">
                  {profileSaved && (
                    <span className="flex items-center gap-1 text-teal text-xs font-semibold">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      Saved!
                    </span>
                  )}
                  <button onClick={() => { setEditingProfile(true); setProfileDraft(profile) }} className="text-chestnut text-sm font-bold hover:underline">Edit</button>
                </div>
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

            {/* Discovery Radius */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4 text-chestnut shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3 className="text-graphite font-bold">Discovery Radius</h3>
              </div>
              <p className="text-charcoal/60 text-xs mb-5 leading-relaxed">Musicians within this radius will appear in your browse tab</p>
              <div className="flex items-center justify-between mb-3">
                <span className="text-charcoal text-xs font-medium">5 mi</span>
                <span className="text-graphite font-black text-xl">{radiusDraft} miles</span>
                <span className="text-charcoal text-xs font-medium">100 mi</span>
              </div>
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={radiusDraft}
                onChange={e => setRadiusDraft(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: '#DC7F41',
                  background: `linear-gradient(to right, #DC7F41 ${((radiusDraft - 5) / 95) * 100}%, #E8E4E0 ${((radiusDraft - 5) / 95) * 100}%)`,
                }}
              />
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={saveRadius}
                  disabled={savingRadius || radiusDraft === discoveryRadius}
                  className="bg-chestnut text-snow px-5 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {savingRadius ? 'Saving…' : 'Save Radius'}
                </button>
                {radiusSaved && (
                  <span className="flex items-center gap-1.5 text-teal text-sm font-semibold">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Saved!
                  </span>
                )}
              </div>
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

      {/* ---- BOOKING CONFIRMED TOAST ---- */}
      {bookingConfirmedMsg && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]">
          <div className="bg-graphite text-snow rounded-2xl px-5 py-4 shadow-2xl flex items-start gap-3">
            <span className="text-2xl shrink-0">🎉</span>
            <div>
              <p className="font-black text-sm">Booking Confirmed!</p>
              <p className="text-snow/70 text-xs mt-0.5 leading-relaxed">{bookingConfirmedMsg}</p>
            </div>
          </div>
        </div>
      )}

      {/* ---- EDIT SLOT MODAL ---- */}
      {editingSlot && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Edit Slot</p>
                <h3 className="text-snow text-xl font-black tracking-tight">{editingSlot.date}</h3>
              </div>
              <button onClick={() => setEditingSlot(null)} className="text-snow/60 hover:text-snow transition-colors text-xl leading-none">✕</button>
            </div>
            <div className="p-6">
              {editingSlot.applications.some(a => a.status === 'pending') && (
                <div className="bg-chestnut/10 border border-chestnut/20 rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5">
                  <span className="text-chestnut text-base shrink-0">⚠️</span>
                  <p className="text-chestnut text-xs leading-relaxed font-medium">This slot has pending applications. Editing the details will not automatically notify applicants.</p>
                </div>
              )}
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Date</label>
              <input
                type="date"
                value={editDraft.date}
                onChange={e => setEditDraft(p => ({ ...p, date: e.target.value }))}
                className="w-full bg-white rounded-xl px-4 py-2.5 mb-5 shadow-sm focus:outline-none text-sm border border-charcoal/10"
              />
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Start Time</label>
                  <input type="time" value={editDraft.startTime} onChange={e => setEditDraft(p => ({ ...p, startTime: e.target.value }))} className="w-full bg-white rounded-xl px-4 py-2.5 shadow-sm focus:outline-none text-sm border border-charcoal/10" />
                </div>
                <div>
                  <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">End Time</label>
                  <input type="time" value={editDraft.endTime} onChange={e => setEditDraft(p => ({ ...p, endTime: e.target.value }))} className="w-full bg-white rounded-xl px-4 py-2.5 shadow-sm focus:outline-none text-sm border border-charcoal/10" />
                </div>
              </div>
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Pay Offered</label>
              <div className="relative mb-5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal font-bold text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  value={editDraft.budget}
                  onChange={e => setEditDraft(p => ({ ...p, budget: e.target.value }))}
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
          </div>
        </div>
      )}

      {/* ---- CANCEL SLOT MODAL ---- */}
      {cancelSlotId && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-snow w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">🚫</div>
              <h3 className="text-graphite text-xl font-black text-center mb-2">Cancel this slot?</h3>
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
          </div>
        </div>
      )}

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
              <label className="block text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">Pay Offered</label>
              <div className="relative mb-5">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal font-bold text-sm pointer-events-none">$</span>
                <input
                  type="number"
                  placeholder="e.g. 200"
                  value={newSlot.budget}
                  onChange={e => setNewSlot(p => ({ ...p, budget: e.target.value }))}
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
                          <p className="text-teal font-black text-lg">{newSlot.budget ? `$${newSlot.budget}` : '—'}</p>
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

function SlotCard({ slot, selectedSlotId, setSelectedSlotId, handleApplicationAction, onMessage, onEdit, onCancel }: {
  slot: Slot
  selectedSlotId: string | null
  setSelectedSlotId: (id: string | null) => void
  handleApplicationAction: (slotId: string, appId: string, action: 'accept' | 'decline') => void
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
            <span>Pay Offered: <span className="text-teal font-black">${slot.budget}</span></span>
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
                      <p className="text-teal font-black text-sm">${slot.budget}</p>
                      <p className="text-charcoal/50 text-[9px] uppercase tracking-wide">pay offered</p>
                    </div>
                  </div>
                  <p className="text-charcoal text-xs">{app.musicianGenre}</p>
                  {app.musicianLocation && <p className="text-charcoal/60 text-xs mt-0.5">📍 {app.musicianLocation}{app.musicianDistance ? ` · ${app.musicianDistance}` : ''}</p>}
                </div>
              </div>
              {(app.instagram || app.youtube || app.spotify) && (
                <div className="flex flex-wrap gap-3 mb-2">
                  {app.instagram && <a href={app.instagram} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">📷 Instagram</a>}
                  {app.youtube && <a href={app.youtube} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">▶ YouTube</a>}
                  {app.spotify && <a href={app.spotify} target="_blank" rel="noopener noreferrer" className="text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors">🎵 Spotify</a>}
                </div>
              )}
              {app.note && <div className="bg-snow rounded-lg px-3 py-2 mb-2"><p className="text-charcoal text-sm italic">"{app.note}"</p></div>}
              {app.status === 'pending' ? (
                <div className="flex gap-2">
                  <button onClick={() => handleApplicationAction(slot.id, app.id, 'accept')} className="flex-1 bg-teal text-snow py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">Accept</button>
                  <button onClick={() => onMessage(app)} className="px-3 py-2 rounded-lg text-xs font-medium bg-graphite/10 text-graphite hover:bg-graphite/20">💬</button>
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

function SlotCalendar({ slots, calendarMonth, setCalendarMonth, calendarSelectedDay, setCalendarSelectedDay, selectedSlotId, setSelectedSlotId, handleApplicationAction, onMessage, onEditSlot, onCancelSlot }: {
  slots: Slot[]
  calendarMonth: Date
  setCalendarMonth: (d: Date) => void
  calendarSelectedDay: string | null
  setCalendarSelectedDay: (d: string | null) => void
  selectedSlotId: string | null
  setSelectedSlotId: (id: string | null) => void
  handleApplicationAction: (slotId: string, appId: string, action: 'accept' | 'decline') => void
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
