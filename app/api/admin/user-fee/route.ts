import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Admin-only: set or clear a user's platform-fee override. Guarded by middleware.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(request: Request) {
  const supabase = adminClient()
  try {
    const { userId, pct, waiverUntil } = await request.json() as {
      userId: string
      pct: number | null          // null = reset to default 8%
      waiverUntil: string | null  // ISO date or null = no expiry
    }
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    if (pct != null && (typeof pct !== 'number' || pct < 0 || pct > 100)) {
      return NextResponse.json({ error: 'pct must be between 0 and 100' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        platform_fee_pct: pct,                       // null clears the override
        fee_waiver_until: pct == null ? null : waiverUntil,
      })
      .eq('id', userId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
