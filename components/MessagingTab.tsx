'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'

// ---- Types ----

interface DBMessage {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  read: boolean
  conversation_id: string
}

interface Reaction {
  emoji: string
  count: number
  userReacted: boolean
}

interface Message {
  id: string
  from: 'me' | 'them'
  text: string
  isoTime: string
  reactions: Reaction[]
}

interface Conversation {
  id: string
  otherId: string
  otherName: string
  otherAvatar: string
  otherUserType: string
  otherLocation: string
  lastMessage: string
  lastIsoTime: string
  unread: boolean
}

interface ComposeResult {
  id: string
  name: string
  avatar: string
  userType: string
  location: string
}

export interface MessagingTabRef {
  openWith: (otherId: string, name: string, avatar: string) => void
}

// ---- Constants ----

// Each reaction has a stable emoji key (stored in DB) and an SVG label for display.
const REACTIONS: { emoji: string; label: string; color: string }[] = [
  { emoji: '❤️', label: 'Love',  color: '#e05' },
  { emoji: '😂', label: 'Haha',  color: '#f90' },
  { emoji: '😮', label: 'Wow',   color: '#f90' },
  { emoji: '😢', label: 'Sad',   color: '#5af' },
  { emoji: '👏', label: 'Like',  color: '#f90' },
  { emoji: '🔥', label: 'Fire',  color: '#f50' },
]

function ReactionIcon({ emoji, size = 16 }: { emoji: string; size?: number }) {
  const s = `${size}px`
  if (emoji === '❤️') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="#ee0055" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
  )
  if (emoji === '😂') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f90" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9" strokeWidth="2.5"/><line x1="15" x2="15.01" y1="9" y2="9" strokeWidth="2.5"/></svg>
  )
  if (emoji === '😮') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f90" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s0-2 4-2 4 2 4 2"/><line x1="9" x2="9.01" y1="9" y2="9" strokeWidth="2.5"/><line x1="15" x2="15.01" y1="9" y2="9" strokeWidth="2.5"/></svg>
  )
  if (emoji === '😢') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#5af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" x2="9.01" y1="9" y2="9" strokeWidth="2.5"/><line x1="15" x2="15.01" y1="9" y2="9" strokeWidth="2.5"/></svg>
  )
  if (emoji === '👏') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f90" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
  )
  // 🔥
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#f50" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
  )
}

const REPORT_REASONS = ['Spam', 'Inappropriate content', 'Harassment', 'Other']

// ---- Helpers ----

function getConversationId(uid1: string, uid2: string): string {
  const [a, b] = [uid1, uid2].sort()
  const aC = a.replace(/-/g, '')
  const bC = b.replace(/-/g, '')
  let x = ''
  for (let i = 0; i < 32; i++) x += (parseInt(aC[i], 16) ^ parseInt(bC[i], 16)).toString(16)
  x = x.slice(0, 12) + '4' + x.slice(13, 16) + ((parseInt(x[16], 16) & 0x3) | 0x8).toString(16) + x.slice(17)
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } else if (isYesterday) {
    return 'Yesterday'
  } else if (now.getTime() - date.getTime() < 7 * 86400000) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  } else {
    const sameYear = date.getFullYear() === now.getFullYear()
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
  }
}

function formatDateSeparator(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  if (new Date(now.getTime() - 86400000).toDateString() === date.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

type DisplayItem =
  | { type: 'date'; label: string }
  | { type: 'message'; msg: Message; showAvatar: boolean; showTimestamp: boolean; isGroupStart: boolean }

function buildDisplayItems(messages: Message[]): DisplayItem[] {
  const items: DisplayItem[] = []
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const prev = messages[i - 1]
    const next = messages[i + 1]

    if (!prev || new Date(msg.isoTime).toDateString() !== new Date(prev.isoTime).toDateString()) {
      items.push({ type: 'date', label: formatDateSeparator(msg.isoTime) })
    }

    const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString()
    const timeDiff = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime())

    const prevSameGroup = !!(prev && prev.from === msg.from &&
      sameDay(msg.isoTime, prev.isoTime) &&
      timeDiff(msg.isoTime, prev.isoTime) < 5 * 60 * 1000)

    const nextSameGroup = !!(next && next.from === msg.from &&
      sameDay(msg.isoTime, next.isoTime) &&
      timeDiff(msg.isoTime, next.isoTime) < 5 * 60 * 1000)

    items.push({
      type: 'message',
      msg,
      showAvatar: msg.from === 'them' && !prevSameGroup,
      showTimestamp: !nextSameGroup,
      isGroupStart: !prevSameGroup,
    })
  }
  return items
}

// ---- Main Component ----

interface Props {
  userId: string
  currentUserType?: string
  onUnreadChange?: (n: number) => void
}

const MessagingTab = forwardRef<MessagingTabRef, Props>(function MessagingTab({ userId, currentUserType, onUnreadChange }, ref) {
  const router = useRouter()
  const { toast } = useToast()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messagesByConv, setMessagesByConv] = useState<Map<string, Message[]>>(new Map())
  const [chatInput, setChatInput] = useState('')
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteConfirmConvId, setDeleteConfirmConvId] = useState<string | null>(null)
  const [reportConvId, setReportConvId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [composing, setComposing] = useState(false)
  const [gigOfferOpen, setGigOfferOpen] = useState(false)
  const [composeSearch, setComposeSearch] = useState('')
  const [composeResults, setComposeResults] = useState<ComposeResult[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null
  const messages = selectedConvId ? (messagesByConv.get(selectedConvId) ?? []) : []
  const displayItems = buildDisplayItems(messages)
  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c => c.otherName.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations

  // Close three-dots menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // ---- Load conversations ----

  const loadConversations = useCallback(async () => {
    const uid = userIdRef.current
    if (!uid) return
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, read, conversation_id')
      .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      .order('created_at', { ascending: true })
    if (!msgs || msgs.length === 0) return

    const convMap = new Map<string, DBMessage[]>()
    msgs.forEach(m => {
      if (!convMap.has(m.conversation_id)) convMap.set(m.conversation_id, [])
      convMap.get(m.conversation_id)!.push(m)
    })

    const otherIds = new Set<string>()
    convMap.forEach(ms => {
      const f = ms[0]
      otherIds.add(f.sender_id === uid ? f.receiver_id : f.sender_id)
    })

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, user_type, location_text, role_metadata')
      .in('id', [...otherIds])
    const profById = new Map((profiles ?? []).map(p => [p.id, p]))

    const convs: Conversation[] = []
    convMap.forEach((ms, convId) => {
      const f = ms[0]
      const otherId = f.sender_id === uid ? f.receiver_id : f.sender_id
      const other = profById.get(otherId)
      const meta = (other?.role_metadata ?? {}) as Record<string, unknown>
      const last = ms[ms.length - 1]
      convs.push({
        id: convId,
        otherId,
        otherName: (meta.venue_name as string | undefined) ?? other?.full_name ?? 'Unknown',
        otherAvatar: other?.avatar_url ?? '',
        otherUserType: other?.user_type ?? '',
        otherLocation: other?.location_text ?? '',
        lastMessage: last.content,
        lastIsoTime: last.created_at,
        unread: ms.some(m => m.receiver_id === uid && !m.read),
      })
    })
    convs.sort((a, b) => b.lastIsoTime.localeCompare(a.lastIsoTime))
    setConversations(convs)
    onUnreadChange?.(convs.filter(c => c.unread).length)
  }, [onUnreadChange])

  // ---- Load messages for a conversation ----

  const loadMessages = useCallback(async (convId: string) => {
    const uid = userIdRef.current
    const { data: msgs } = await supabase
      .from('messages').select('id, sender_id, content, created_at')
      .eq('conversation_id', convId).order('created_at', { ascending: true })
    if (!msgs) return

    const mapped: Message[] = msgs.map(m => ({
      id: m.id,
      from: m.sender_id === uid ? 'me' : 'them',
      text: m.content,
      isoTime: m.created_at,
      reactions: [],
    }))

    try {
      const { data: rxns } = await supabase
        .from('message_reactions').select('message_id, emoji, user_id')
        .in('message_id', msgs.map(m => m.id))
      if (rxns?.length) {
        const rxnMap = new Map<string, { emoji: string; users: string[] }[]>()
        rxns.forEach(r => {
          if (!rxnMap.has(r.message_id)) rxnMap.set(r.message_id, [])
          const ex = rxnMap.get(r.message_id)!.find(x => x.emoji === r.emoji)
          if (ex) ex.users.push(r.user_id)
          else rxnMap.get(r.message_id)!.push({ emoji: r.emoji, users: [r.user_id] })
        })
        mapped.forEach(m => {
          m.reactions = (rxnMap.get(m.id) ?? []).map(g => ({
            emoji: g.emoji, count: g.users.length, userReacted: g.users.includes(uid),
          }))
        })
      }
    } catch { /* message_reactions table may not exist yet */ }

    setMessagesByConv(prev => { const map = new Map(prev); map.set(convId, mapped); return map })
  }, [])

  // ---- Open conversation via ref (from profile page or dashboard action) ----

  const openWithAsync = useCallback(async (otherId: string, name: string, avatar: string) => {
    const uid = userIdRef.current
    if (!uid) return
    const convId = getConversationId(uid, otherId)

    const { data: existMsgs } = await supabase
      .from('messages').select('id, sender_id, content, created_at')
      .eq('conversation_id', convId).order('created_at', { ascending: true })

    const mapped: Message[] = (existMsgs ?? []).map(m => ({
      id: m.id, from: m.sender_id === uid ? 'me' : 'them',
      text: m.content, isoTime: m.created_at, reactions: [],
    }))

    if (mapped.length > 0) {
      try {
        const { data: rxns } = await supabase
          .from('message_reactions').select('message_id, emoji, user_id')
          .in('message_id', mapped.map(m => m.id))
        if (rxns?.length) {
          const rxnMap = new Map<string, { emoji: string; users: string[] }[]>()
          rxns.forEach(r => {
            if (!rxnMap.has(r.message_id)) rxnMap.set(r.message_id, [])
            const ex = rxnMap.get(r.message_id)!.find(x => x.emoji === r.emoji)
            if (ex) ex.users.push(r.user_id)
            else rxnMap.get(r.message_id)!.push({ emoji: r.emoji, users: [r.user_id] })
          })
          mapped.forEach(m => {
            m.reactions = (rxnMap.get(m.id) ?? []).map(g => ({
              emoji: g.emoji, count: g.users.length, userReacted: g.users.includes(uid),
            }))
          })
        }
      } catch { /* message_reactions table may not exist yet */ }
    }

    setMessagesByConv(prev => { const map = new Map(prev); map.set(convId, mapped); return map })

    const { data: prof } = await supabase
      .from('profiles').select('user_type, location_text').eq('id', otherId).maybeSingle()

    setConversations(prev => {
      if (prev.find(c => c.id === convId)) return prev
      return [{
        id: convId, otherId, otherName: name, otherAvatar: avatar,
        otherUserType: prof?.user_type ?? '',
        otherLocation: prof?.location_text ?? '',
        lastMessage: existMsgs?.at(-1)?.content ?? '',
        lastIsoTime: existMsgs?.at(-1)?.created_at ?? new Date().toISOString(),
        unread: false,
      }, ...prev]
    })
    setSelectedConvId(convId)
  }, [])

  useImperativeHandle(ref, () => ({ openWith: openWithAsync }), [openWithAsync])

  // ---- Select conversation ----

  const selectConv = async (convId: string) => {
    setSelectedConvId(convId)
    if (!messagesByConv.has(convId)) await loadMessages(convId)
    await supabase.from('messages').update({ read: true })
      .eq('conversation_id', convId).eq('receiver_id', userIdRef.current)
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: false } : c))
    onUnreadChange?.(conversations.filter(c => c.unread && c.id !== convId).length)
  }

  // ---- Delete thread ----

  const handleDeleteThread = async (convId: string) => {
    const uid = userIdRef.current
    setDeleting(true)
    try {
      await supabase.from('messages').delete()
        .eq('conversation_id', convId)
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      setConversations(prev => prev.filter(c => c.id !== convId))
      onUnreadChange?.(conversations.filter(c => c.unread && c.id !== convId).length)
      setMessagesByConv(prev => { const map = new Map(prev); map.delete(convId); return map })
      if (selectedConvId === convId) setSelectedConvId(null)
      setDeleteConfirmConvId(null)
      setMenuOpen(false)
    } catch (err) {
      console.error('Delete thread failed:', err)
      toast.error('Could not delete the conversation.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- Report ----

  const handleReport = async () => {
    const uid = userIdRef.current
    if (!reportReason || !reportConvId) return
    const conv = conversations.find(c => c.id === reportConvId)
    setReporting(true)
    try {
      await supabase.from('reports').insert({
        reporter_id: uid,
        reported_id: conv?.otherId,
        conversation_id: reportConvId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      })
    } catch { /* reports table may not exist yet */ }
    setReportConvId(null)
    setReportReason('')
    setReportDetails('')
    setMenuOpen(false)
    setReporting(false)
    toast.success('Report submitted. Thank you.')
  }

  // ---- Compose: debounced profile search ----

  useEffect(() => {
    if (!composeSearch.trim() || composeSearch.length < 2) { setComposeResults([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('profiles')
        .select('id, full_name, avatar_url, user_type, location_text, role_metadata')
        .ilike('full_name', `%${composeSearch}%`)
        .neq('id', userIdRef.current)
        .limit(8)
      setComposeResults((data ?? []).map(p => {
        const meta = p.role_metadata as Record<string, unknown> | null
        return {
          id: p.id,
          name: (meta?.venue_name as string | undefined) ?? p.full_name ?? 'Unknown',
          avatar: p.avatar_url ?? '',
          userType: p.user_type ?? '',
          location: p.location_text ?? '',
        }
      }))
    }, 300)
    return () => clearTimeout(t)
  }, [composeSearch])

  // ---- Effects ----

  useEffect(() => {
    if (userId) loadConversations()
  }, [userId, loadConversations])

  useEffect(() => {
    const stored = sessionStorage.getItem('drumup_open_msg')
    if (stored) {
      sessionStorage.removeItem('drumup_open_msg')
      try {
        const { id, name, avatar } = JSON.parse(stored) as { id: string; name: string; avatar: string }
        if (id) openWithAsync(id, name, avatar)
      } catch { /* ignore */ }
    }
  }, [userId, openWithAsync])

  // Real-time: incoming messages in selected conversation
  useEffect(() => {
    const uid = userIdRef.current
    if (!uid || !selectedConvId) return
    const sub = supabase
      .channel(`msg-tab-${selectedConvId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${selectedConvId}`,
      }, payload => {
        const m = payload.new as DBMessage
        if (m.sender_id === uid) return
        const newMsg: Message = { id: m.id, from: 'them', text: m.content, isoTime: m.created_at, reactions: [] }
        setMessagesByConv(prev => {
          const map = new Map(prev)
          map.set(selectedConvId, [...(map.get(selectedConvId) ?? []), newMsg])
          return map
        })
        setConversations(prev => prev.map(c =>
          c.id === selectedConvId ? { ...c, lastMessage: m.content.startsWith('__GIG_OFFER__:') ? 'Gig Offer' : m.content, lastIsoTime: m.created_at } : c
        ))
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [selectedConvId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedConvId])

  // Lock body scroll when conversation is open so it doesn't bleed through the overlay
  useEffect(() => {
    if (selectedConvId) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [selectedConvId])

  // ---- Send ----

  const handleSend = async () => {
    const uid = userIdRef.current
    if (!chatInput.trim() || !selectedConvId || !uid || !selectedConv) return
    const text = chatInput.trim()
    setChatInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({ sender_id: uid, receiver_id: selectedConv.otherId, content: text, conversation_id: selectedConvId, read: false })
      .select().single()
    if (error) { console.error('Send failed', error); setChatInput(text); return }
    const newMessage: Message = { id: newMsg.id, from: 'me', text, isoTime: newMsg.created_at, reactions: [] }
    setMessagesByConv(prev => {
      const map = new Map(prev)
      map.set(selectedConvId, [...(map.get(selectedConvId) ?? []), newMessage])
      return map
    })
    setConversations(prev => prev.map(c =>
      c.id === selectedConvId ? { ...c, lastMessage: text, lastIsoTime: newMsg.created_at } : c
    ))

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/notifications/new-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message_id: newMsg.id }),
      }).catch(err => console.error('[Email] new-message failed:', err))
    })
  }

  const sendGigOffer = async (bookingId: string) => {
    const uid = userIdRef.current
    if (!selectedConvId || !uid || !selectedConv) return
    const text = `__GIG_OFFER__:${bookingId}`
    const { data: newMsg, error } = await supabase
      .from('messages')
      .insert({ sender_id: uid, receiver_id: selectedConv.otherId, content: text, conversation_id: selectedConvId, read: false })
      .select().single()
    if (error) { console.error('Send gig offer failed', error); return }
    const newMessage: Message = { id: newMsg.id, from: 'me', text, isoTime: newMsg.created_at, reactions: [] }
    setMessagesByConv(prev => {
      const map = new Map(prev)
      map.set(selectedConvId, [...(map.get(selectedConvId) ?? []), newMessage])
      return map
    })
    setConversations(prev => prev.map(c =>
      c.id === selectedConvId ? { ...c, lastMessage: 'Gig Offer', lastIsoTime: newMsg.created_at } : c
    ))
  }

  // ---- Reactions ----

  const handleReaction = async (msgId: string, emoji: string) => {
    const uid = userIdRef.current
    if (!uid || !selectedConvId) return
    setReactionMsgId(null)
    const msgs = messagesByConv.get(selectedConvId) ?? []
    const msg = msgs.find(m => m.id === msgId)
    const alreadyReacted = msg?.reactions.find(r => r.emoji === emoji)?.userReacted ?? false
    try {
      if (alreadyReacted) {
        await supabase.from('message_reactions').delete().eq('message_id', msgId).eq('user_id', uid).eq('emoji', emoji)
      } else {
        await supabase.from('message_reactions').insert({ message_id: msgId, user_id: uid, emoji })
      }
    } catch { /* table may not exist */ }
    setMessagesByConv(prev => {
      const map = new Map(prev)
      const ms = [...(map.get(selectedConvId) ?? [])]
      const idx = ms.findIndex(m => m.id === msgId)
      if (idx === -1) return map
      const u = { ...ms[idx] }
      const rxns = [...u.reactions]
      const gi = rxns.findIndex(r => r.emoji === emoji)
      if (alreadyReacted) {
        if (gi !== -1) {
          const g = { ...rxns[gi], count: rxns[gi].count - 1, userReacted: false }
          if (g.count <= 0) rxns.splice(gi, 1); else rxns[gi] = g
        }
      } else {
        if (gi !== -1) rxns[gi] = { ...rxns[gi], count: rxns[gi].count + 1, userReacted: true }
        else rxns.push({ emoji, count: 1, userReacted: true })
      }
      u.reactions = rxns; ms[idx] = u; map.set(selectedConvId, ms); return map
    })
  }

  // ---- Navigate to other user's profile (stores return data) ----

  const goToProfile = () => {
    if (!selectedConv) return
    sessionStorage.setItem('profileReturnTo', JSON.stringify({
      partnerId: selectedConv.otherId,
      partnerName: selectedConv.otherName,
      partnerAvatar: selectedConv.otherAvatar,
    }))
    setMenuOpen(false)
    router.push('/profile/' + selectedConv.otherId)
  }

  // =============================
  // RENDER: Compose (new message)
  // =============================

  if (!selectedConvId && composing) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => { setComposing(false); setComposeSearch(''); setComposeResults([]) }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#E8E4E0] transition-colors shrink-0"
          >
            <svg className="w-4 h-4 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <p className="text-graphite font-black text-xl">New Message</p>
        </div>
        <div className="relative mb-4">
          <svg className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            autoFocus
            value={composeSearch}
            onChange={e => setComposeSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm shadow-sm focus:outline-none focus:shadow-md transition-shadow placeholder:text-charcoal/40"
          />
        </div>
        {composeResults.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-charcoal/[0.06]">
            {composeResults.map(r => (
              <button
                key={r.id}
                onClick={() => {
                  setComposing(false); setComposeSearch(''); setComposeResults([])
                  openWithAsync(r.id, r.name, r.avatar)
                }}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-snow/80 transition-colors"
              >
                <Avatar src={r.avatar} className="w-12 h-12 rounded-full shrink-0" textSize="text-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-graphite font-bold text-sm truncate">{r.name}</p>
                  <p className="text-charcoal/60 text-xs capitalize">
                    {[r.userType, r.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : composeSearch.length >= 2 ? (
          <p className="text-center text-charcoal/40 text-sm py-8">No users found</p>
        ) : null}
      </div>
    )
  }

  // =============================
  // RENDER: Conversations list
  // =============================

  if (!selectedConvId) {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-graphite text-3xl font-black tracking-tight">
            Your <span className="text-chestnut italic">Messages.</span>
          </p>
          <button
            onClick={() => setComposing(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm hover:shadow-md transition-shadow text-charcoal hover:text-chestnut"
            title="New message"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>

        {/* Search bar (only if there are conversations to search) */}
        {conversations.length > 2 && (
          <div className="relative mb-4">
            <svg className="w-4 h-4 text-charcoal/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm shadow-sm focus:outline-none focus:shadow-md transition-shadow placeholder:text-charcoal/40"
            />
          </div>
        )}

        {/* Empty state */}
        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-chestnut/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
            </div>
            <p className="text-graphite font-bold text-lg">No messages yet</p>
            <p className="text-charcoal/60 text-sm mt-1 leading-relaxed max-w-xs mx-auto">
              Start a conversation by visiting a musician or venue profile.
            </p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <p className="text-center text-charcoal/40 text-sm py-10">No conversations match your search</p>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            {filteredConversations.map((conv, idx) => (
              <div
                key={conv.id}
                className="relative group"
                style={{ borderBottom: idx < filteredConversations.length - 1 ? '1px solid rgba(94,94,94,0.07)' : 'none' }}
              >
                <button
                  onClick={() => selectConv(conv.id)}
                  className="w-full px-4 py-4 flex items-center gap-3.5 hover:bg-[#F8F8F8] transition-colors text-left pr-12"
                >
                  {/* Unread indicator */}
                  <div className="relative shrink-0 flex items-center">
                    {conv.unread && (
                      <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-2 bg-chestnut rounded-full" />
                    )}
                    <Avatar src={conv.otherAvatar} className="w-[52px] h-[52px] rounded-full" textSize="text-2xl" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <p className={`text-[15px] truncate ${conv.unread ? 'font-black text-graphite' : 'font-semibold text-graphite'}`}>
                        {conv.otherName}
                      </p>
                      <p className="text-[11px] text-charcoal/40 shrink-0">{formatMessageTime(conv.lastIsoTime)}</p>
                    </div>
                    <p className={`text-[13px] truncate leading-snug ${conv.unread ? 'font-medium text-graphite/80' : 'text-charcoal/55'}`}>
                      {conv.lastMessage.startsWith('__GIG_OFFER__:') ? 'Gig Offer' : (conv.lastMessage || 'Start a conversation')}
                    </p>
                  </div>
                </button>
                {/* Trash icon — visible on hover */}
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirmConvId(conv.id) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-charcoal/25 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Delete confirmation modal (from list) */}
        {deleteConfirmConvId && (
          <DeleteConfirmModal
            convName={conversations.find(c => c.id === deleteConfirmConvId)?.otherName ?? ''}
            deleting={deleting}
            onConfirm={() => handleDeleteThread(deleteConfirmConvId)}
            onCancel={() => setDeleteConfirmConvId(null)}
          />
        )}
      </div>
    )
  }

  // =============================
  // RENDER: Conversation view (fixed full-screen overlay — no browser scrollbar)
  // =============================

  return (
    // Outer shell: fills the screen, shows brand gradient on the sides on wide viewports
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center"
      style={{ background: 'radial-gradient(ellipse 60% 50% at 10% 10%, rgba(108,154,139,0.13), transparent 65%), radial-gradient(ellipse 60% 50% at 90% 90%, rgba(220,127,65,0.15), transparent 65%), #E8E4E0' }}
    >
      {/* Centered conversation column — max 672px so messages aren't spread across a 27" monitor */}
      <div className="w-full max-w-2xl flex flex-col" style={{ boxShadow: '0 0 80px rgba(0,0,0,0.10)' }}>

        {/* Header — dark graphite, no overflow-hidden so dropdown isn't clipped */}
        <div className="shrink-0 relative" style={{ background: '#333333' }}>
          {/* Subtle chestnut glow — decorative only, allowed to bleed */}
          <div className="absolute -top-6 left-16 w-28 h-28 rounded-full bg-chestnut opacity-15 blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-2 px-4 py-3">
            {/* Back arrow — standalone, not part of the profile tap target */}
            <button
              onClick={() => { setSelectedConvId(null); setMenuOpen(false) }}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-snow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Single combined profile button — avatar + name + subtitle */}
            <button onClick={goToProfile} className="flex-1 min-w-0 flex items-center gap-3 text-left group">
              <div className="relative shrink-0">
                <Avatar src={selectedConv?.otherAvatar ?? ''} className="w-10 h-10 rounded-full border-2 border-chestnut/40 group-hover:border-chestnut transition-colors" textSize="text-lg" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-teal rounded-full border-2 border-[#333333]" />
              </div>
              <div className="min-w-0">
                <p className="text-snow font-bold text-sm leading-tight truncate group-hover:text-chestnut transition-colors">
                  {selectedConv?.otherName}
                </p>
                {(selectedConv?.otherUserType || selectedConv?.otherLocation) && (
                  <p className="text-snow/45 text-[11px] truncate capitalize">
                    {[selectedConv.otherUserType, selectedConv.otherLocation].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </button>

            {/* Three dots menu — z-[200] so dropdown floats above messages area */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                <svg className="w-4 h-4 text-snow/60" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-2xl border border-charcoal/[0.08] overflow-hidden z-[200] w-52">
                  <button
                    onClick={goToProfile}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    View Profile
                  </button>
                  <button
                    disabled
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-charcoal/30 flex items-center gap-2.5 cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/></svg>
                    Mute
                    <span className="text-[10px] ml-auto font-normal">Soon</span>
                  </button>
                  <div style={{ borderTop: '1px solid rgba(94,94,94,0.07)' }} />
                  <button
                    onClick={() => { setDeleteConfirmConvId(selectedConvId); setMenuOpen(false) }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Delete Thread
                  </button>
                  <button
                    onClick={() => { setReportConvId(selectedConvId); setMenuOpen(false) }}
                    className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2.5"
                  >
                    <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                    Report
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages area — owns its own scroll, no browser scrollbar */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ background: '#F5F0EC' }}
          onClick={() => { setReactionMsgId(null); setMenuOpen(false) }}
        >
          {/* Empty conversation state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
              <div className="relative">
                <Avatar src={selectedConv?.otherAvatar ?? ''} className="w-24 h-24 rounded-full border-4 border-white shadow-xl" textSize="text-4xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-chestnut rounded-full flex items-center justify-center shadow-md">
                  <svg className="w-4 h-4 text-snow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
              </div>
              <div className="mt-2">
                <p className="text-graphite font-black text-xl">{selectedConv?.otherName}</p>
                {selectedConv?.otherLocation && (
                  <p className="text-charcoal/50 text-xs mt-1 capitalize">{selectedConv.otherLocation}</p>
                )}
              </div>
              <p className="text-charcoal/50 text-sm max-w-[220px] leading-relaxed mt-1">
                This is the beginning of your conversation. Say hello!
              </p>
            </div>
          )}

          {displayItems.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={'d' + idx} className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-charcoal/10" />
                  <span className="text-charcoal/40 text-[11px] font-semibold px-3 py-1 bg-charcoal/[0.06] rounded-full shrink-0">
                    {item.label}
                  </span>
                  <div className="flex-1 h-px bg-charcoal/10" />
                </div>
              )
            }

            const { msg, showAvatar, showTimestamp, isGroupStart } = item
            const isMe = msg.from === 'me'
            const isGigOffer = msg.text.startsWith('__GIG_OFFER__:')
            const gigOfferId = isGigOffer ? msg.text.slice('__GIG_OFFER__:'.length) : null

            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start items-end gap-2'} ${isGroupStart ? 'mt-3' : 'mt-0.5'}`}
              >
                {/* Avatar column for received messages */}
                {!isMe && (
                  <div className="w-7 h-7 shrink-0 mb-1">
                    {showAvatar && (
                      <Avatar src={selectedConv?.otherAvatar ?? ''} className="w-7 h-7 rounded-full" textSize="text-xs" />
                    )}
                  </div>
                )}

                {isGigOffer ? (
                  <GigOfferCard bookingId={gigOfferId!} currentUserType={currentUserType ?? ''} />
                ) : (
                <div className={`relative max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Reaction picker popover */}
                  {reactionMsgId === msg.id && (
                    <div
                      className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-14 z-20 bg-white rounded-2xl shadow-xl px-3 py-2.5 flex gap-2 border border-charcoal/10`}
                      onClick={e => e.stopPropagation()}
                    >
                      {REACTIONS.map(({ emoji, label }) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(msg.id, emoji)}
                          className="flex flex-col items-center gap-0.5 hover:scale-125 transition-transform"
                          title={label}
                        >
                          <ReactionIcon emoji={emoji} size={20} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message bubble */}
                  <div
                    className={`px-4 py-2.5 text-sm shadow-sm cursor-pointer select-none ${
                      isMe
                        ? 'bg-chestnut text-snow rounded-2xl rounded-br-[4px]'
                        : 'bg-white text-graphite rounded-2xl rounded-bl-[4px]'
                    }`}
                    onClick={e => { e.stopPropagation(); setReactionMsgId(reactionMsgId === msg.id ? null : msg.id) }}
                  >
                    <p className="leading-relaxed break-words">{msg.text}</p>
                  </div>

                  {/* Timestamp — only on last message in group */}
                  {showTimestamp && (
                    <p className="text-[10px] mt-1 text-charcoal/40">
                      {formatMessageTime(msg.isoTime)}
                    </p>
                  )}

                  {/* Reactions */}
                  {msg.reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {msg.reactions.map(r => (
                        <button
                          key={r.emoji}
                          onClick={() => handleReaction(msg.id, r.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                            r.userReacted
                              ? 'bg-chestnut/15 text-chestnut border-chestnut/20'
                              : 'bg-white text-charcoal/70 border-charcoal/10 shadow-sm'
                          }`}
                        >
                          <ReactionIcon emoji={r.emoji} size={14} />
                          {r.count > 1 && <span>{r.count}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className="bg-white px-4 py-3 flex items-end gap-2.5 shrink-0"
          style={{ borderTop: '1px solid rgba(94,94,94,0.08)' }}
        >
          {currentUserType === 'restaurant' && selectedConv?.otherUserType === 'musician' && (
            <button
              onClick={() => setGigOfferOpen(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-charcoal/15 text-charcoal hover:text-chestnut hover:border-chestnut transition-colors shrink-0 mb-0.5"
              title="Send a gig offer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={e => {
              setChatInput(e.target.value)
              const ta = textareaRef.current
              if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 96) + 'px' }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
            }}
            placeholder={`Message ${selectedConv?.otherName ?? ''}…`}
            rows={1}
            className="flex-1 bg-[#F5F0EC] rounded-[20px] px-5 py-2.5 text-sm focus:outline-none resize-none placeholder:text-charcoal/40 leading-relaxed"
            style={{ maxHeight: '96px', overflowY: 'auto' }}
          />
          <button
            onClick={handleSend}
            disabled={!chatInput.trim()}
            className="w-10 h-10 bg-chestnut rounded-full flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-30 mb-0.5"
          >
            <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

        {/* Gig slot modal */}
        {gigOfferOpen && selectedConv && (
          <GigSlotModal
            userId={userId}
            musicianId={selectedConv.otherId}
            musicianName={selectedConv.otherName}
            onClose={() => setGigOfferOpen(false)}
            onSend={(bookingId) => {
              setGigOfferOpen(false)
              void sendGigOffer(bookingId)
            }}
          />
        )}

        {/* Delete confirmation modal */}
        {deleteConfirmConvId && (
          <DeleteConfirmModal
            convName={conversations.find(c => c.id === deleteConfirmConvId)?.otherName ?? ''}
            deleting={deleting}
            onConfirm={() => handleDeleteThread(deleteConfirmConvId)}
            onCancel={() => setDeleteConfirmConvId(null)}
          />
        )}

        {/* Report modal */}
        {reportConvId && (
          <ReportModal
            convName={conversations.find(c => c.id === reportConvId)?.otherName ?? ''}
            reason={reportReason}
            details={reportDetails}
            reporting={reporting}
            onReason={setReportReason}
            onDetails={setReportDetails}
            onSubmit={handleReport}
            onCancel={() => { setReportConvId(null); setReportReason(''); setReportDetails('') }}
          />
        )}

      </div>
    </div>
  )
})

export default MessagingTab

// ---- Time helper ----

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ---- Gig Offer Card ----

function GigOfferCard({ bookingId, currentUserType }: {
  bookingId: string
  currentUserType: string
}) {
  const [booking, setBooking] = useState<{
    date: string
    time: string
    pay: number
    inviteAccepted: boolean | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('bookings')
        .select('pay_amount, invite_accepted, availability:availability_id(date, start_time, end_time)')
        .eq('id', bookingId)
        .maybeSingle()
      if (data) {
        const avRaw = data.availability
        const av = (Array.isArray(avRaw) ? avRaw[0] : avRaw) as Record<string, string> | null
        const rawStart = av?.start_time?.slice(0, 5) ?? ''
        const rawEnd = av?.end_time?.slice(0, 5) ?? ''
        setBooking({
          date: av?.date ? new Date(av.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—',
          time: rawStart && rawEnd ? `${fmtTime(rawStart)} – ${fmtTime(rawEnd)}` : '—',
          pay: Number(data.pay_amount) || 0,
          inviteAccepted: data.invite_accepted as boolean | null,
        })
      }
      setLoading(false)
    }
    void load()
  }, [bookingId])

  const handleRespond = async (response: 'accept' | 'decline') => {
    setResponding(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/bookings/respond-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ booking_id: bookingId, response }),
      })
      if (res.ok) {
        setBooking(prev => prev ? { ...prev, inviteAccepted: response === 'accept' ? true : false } : null)
      }
    } finally {
      setResponding(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-chestnut/5 border border-chestnut/15 rounded-2xl p-4 max-w-[260px] animate-pulse">
        <div className="h-4 bg-chestnut/20 rounded mb-2 w-3/4" />
        <div className="h-3 bg-charcoal/10 rounded mb-1.5 w-full" />
        <div className="h-3 bg-charcoal/10 rounded w-2/3" />
      </div>
    )
  }
  if (!booking) return null

  const responded = booking.inviteAccepted !== null

  return (
    <div className="bg-chestnut/5 border border-chestnut/20 rounded-2xl p-4 max-w-[260px]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 bg-chestnut/15 rounded-xl flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
        </div>
        <div>
          <p className="text-chestnut text-[9px] font-black uppercase tracking-[0.2em]">Private Invite</p>
          <p className="text-graphite text-sm font-bold leading-tight">Gig Offer</p>
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-charcoal/60">Date</span>
          <span className="text-graphite font-semibold">{booking.date}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-charcoal/60">Time</span>
          <span className="text-graphite font-semibold">{booking.time}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-charcoal/60">Pay</span>
          <span className="text-teal font-black">${booking.pay}</span>
        </div>
      </div>
      {currentUserType === 'musician' && !responded && (
        <div className="flex gap-2">
          <button
            onClick={() => handleRespond('accept')}
            disabled={responding}
            className="flex-1 bg-teal text-snow py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => handleRespond('decline')}
            disabled={responding}
            className="flex-1 bg-snow text-charcoal py-2 rounded-xl text-xs font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
      {currentUserType === 'restaurant' && !responded && (
        <p className="text-center text-xs text-charcoal/50">Waiting for musician to respond</p>
      )}
      {responded && (
        <div className={`text-center text-xs font-bold py-1.5 rounded-xl ${booking.inviteAccepted ? 'bg-teal/10 text-teal' : 'bg-charcoal/10 text-charcoal/60'}`}>
          {booking.inviteAccepted ? 'Accepted — awaiting payment' : 'Declined'}
        </div>
      )}
    </div>
  )
}

// ---- Slot picker helpers (mirrors RestaurantDashboard) ----

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = (i % 2) * 30
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return {
    label: `${hour12}:${m.toString().padStart(2, '0')} ${period}`,
    value: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
  }
})

function getDateOptions() {
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

function StyledSelect({ value, onChange, options, placeholder, className = '' }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full appearance-none bg-white rounded-xl px-4 py-3 pr-10 shadow-sm border border-charcoal/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-chestnut/20 cursor-pointer ${value ? 'text-graphite' : 'text-charcoal/40'}`}
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

// ---- Gig Slot Modal ----

function GigSlotModal({ userId, musicianId, musicianName, onClose, onSend }: {
  userId: string
  musicianId: string
  musicianName: string
  onClose: () => void
  onSend: (bookingId: string) => void
}) {
  const [mode, setMode] = useState<'pick' | 'create'>('pick')
  const [slots, setSlots] = useState<{ id: string; dateLabel: string; time: string; pay: number }[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [pay, setPay] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('availability')
        .select('id, date, start_time, end_time, pay')
        .eq('restaurant_id', userId)
        .eq('status', 'open')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(20)
      if (data) {
        setSlots(data.map(s => {
          const rawStart = s.start_time?.slice(0, 5) ?? ''
          const rawEnd = s.end_time?.slice(0, 5) ?? ''
          return {
            id: s.id,
            dateLabel: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            time: rawStart && rawEnd ? `${fmtTime(rawStart)} – ${fmtTime(rawEnd)}` : '—',
            pay: Number(s.pay) || 0,
          }
        }))
      }
      setSlotsLoading(false)
    }
    void load()
  }, [userId])

  const handleSubmit = async () => {
    setError('')
    if (mode === 'pick' && !selectedSlotId) { setError('Select a slot.'); return }
    if (mode === 'create') {
      if (!date) { setError('Enter a date.'); return }
      if (!startTime) { setError('Enter a start time.'); return }
      if (!endTime) { setError('Enter an end time.'); return }
      if (!pay || isNaN(Number(pay)) || Number(pay) <= 0) { setError('Enter a valid pay amount.'); return }
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const body = mode === 'pick'
        ? { musician_id: musicianId, availability_id: selectedSlotId, note: note.trim() || undefined }
        : { musician_id: musicianId, date, start_time: startTime, end_time: endTime, pay: Number(pay), note: note.trim() || undefined }
      const res = await fetch('/api/bookings/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { booking_id?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')
      onSend(data.booking_id!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-4">
      <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Gig Offer</p>
            <h3 className="text-snow text-xl font-black tracking-tight">Send to <span className="text-chestnut italic">{musicianName.split(' ')[0]}.</span></h3>
          </div>
          <button onClick={onClose} className="relative z-10 text-snow/60 hover:text-snow transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="p-6">
          <div className="flex bg-white rounded-xl p-1 mb-5 shadow-sm">
            <button onClick={() => setMode('pick')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'pick' ? 'bg-chestnut text-snow shadow-sm' : 'text-charcoal hover:text-graphite'}`}>Existing Slot</button>
            <button onClick={() => setMode('create')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'create' ? 'bg-chestnut text-snow shadow-sm' : 'text-charcoal hover:text-graphite'}`}>New Slot</button>
          </div>

          {mode === 'pick' && (
            <div className="mb-4">
              {slotsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-charcoal/60 text-sm mb-2">No open slots available.</p>
                  <button onClick={() => setMode('create')} className="text-chestnut text-sm font-bold hover:opacity-80 transition-opacity">Create a new slot instead →</button>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {slots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${selectedSlotId === slot.id ? 'border-chestnut bg-chestnut/5' : 'border-transparent bg-white hover:border-charcoal/20'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-graphite text-sm font-bold">{slot.dateLabel}</p>
                          <p className="text-charcoal text-xs mt-0.5">{slot.time}</p>
                        </div>
                        <p className="text-teal font-black text-sm">${slot.pay}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'create' && (
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Date</label>
                <StyledSelect
                  value={date}
                  onChange={setDate}
                  options={getDateOptions()}
                  placeholder="Pick a date"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Start</label>
                  <StyledSelect
                    value={startTime}
                    onChange={setStartTime}
                    options={TIME_OPTIONS}
                    placeholder="Start time"
                  />
                </div>
                <div>
                  <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">End</label>
                  <StyledSelect
                    value={endTime}
                    onChange={setEndTime}
                    options={TIME_OPTIONS}
                    placeholder="End time"
                  />
                </div>
              </div>
              <div>
                <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Pay ($)</label>
                <input type="number" min="0" step="1" placeholder="e.g. 200" value={pay} onChange={e => setPay(e.target.value)} className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm border border-charcoal/10 focus:outline-none focus:ring-2 focus:ring-chestnut/20" />
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Note <span className="font-normal normal-case text-charcoal/50">(optional)</span></label>
            <textarea placeholder={`A note for ${musicianName.split(' ')[0]}…`} value={note} onChange={e => setNote(e.target.value)} rows={2} className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:shadow-md transition-shadow resize-none placeholder:text-charcoal/40" />
          </div>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={submitting || (mode === 'pick' && !selectedSlotId && slots.length > 0)}
            className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-2"
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2"><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Sending…</span>
              : `Send Offer to ${musicianName.split(' ')[0]}`}
          </button>
          <button onClick={onClose} disabled={submitting} className="w-full bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---- Delete Confirmation Modal ----

function DeleteConfirmModal({ convName, deleting, onConfirm, onCancel }: {
  convName: string
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-graphite/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-snow w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <h3 className="text-graphite text-lg font-black mb-2">Delete conversation?</h3>
          <p className="text-charcoal text-sm leading-relaxed mb-6">
            This will permanently remove all messages between you and{' '}
            <strong>{convName}</strong>. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 bg-white text-charcoal py-3 rounded-xl text-sm font-semibold border border-charcoal/15 hover:bg-[#E8E4E0] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={deleting}
              className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Report Modal ----

function ReportModal({ convName, reason, details, reporting, onReason, onDetails, onSubmit, onCancel }: {
  convName: string
  reason: string
  details: string
  reporting: boolean
  onReason: (r: string) => void
  onDetails: (d: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-graphite/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-snow w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Report User</p>
            <h3 className="text-snow text-xl font-black">{convName}</h3>
          </div>
          <button onClick={onCancel} className="text-snow/60 hover:text-snow transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6">
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-3">Reason</p>
          <div className="space-y-2 mb-4">
            {REPORT_REASONS.map(r => (
              <button
                key={r}
                onClick={() => onReason(r)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-left transition-colors border ${
                  reason === r
                    ? 'bg-chestnut text-snow border-chestnut'
                    : 'bg-white text-charcoal border-charcoal/10 hover:bg-[#E8E4E0]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
            Additional details <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
          </p>
          <textarea
            value={details}
            onChange={e => onDetails(e.target.value)}
            rows={3}
            placeholder="Tell us more…"
            className="w-full bg-white rounded-xl px-4 py-3 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10 mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!reason || reporting}
              className="flex-1 bg-chestnut text-snow py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {reporting ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
