// SQL MIGRATION — run once in Supabase SQL editor:
//
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
//
// (No RLS changes needed — this is only accessed via the service role key.)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logAdminAction } from '@/lib/admin-audit'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, user_type, created_at, is_banned, location_text, stripe_onboarded')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = adminClient()

  try {
    const { userId, ban } = await request.json()
    if (!userId || typeof ban !== 'boolean') {
      return NextResponse.json({ error: 'userId and ban (boolean) are required' }, { status: 400 })
    }

    const { data: target } = await supabase.from('profiles').select('username, full_name').eq('id', userId).maybeSingle()

    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: ban })
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAdminAction({
      action: ban ? 'ban_user' : 'unban_user',
      target_type: 'user',
      target_id: userId,
      summary: `${ban ? 'Banned' : 'Unbanned'} ${target?.full_name || '@' + (target?.username ?? userId)}`,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
