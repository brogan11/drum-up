import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/send-email'
import { NewMessageEmail } from '@/emails/NewMessageEmail'
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
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message_id } = await request.json() as { message_id: string }
    if (!message_id) return NextResponse.json({ error: 'Missing message_id' }, { status: 400 })

    const { data: message } = await supabaseAdmin
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at, conversation_id')
      .eq('id', message_id)
      .maybeSingle()

    if (!message) return NextResponse.json({ error: 'Message not found' }, { status: 404 })

    // Per-conversation cooldown: during an active back-and-forth, skip both the
    // in-app notification and the email so we don't spam either channel.
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: recentMessages } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('conversation_id', message.conversation_id)
      .neq('id', message_id)
      .gte('created_at', fiveMinutesAgo)
      .limit(1)

    if (recentMessages && recentMessages.length > 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'cooldown' })
    }

    const preview = message.content.length > 80
      ? message.content.slice(0, 77) + '…'
      : message.content

    // The in-app bell notification is the primary channel — it always fires here.
    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, role_metadata')
      .eq('id', message.sender_id)
      .maybeSingle()

    const senderMeta = (sender?.role_metadata ?? {}) as Record<string, unknown>
    const senderName = (senderMeta.venue_name as string | undefined) ?? sender?.full_name ?? 'Someone'

    await supabaseAdmin.from('notifications').insert({
      user_id: message.receiver_id,
      type: 'new_message',
      title: `New message from ${senderName}`,
      body: preview,
      link: '/dashboard',
    })

    // ---- Email is a throttled "you have unread messages" nudge, NOT per-message ----
    // We only email the recipient if they look inactive (haven't sent a message
    // recently, so they're probably not in the app) AND we haven't already nudged
    // them within the cooldown. This caps message emails at one per recipient per
    // cooldown window no matter how many messages or conversations arrive.
    const ACTIVE_WINDOW_MS = 30 * 60 * 1000   // sent a message in last 30 min => active, skip
    const EMAIL_COOLDOWN_MS = 6 * 60 * 60 * 1000 // at most one message email per 6h

    const now = Date.now()

    const { data: receiver, error: receiverErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, last_message_email_at')
      .eq('id', message.receiver_id)
      .maybeSingle()

    // If we can't read the throttle state (e.g. migration not applied yet), skip
    // the email rather than risk un-throttled per-message sends.
    if (receiverErr || !receiver) {
      return NextResponse.json({ success: true, emailed: false, reason: 'no_throttle_state' })
    }

    // Cooldown: already nudged recently → in-app only.
    const lastEmailedAt = receiver?.last_message_email_at
      ? new Date(receiver.last_message_email_at as string).getTime()
      : 0
    if (now - lastEmailedAt < EMAIL_COOLDOWN_MS) {
      return NextResponse.json({ success: true, emailed: false, reason: 'cooldown' })
    }

    // Activity check: if the recipient has sent any message recently, they're
    // active in the app and will see the in-app notification — don't email.
    const activeSince = new Date(now - ACTIVE_WINDOW_MS).toISOString()
    const { data: recentlySent } = await supabaseAdmin
      .from('messages')
      .select('id')
      .eq('sender_id', message.receiver_id)
      .gte('created_at', activeSince)
      .limit(1)

    if (recentlySent && recentlySent.length > 0) {
      return NextResponse.json({ success: true, emailed: false, reason: 'recipient_active' })
    }

    const { data: { user: receiverAuth } } = await supabaseAdmin.auth.admin.getUserById(message.receiver_id)
    const receiverEmail = receiverAuth?.email
    if (!receiverEmail) {
      return NextResponse.json({ success: true, emailed: false, reason: 'no_email' })
    }

    const recipientName = receiver?.full_name ?? 'there'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    // Record the nudge first so concurrent sends don't double-email.
    await supabaseAdmin
      .from('profiles')
      .update({ last_message_email_at: new Date(now).toISOString() })
      .eq('id', message.receiver_id)

    await sendEmail({
      to: receiverEmail,
      subject: `New message from ${senderName}`,
      emailComponent: (
        <NewMessageEmail
          recipientName={recipientName}
          senderName={senderName}
          messagePreview={message.content}
          dashboardUrl={`${appUrl}/dashboard`}
        />
      ),
    })

    return NextResponse.json({ success: true, emailed: true })
  } catch (err) {
    console.error('[Email] new-message error:', err)
    return NextResponse.json({ success: false })
  }
}
