import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin-only: read the audit trail of privileged actions. Guarded by middleware.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = adminClient()

  const { data, error } = await supabase
    .from('admin_actions')
    .select('id, created_at, actor, action, target_type, target_id, summary, metadata')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ actions: data ?? [] })
}
