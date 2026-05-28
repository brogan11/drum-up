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

    // Cooldown: skip if the receiver sent or received a message in this conversation in the last 5 minutes
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

    const [
      { data: sender },
      { data: { user: receiverAuth } },
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, full_name, role_metadata').eq('id', message.sender_id).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(message.receiver_id),
    ])

    const { data: receiver } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .eq('id', message.receiver_id)
      .maybeSingle()

    const receiverEmail = receiverAuth?.email
    if (!receiverEmail) {
      console.error('[Email] new-message: receiver has no email')
      return NextResponse.json({ success: false, error: 'No receiver email' })
    }

    const senderMeta = (sender?.role_metadata ?? {}) as Record<string, unknown>
    const senderName = (senderMeta.venue_name as string | undefined) ?? sender?.full_name ?? 'Someone'
    const recipientName = receiver?.full_name ?? 'there'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    const preview = message.content.length > 80
      ? message.content.slice(0, 77) + '…'
      : message.content

    await Promise.all([
      sendEmail({
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
      }),
      supabaseAdmin.from('notifications').insert({
        user_id: message.receiver_id,
        type: 'new_message',
        title: `New message from ${senderName}`,
        body: preview,
        link: '/dashboard',
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Email] new-message error:', err)
    return NextResponse.json({ success: false })
  }
}
