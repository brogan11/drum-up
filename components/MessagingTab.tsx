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

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👏', '🔥']
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
  onUnreadChange?: (n: number) => void
}

const MessagingTab = forwardRef<MessagingTabRef, Props>(function MessagingTab({ userId, onUnreadChange }, ref) {
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
    setConversations(prev => {
      const updated = prev.map(c => c.id === convId ? { ...c, unread: false } : c)
      onUnreadChange?.(updated.filter(c => c.unread).length)
      return updated
    })
  }

  // ---- Delete thread ----

  const handleDeleteThread = async (convId: string) => {
    const uid = userIdRef.current
    setDeleting(true)
    try {
      await supabase.from('messages').delete()
        .eq('conversation_id', convId)
        .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
      setConversations(prev => {
        const updated = prev.filter(c => c.id !== convId)
        onUnreadChange?.(updated.filter(c => c.unread).length)
        return updated
      })
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
          c.id === selectedConvId ? { ...c, lastMessage: m.content, lastIsoTime: m.created_at } : c
        ))
      })
      .subscribe()
    return () => { void supabase.removeChannel(sub) }
  }, [selectedConvId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedConvId])

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
            <div className="w-16 h-16 bg-chestnut/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💬</div>
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
                      {conv.lastMessage || 'Start a conversation'}
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
  // RENDER: Conversation view
  // =============================

  return (
    <div className="-mx-4 -mt-5 flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 shadow-sm shrink-0 relative"
        style={{ borderBottom: '1px solid rgba(94,94,94,0.08)' }}>
        {/* Back arrow */}
        <button
          onClick={() => { setSelectedConvId(null); setMenuOpen(false) }}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-snow transition-colors shrink-0"
        >
          <svg className="w-4 h-4 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Avatar — navigates to profile */}
        <button onClick={goToProfile} className="shrink-0">
          <Avatar src={selectedConv?.otherAvatar ?? ''} className="w-10 h-10 rounded-full" textSize="text-lg" />
        </button>

        {/* Name + subtitle — navigates to profile */}
        <button onClick={goToProfile} className="flex-1 min-w-0 text-left">
          <p className="text-graphite font-bold text-sm leading-tight truncate hover:text-chestnut transition-colors">
            {selectedConv?.otherName}
          </p>
          {(selectedConv?.otherUserType || selectedConv?.otherLocation) && (
            <p className="text-charcoal/45 text-[11px] truncate capitalize">
              {[selectedConv.otherUserType, selectedConv.otherLocation].filter(Boolean).join(' · ')}
            </p>
          )}
        </button>

        {/* Three dots menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-snow transition-colors"
          >
            <svg className="w-4 h-4 text-charcoal/50" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 bg-white rounded-2xl shadow-xl border border-charcoal/[0.08] overflow-hidden z-30 w-52">
              <button
                onClick={goToProfile}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2.5"
              >
                <span>👤</span> View Profile
              </button>
              <button
                disabled
                className="w-full px-4 py-3 text-left text-sm font-semibold text-charcoal/30 flex items-center gap-2.5 cursor-not-allowed"
              >
                <span>🔇</span> Mute
                <span className="text-[10px] ml-auto font-normal">Soon</span>
              </button>
              <div style={{ borderTop: '1px solid rgba(94,94,94,0.07)' }} />
              <button
                onClick={() => { setDeleteConfirmConvId(selectedConvId); setMenuOpen(false) }}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2.5"
              >
                <span>🗑</span> Delete Thread
              </button>
              <button
                onClick={() => { setReportConvId(selectedConvId); setMenuOpen(false) }}
                className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2.5"
              >
                <span>🚩</span> Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ background: '#F5F0EC' }}
        onClick={() => { setReactionMsgId(null); setMenuOpen(false) }}
      >
        {/* Empty conversation state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <Avatar src={selectedConv?.otherAvatar ?? ''} className="w-20 h-20 rounded-full mb-2" textSize="text-3xl" />
            <p className="text-graphite font-bold text-lg">{selectedConv?.otherName}</p>
            <p className="text-charcoal/50 text-sm max-w-[200px] leading-relaxed">
              Start a conversation — say hello!
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

              <div className={`relative max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Reaction picker popover */}
                {reactionMsgId === msg.id && (
                  <div
                    className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-14 z-20 bg-white rounded-2xl shadow-xl px-3 py-2.5 flex gap-2.5 border border-charcoal/10`}
                    onClick={e => e.stopPropagation()}
                  >
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className="text-xl hover:scale-125 transition-transform leading-none"
                      >
                        {emoji}
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
                        className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                          r.userReacted
                            ? 'bg-chestnut/15 text-chestnut border-chestnut/20'
                            : 'bg-white text-charcoal/70 border-charcoal/10 shadow-sm'
                        }`}
                      >
                        <span>{r.emoji}</span>
                        {r.count > 1 && <span className="ml-0.5">{r.count}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
  )
})

export default MessagingTab

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
          <button onClick={onCancel} className="text-snow/60 hover:text-snow transition-colors text-xl">✕</button>
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
