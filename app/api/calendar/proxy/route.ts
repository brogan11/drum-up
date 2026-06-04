import { NextRequest, NextResponse } from 'next/server'

// Server-side fetch of a public iCal/.ics URL. Browsers can't fetch most calendar
// feeds directly (no CORS headers), so the musician dashboard routes URL imports
// through here, then parses the returned text client-side (lib/ics.parseICSDates).
//
// This is a generic outbound fetch, so we guard against SSRF: only http(s) (webcal://
// is normalized to https://), and we block obvious internal/loopback/metadata hosts.
// The body is capped and returned as plain text.

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB is plenty for a calendar feed

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '0.0.0.0' || h === '::1' || h === '[::1]') return true
  if (h === '169.254.169.254') return true // cloud metadata endpoint
  // Private / loopback IPv4 ranges.
  if (/^127\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  return false
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  // webcal is just http(s) for calendar subscriptions — normalize to https.
  const normalized = raw.replace(/^webcal:\/\//i, 'https://')

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http(s) URLs are allowed' }, { status: 400 })
  }
  if (isBlockedHost(parsed.hostname)) {
    return NextResponse.json({ error: 'That host is not allowed' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const res = await fetch(parsed.toString(), {
      headers: { Accept: 'text/calendar, text/plain, */*' },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream returned ${res.status}` }, { status: 502 })
    }

    const text = (await res.text()).slice(0, MAX_BYTES)
    return new NextResponse(text, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
    })
  } catch (err) {
    console.error('[calendar/proxy] fetch failed:', err)
    return NextResponse.json({ error: 'Could not fetch that URL' }, { status: 502 })
  }
}
