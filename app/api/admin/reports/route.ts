// SQL MIGRATION — run once in Supabase SQL editor:
//
// ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved boolean NOT NULL DEFAULT false;
//
// (No RLS changes needed — this is only accessed via the service role key.)

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = adminClient()

  const { data: reports, error } = await supabase
    .from('reports')
    .select('id, reason, details, created_at, resolved, reporter_id, reported_id, conversation_id')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({ reports: [] })
  }

  const profileIds = [...new Set([
    ...reports.map(r => r.reporter_id),
    ...reports.map(r => r.reported_id),
  ].filter(Boolean))]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, full_name')
    .in('id', profileIds)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const enriched = reports.map(r => ({
    id: r.id,
    reason: r.reason,
    details: r.details,
    created_at: r.created_at,
    resolved: r.resolved ?? false,
    conversation_id: r.conversation_id,
    reporter_username: profileMap.get(r.reporter_id)?.username ?? '',
    reporter_name: profileMap.get(r.reporter_id)?.full_name ?? '—',
    reported_username: profileMap.get(r.reported_id)?.username ?? '',
    reported_name: profileMap.get(r.reported_id)?.full_name ?? '—',
  }))

  return NextResponse.json({ reports: enriched })
}

export async function POST(request: Request) {
  const supabase = adminClient()

  try {
    const { reportId } = await request.json()
    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('reports')
      .update({ resolved: true })
      .eq('id', reportId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
