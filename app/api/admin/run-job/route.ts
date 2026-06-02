import { NextResponse } from 'next/server'

// Admin-only: manually trigger a scheduled cron job (e.g. if the daily run
// failed, or to test). Guarded by middleware. We call the real cron endpoint
// server-to-server with the CRON_SECRET so all the existing logic/guards apply.
const JOBS: Record<string, string> = {
  payouts: '/api/stripe/release-payout',
  reminders: '/api/cron/gig-reminders',
}

export async function POST(request: Request) {
  try {
    const { job } = await request.json() as { job: 'payouts' | 'reminders' }
    const path = JOBS[job]
    if (!path) return NextResponse.json({ error: 'Unknown job' }, { status: 400 })

    const secret = process.env.CRON_SECRET
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })

    const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json({ error: 'Job failed', detail: result }, { status: 502 })
    }
    return NextResponse.json({ success: true, result })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
