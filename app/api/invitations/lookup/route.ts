import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'

// Public, unauthenticated lookup so the /join landing page can show who invited the
// visitor before they have an account. Service-role read; returns only safe fields.
export async function GET(request: Request) {
  const rl = await checkRateLimit(request, standardLimiter)
  if (rl.limited) return rl.response!

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const token = new URL(request.url).searchParams.get('token')
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const { data: invite } = await supabaseAdmin
      .from('invitations')
      .select('inviter_id, invitee_name, invited_role, status')
      .eq('token', token)
      .maybeSingle()

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

    const { data: inviter } = await supabaseAdmin
      .from('profiles')
      .select('full_name, avatar_url, role_metadata')
      .eq('id', invite.inviter_id)
      .maybeSingle()

    const meta = (inviter?.role_metadata ?? {}) as Record<string, unknown>
    const inviterName = (meta.venue_name as string | undefined) ?? inviter?.full_name ?? 'A Drum Up member'

    return NextResponse.json({
      inviter_name: inviterName,
      inviter_avatar: inviter?.avatar_url ?? null,
      invitee_name: invite.invitee_name ?? null,
      invited_role: invite.invited_role,
      status: invite.status,
    })
  } catch (err) {
    console.error('[invitations/lookup] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
