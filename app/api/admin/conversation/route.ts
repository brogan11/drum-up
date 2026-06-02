import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin-only: read a reported conversation thread to judge a report.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET(request: Request) {
  const supabase = adminClient()
  const conversationId = new URL(request.url).searchParams.get('id')
  if (!conversationId) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { data: messages, error } = await supabase
    .from('messages')
    .select('id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const senderIds = [...new Set((messages ?? []).map(m => m.sender_id).filter(Boolean))]
  const { data: profiles } = senderIds.length
    ? await supabase.from('profiles').select('id, full_name, username').in('id', senderIds)
    : { data: [] as { id: string; full_name: string | null; username: string | null }[] }
  const pMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const enriched = (messages ?? []).map(m => ({
    id: m.id,
    content: m.content,
    created_at: m.created_at,
    sender_name: pMap.get(m.sender_id)?.full_name ?? '—',
    sender_username: pMap.get(m.sender_id)?.username ?? '',
  }))

  return NextResponse.json({ messages: enriched })
}
