import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { InviteAcceptedEmail } from '@/emails/InviteAcceptedEmail'
import { checkRateLimit, standardLimiter } from '@/lib/ratelimit'

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, standardLimiter)
  if (rl.limited) return rl.response!

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const authHeader = request.headers.get('authorization') ?? ''
    const authToken = authHeader.replace('Bearer ', '')
    if (!authToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(authToken)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token } = await request.json() as { token?: string }
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

    const { data: invite } = await supabaseAdmin
      .from('invitations')
      .select('id, inviter_id, status')
      .eq('token', token)
      .maybeSingle()

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

    // Already accepted, or the inviter clicked their own link — idempotent no-op.
    if (invite.status === 'accepted' || invite.inviter_id === user.id) {
      return NextResponse.json({ success: true, alreadyHandled: true })
    }

    await supabaseAdmin
      .from('invitations')
      .update({ status: 'accepted', accepted_by: user.id, accepted_at: new Date().toISOString() })
      .eq('id', invite.id)
      .eq('status', 'pending')

    // Auto-connect both parties (mutual follow), skipping any that already exist.
    const pairs = [
      { follower_id: invite.inviter_id, following_id: user.id },
      { follower_id: user.id, following_id: invite.inviter_id },
    ]
    for (const pair of pairs) {
      const { data: exists } = await supabaseAdmin
        .from('follows')
        .select('id')
        .eq('follower_id', pair.follower_id)
        .eq('following_id', pair.following_id)
        .maybeSingle()
      if (!exists) await supabaseAdmin.from('follows').insert(pair)
    }

    // New member's display name for the inviter's notification/email.
    const { data: newMember } = await supabaseAdmin
      .from('profiles')
      .select('full_name, username, role_metadata')
      .eq('id', user.id)
      .maybeSingle()
    const memberMeta = (newMember?.role_metadata ?? {}) as Record<string, unknown>
    const memberName = (memberMeta.venue_name as string | undefined) ?? newMember?.full_name ?? 'Someone you invited'
    const memberLink = `/profile/${newMember?.username ?? user.id}`

    await supabaseAdmin.from('notifications').insert({
      user_id: invite.inviter_id,
      type: 'invite_accepted',
      title: `${memberName} joined from your invite`,
      body: 'You’re now connected on Drum Up.',
      link: memberLink,
    })

    // Email the inviter (best-effort).
    const { data: { user: inviterAuth } } = await supabaseAdmin.auth.admin.getUserById(invite.inviter_id)
    const { data: inviter } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role_metadata')
      .eq('id', invite.inviter_id)
      .maybeSingle()
    const inviterMeta = (inviter?.role_metadata ?? {}) as Record<string, unknown>
    const inviterName = (inviterMeta.venue_name as string | undefined) ?? inviter?.full_name ?? 'there'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    if (inviterAuth?.email) {
      await sendEmail({
        to: inviterAuth.email,
        subject: `${memberName} joined Drum Up from your invite`,
        emailComponent: (
          <InviteAcceptedEmail
            inviterName={inviterName}
            memberName={memberName}
            profileUrl={`${appUrl}${memberLink}`}
          />
        ),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[invitations/accept] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
