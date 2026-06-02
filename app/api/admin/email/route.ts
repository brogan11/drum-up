import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { AdminMessageEmail } from '@/emails/AdminMessageEmail'
import { logAdminAction } from '@/lib/admin-audit'

// Admin-only: send a one-off message to one or more users. Guarded by middleware.
// Emails (addresses) live in auth.users, so we resolve each via the auth admin API.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

const MAX_RECIPIENTS = 500

export async function POST(request: Request) {
  const supabase = adminClient()
  try {
    const { userIds, subject, message, ctaUrl, ctaLabel } = await request.json() as {
      userIds: string[]; subject: string; message: string; ctaUrl?: string; ctaLabel?: string
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds must be a non-empty array' }, { status: 400 })
    }
    if (userIds.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Too many recipients (max ${MAX_RECIPIENTS})` }, { status: 400 })
    }
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'subject and message are required' }, { status: 400 })
    }

    // Pull display names in one query for the greeting.
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, username').in('id', userIds)
    const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name || (p.username ? '@' + p.username : 'there')]))

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://drum-up.app'
    let sent = 0
    const failed: string[] = []

    for (const id of userIds) {
      try {
        const { data: { user } } = await supabase.auth.admin.getUserById(id)
        const email = user?.email
        if (!email) { failed.push(id); continue }
        const res = await sendEmail({
          to: email,
          subject: subject.trim(),
          emailComponent: AdminMessageEmail({
            recipientName: nameMap.get(id) ?? 'there',
            heading: subject.trim(),
            body: message.trim(),
            ctaUrl: ctaUrl?.trim() || `${appUrl}/dashboard`,
            ctaLabel: ctaLabel?.trim() || 'Open Drum Up →',
          }),
        })
        if (res.success) sent++; else failed.push(id)
      } catch (err) {
        console.error('[Admin email] failed for', id, err)
        failed.push(id)
      }
    }

    await logAdminAction({
      action: 'send_email',
      target_type: 'email',
      target_id: userIds.length === 1 ? userIds[0] : null,
      summary: `Emailed ${sent} user(s)${failed.length ? `, ${failed.length} failed` : ''} — "${subject.trim().slice(0, 60)}"`,
      metadata: { sent, failed, subject: subject.trim(), recipients: userIds.length },
    })

    return NextResponse.json({ success: true, sent, failed: failed.length })
  } catch (err) {
    console.error('[Admin email] error:', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
