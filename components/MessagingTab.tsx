'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'

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
  lastMessage: string
  lastIsoTime: string
  unread: boolean
}

export interface MessagingTabRef {
  openWith: (otherId: string, name: string, avatar: string) => void
}

// ---- Constants ----

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👏', '🔥']

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

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function fmtConvTime(iso: string): string {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString())
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dateSep(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

type DisplayItem = { type: 'date'; label: string } | { type: 'message'; msg: Message }

function buildDisplayItems(messages: Message[]): DisplayItem[] {
  return messages.reduce<DisplayItem[]>((acc, msg, i) => {
    const prev = messages[i - 1]
    if (!prev || new Date(msg.isoTime).toDateString() !== new Date(prev.isoTime).toDateString()) {
      acc.push({ type: 'date', label: dateSep(msg.isoTime) })
    }
    acc.push({ type: 'message', msg })
    return acc
  }, [])
}

// ---- Main Component ----

interface Props {
  userId: string
  onUnreadChange?: (n: number) => void
}

const MessagingTab = forwardRef<MessagingTabRef, Props>(function MessagingTab({ userId, onUnreadChange }, ref) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messagesByConv, setMessagesByConv] = useState<Map<string, Message[]>>(new Map())
  const [chatInput, setChatInput] = useState('')
  const [reactionMsgId, setReactionMsgId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  const selectedConv = conversations.find(c => c.id === selectedConvId) ?? null
  const messages = selectedConvId ? (messagesByConv.get(selectedConvId) ?? []) : []
  const displayItems = buildDisplayItems(messages)

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
      .from('profiles').select('id, full_name, avatar_url, role_metadata').in('id', [...otherIds])
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
        lastMessage: last.content,
        lastIsoTime: last.created_at,
        unread: ms.some(m => m.receiver_id === uid && !m.read),
      })
    })
    convs.sort((a, b) => b.lastIsoTime.localeCompare(a.lastIsoTime))
    setConversations(convs)
    onUnreadChange?.(convs.filter(c => c.unread).length)
  }, [onUnreadChange])

  // ---- Load messages for a conv ----

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
    } catch { /* table may not exist yet */ }

    setMessagesByConv(prev => { const map = new Map(prev); map.set(convId, mapped); return map })
  }, [])

  // ---- Open conversation with another user (via ref) ----

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
    setConversations(prev => {
      if (prev.find(c => c.id === convId)) return prev
      return [{
        id: convId, otherId, otherName: name, otherAvatar: avatar,
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

  // ---- Effects ----

  useEffect(() => {
    if (userId) loadConversations()
  }, [userId, loadConversations])

  // Check sessionStorage for pending open (from profile page Message button)
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

  // Real-time: new messages in selected conversation
  useEffect(() => {
    const uid = userIdRef.current
    if (!uid || !selectedConvId) return
    const sub = supabase
      .channel(`msg-tab-${selectedConvId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConvId}` }, payload => {
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedConvId])

  // ---- Send ----

  const handleSend = async () => {
    const uid = userIdRef.current
    if (!chatInput.trim() || !selectedConvId || !uid || !selectedConv) return
    const text = chatInput.trim()
    setChatInput('')
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
  }

  // ---- React ----

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
        if (gi !== -1) { const g = { ...rxns[gi], count: rxns[gi].count - 1, userReacted: false }; if (g.count <= 0) rxns.splice(gi, 1); else rxns[gi] = g }
      } else {
        if (gi !== -1) rxns[gi] = { ...rxns[gi], count: rxns[gi].count + 1, userReacted: true }
        else rxns.push({ emoji, count: 1, userReacted: true })
      }
      u.reactions = rxns; ms[idx] = u; map.set(selectedConvId, ms); return map
    })
  }

  // ---- Render: Conversation List ----

  if (!selectedConvId) {
    return (
      <div>
        <p className="text-graphite text-3xl font-black tracking-tight mb-6">
          Your <span className="text-chestnut italic">Messages.</span>
        </p>
        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-chestnut/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">💬</div>
            <p className="text-graphite font-bold text-lg">No messages yet</p>
            <p className="text-charcoal/60 text-sm mt-1 leading-relaxed max-w-xs mx-auto">
              Browse profiles and tap Message to start a conversation.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm divide-y divide-charcoal/[0.06]">
            {conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConv(conv.id)}
                className="w-full px-4 py-4 flex items-center gap-4 hover:bg-snow/80 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <Avatar src={conv.otherAvatar} className="w-14 h-14 rounded-full" textSize="text-2xl" />
                  {conv.unread && (
                    <span className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 bg-chestnut rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className={`text-sm truncate ${conv.unread ? 'font-black text-graphite' : 'font-semibold text-graphite'}`}>
                      {conv.otherName}
                    </p>
                    <p className="text-[11px] text-charcoal/40 shrink-0">{fmtConvTime(conv.lastIsoTime)}</p>
                  </div>
                  <p className={`text-xs truncate ${conv.unread ? 'font-medium text-graphite' : 'text-charcoal/55'}`}>
                    {conv.lastMessage || 'Start a conversation'}
                  </p>
                </div>
                <svg className="w-3.5 h-3.5 text-charcoal/25 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ---- Render: Conversation View ----

  return (
    <div className="-mx-4 -mt-5 flex flex-col" style={{ height: 'calc(100vh - 130px)' }}>

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-charcoal/[0.08] shadow-sm shrink-0">
        <button
          onClick={() => setSelectedConvId(null)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-snow transition-colors shrink-0"
        >
          <svg className="w-4 h-4 text-charcoal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={() => router.push('/profile/' + selectedConv?.otherId)} className="shrink-0">
          <Avatar src={selectedConv?.otherAvatar ?? ''} className="w-10 h-10 rounded-full" textSize="text-lg" />
        </button>
        <button
          onClick={() => router.push('/profile/' + selectedConv?.otherId)}
          className="flex-1 min-w-0 text-left"
        >
          <p className="text-graphite font-bold text-sm leading-tight truncate hover:text-chestnut transition-colors">
            {selectedConv?.otherName}
          </p>
          <p className="text-charcoal/40 text-[11px]">Tap to view profile</p>
        </button>
        <button
          onClick={() => router.push('/profile/' + selectedConv?.otherId)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-snow transition-colors text-charcoal/40 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="5" r="1" fill="currentColor" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
            <circle cx="12" cy="19" r="1" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ background: '#F5F0EC' }}
        onClick={() => setReactionMsgId(null)}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-12">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-3xl">👋</div>
            <p className="text-graphite font-bold">Say hello!</p>
            <p className="text-charcoal/60 text-sm max-w-[200px] leading-relaxed">
              Start a conversation with {selectedConv?.otherName}
            </p>
          </div>
        )}

        {displayItems.map((item, idx) => {
          if (item.type === 'date') {
            return (
              <div key={'d' + idx} className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-charcoal/10" />
                <span className="text-charcoal/40 text-[11px] font-medium shrink-0">{item.label}</span>
                <div className="flex-1 h-px bg-charcoal/10" />
              </div>
            )
          }
          const msg = item.msg
          const isMe = msg.from === 'me'
          return (
            <div key={msg.id} className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start items-end gap-2'}`}>
              {!isMe && (
                <Avatar
                  src={selectedConv?.otherAvatar ?? ''}
                  className="w-8 h-8 rounded-full shrink-0 mb-1"
                  textSize="text-xs"
                />
              )}
              <div className={`relative max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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

                {/* Bubble */}
                <div
                  className={`px-4 py-2.5 text-sm shadow-sm cursor-pointer select-none ${
                    isMe
                      ? 'bg-chestnut text-snow rounded-2xl rounded-br-sm'
                      : 'bg-white text-graphite rounded-2xl rounded-bl-sm'
                  }`}
                  onClick={e => { e.stopPropagation(); setReactionMsgId(reactionMsgId === msg.id ? null : msg.id) }}
                >
                  <p className="leading-relaxed break-words">{msg.text}</p>
                  <p className={`text-[10px] mt-0.5 ${isMe ? 'text-snow/50 text-right' : 'text-charcoal/40'}`}>
                    {fmtTime(msg.isoTime)}
                  </p>
                </div>

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

      {/* Input */}
      <div className="bg-white border-t border-charcoal/[0.08] px-4 py-3 flex items-center gap-2.5 shrink-0">
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Message..."
          className="flex-1 bg-[#F5F0EC] rounded-full px-5 py-2.5 text-sm focus:outline-none transition-shadow placeholder:text-charcoal/40"
        />
        <button
          onClick={handleSend}
          disabled={!chatInput.trim()}
          className="w-10 h-10 bg-chestnut rounded-full flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-30"
        >
          <svg className="w-4 h-4 text-white rotate-90" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
})

export default MessagingTab
