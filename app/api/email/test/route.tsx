import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/send-email'
import { NewApplicationEmail } from '@/emails/NewApplicationEmail'
import { ApplicationAcceptedEmail } from '@/emails/ApplicationAcceptedEmail'
import { ApplicationDeclinedEmail } from '@/emails/ApplicationDeclinedEmail'
import { BookingConfirmedEmail } from '@/emails/BookingConfirmedEmail'
import { NewMessageEmail } from '@/emails/NewMessageEmail'
import { GigReminderEmail } from '@/emails/GigReminderEmail'
import { PayoutReleasedEmail } from '@/emails/PayoutReleasedEmail'
import type { ReactElement } from 'react'

// GET /api/email/test?email=your@email.com&secret=<CRON_SECRET>
// Sends all 7 email types with fake data, sequentially to avoid rate limits.
// REMOVE OR PROTECT THIS ENDPOINT BEFORE GOING TO PRODUCTION.

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json(
      { error: 'This endpoint is disabled in production' },
      { status: 404 },
    )
  }

  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const to = searchParams.get('email')
  if (!to) {
    return NextResponse.json({ error: 'Missing ?email= parameter' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'
  const dashboardUrl = `${appUrl}/dashboard`

  const emails: Array<{ name: string; subject: string; emailComponent: ReactElement }> = [
    {
      name: 'NewApplication',
      subject: '[TEST] New Application from Jamie Rivers',
      emailComponent: (
        <NewApplicationEmail
          restaurantName="The Jazz Corner"
          musicianName="Jamie Rivers"
          performerType="solo"
          applicationNote="I've been playing jazz for 12 years and love intimate dining venues. Would love to bring some energy to your Friday nights!"
          gigDate="Friday, May 30, 2025"
          gigTime="7:00 PM – 10:00 PM"
          payAmount={200}
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'ApplicationAccepted',
      subject: '[TEST] You got the gig! 🎉',
      emailComponent: (
        <ApplicationAcceptedEmail
          musicianName="Jamie Rivers"
          restaurantName="The Jazz Corner"
          gigDate="Friday, May 30, 2025"
          gigTime="7:00 PM – 10:00 PM"
          payAmount={200}
          platformFee={16}
          musicianReceives={184}
          restaurantAddress="123 S. Broad St, Philadelphia, PA 19107"
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'ApplicationDeclined',
      subject: '[TEST] Application Update from The Jazz Corner',
      emailComponent: (
        <ApplicationDeclinedEmail
          musicianName="Jamie Rivers"
          restaurantName="The Jazz Corner"
          gigDate="Friday, May 30, 2025"
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'BookingConfirmed (restaurant)',
      subject: '[TEST] Booking Confirmed — Jamie Rivers on May 30',
      emailComponent: (
        <BookingConfirmedEmail
          recipientName="The Jazz Corner"
          recipientType="restaurant"
          musicianName="Jamie Rivers"
          restaurantName="The Jazz Corner"
          gigDate="Friday, May 30, 2025"
          gigTime="7:00 PM – 10:00 PM"
          restaurantAddress="123 S. Broad St, Philadelphia, PA 19107"
          payAmount={200}
          platformFee={16}
          musicianReceives={184}
          stripePaymentIntentId="pi_3RKxample123456789"
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'BookingConfirmed (musician)',
      subject: '[TEST] Booking Confirmed — The Jazz Corner on May 30',
      emailComponent: (
        <BookingConfirmedEmail
          recipientName="Jamie Rivers"
          recipientType="musician"
          musicianName="Jamie Rivers"
          restaurantName="The Jazz Corner"
          gigDate="Friday, May 30, 2025"
          gigTime="7:00 PM – 10:00 PM"
          restaurantAddress="123 S. Broad St, Philadelphia, PA 19107"
          payAmount={200}
          platformFee={16}
          musicianReceives={184}
          stripePaymentIntentId="pi_3RKxample123456789"
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'NewMessage',
      subject: '[TEST] New Message from The Jazz Corner',
      emailComponent: (
        <NewMessageEmail
          recipientName="Jamie Rivers"
          senderName="The Jazz Corner"
          messagePreview="Hey Jamie! So excited to have you Friday. Can you bring your own amp or should we arrange one for you?"
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'GigReminder (musician)',
      subject: '[TEST] Your Gig is Tomorrow! 🎵',
      emailComponent: (
        <GigReminderEmail
          recipientName="Jamie Rivers"
          recipientType="musician"
          otherPartyName="The Jazz Corner"
          gigDate="Friday, May 30, 2025"
          gigTime="7:00 PM – 10:00 PM"
          restaurantAddress="123 S. Broad St, Philadelphia, PA 19107"
          dashboardUrl={dashboardUrl}
        />
      ),
    },
    {
      name: 'PayoutReleased',
      subject: '[TEST] Your payment of $184.00 is on the way!',
      emailComponent: (
        <PayoutReleasedEmail
          musicianName="Jamie Rivers"
          restaurantName="The Jazz Corner"
          gigDate="Friday, May 30, 2025"
          amount={184}
          dashboardUrl={dashboardUrl}
        />
      ),
    },
  ]

  const summary: Array<{ email: number; name: string; success: boolean; id?: string; error?: string }> = []

  for (let i = 0; i < emails.length; i++) {
    const { name, subject, emailComponent } = emails[i]
    const result = await sendEmail({ to, subject, emailComponent })
    summary.push({
      email: i + 1,
      name,
      success: result.success,
      ...(result.success && result.data ? { id: (result.data as { id?: string }).id } : {}),
      ...(!result.success ? { error: String(result.error) } : {}),
    })
    // 300ms between sends to stay well within Resend's rate limit
    if (i < emails.length - 1) await delay(300)
  }

  const succeeded = summary.filter(r => r.success).length
  const failed = summary.filter(r => !r.success).length

  return NextResponse.json({
    sent: succeeded,
    failed,
    total: emails.length,
    summary,
  })
}
