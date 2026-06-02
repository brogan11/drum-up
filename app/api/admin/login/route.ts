import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { checkRateLimit, strictLimiter } from '@/lib/ratelimit'
import { adminCookieValue } from '@/lib/admin-auth'
import { verifyTotp } from '@/lib/totp'

// Constant-time string compare (avoids leaking the password via timing).
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(request: Request) {
  // Throttle password guessing: 5 attempts / 10 min per IP.
  const rl = await checkRateLimit(request, strictLimiter)
  if (rl.limited) return rl.response!

  try {
    const { password, code } = await request.json() as { password?: string; code?: string }
    const adminPassword = process.env.ADMIN_PASSWORD
    const totpSecret = process.env.ADMIN_TOTP_SECRET

    if (!adminPassword) {
      return NextResponse.json({ error: 'Admin not configured' }, { status: 500 })
    }

    if (!password || !safeEqual(password, adminPassword)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    // Second factor — enforced whenever ADMIN_TOTP_SECRET is configured.
    if (totpSecret) {
      if (!code) {
        return NextResponse.json({ error: 'Authenticator code required', needsCode: true }, { status: 401 })
      }
      if (!verifyTotp(code, totpSecret)) {
        return NextResponse.json({ error: 'Invalid authenticator code', needsCode: true }, { status: 401 })
      }
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set('admin_session', await adminCookieValue(adminPassword), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    })
    return response
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
