import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { InviteEmail } from '@/emails/InviteEmail'
import { checkRateLimit, strictLimiter } from '@/lib/ratelimit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, strictLimiter)
  if (rl.limited) return rl.response!

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json() as {
      invitee_name?: string
      invitee_email?: string
      invited_role?: string
    }
    const inviteeName = (body.invitee_name ?? '').trim()
    const inviteeEmail = (body.invitee_email ?? '').trim().toLowerCase()
    const invitedRole = body.invited_role

    if (!EMAIL_RE.test(inviteeEmail)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (invitedRole !== 'restaurant' && invitedRole !== 'musician') {
      return NextResponse.json({ error: 'Invalid invite role.' }, { status: 400 })
    }

    // Inviter's display name for the email.
    const { data: inviter } = await supabaseAdmin
      .from('profiles')
      .select('full_name, role_metadata')
      .eq('id', user.id)
      .maybeSingle()
    const inviterMeta = (inviter?.role_metadata ?? {}) as Record<string, unknown>
    const inviterName = (inviterMeta.venue_name as string | undefined) ?? inviter?.full_name ?? 'A Drum Up member'

    // Don't reveal whether the email already has an account — but skip re-sending
    // if this inviter already has a pending invite to the same address.
    const { data: existing } = await supabaseAdmin
      .from('invitations')
      .select('id, token, status')
      .eq('inviter_id', user.id)
      .eq('invitee_email', inviteeEmail)
      .eq('status', 'pending')
      .maybeSingle()

    let inviteToken = existing?.token as string | undefined

    if (!existing) {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from('invitations')
        .insert({
          inviter_id: user.id,
          invitee_email: inviteeEmail,
          invitee_name: inviteeName || null,
          invited_role: invitedRole,
        })
        .select('token')
        .single()
      if (insErr) throw insErr
      inviteToken = inserted.token as string
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'
    const joinUrl = `${appUrl}/join?invite=${inviteToken}`

    await sendEmail({
      to: inviteeEmail,
      subject: `${inviterName} invited you to join Drum Up`,
      emailComponent: (
        <InviteEmail
          inviterName={inviterName}
          inviteeName={inviteeName || undefined}
          invitedRole={invitedRole}
          joinUrl={joinUrl}
        />
      ),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[invitations/send] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
