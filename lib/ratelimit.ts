import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { NextResponse } from 'next/server'

function buildRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

const redis = buildRedis()

function slidingWindow(requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`): Ratelimit | null {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  })
}

export const strictLimiter = slidingWindow(5, '10 m')
export const standardLimiter = slidingWindow(20, '1 m')
export const cronLimiter = slidingWindow(3, '1 m')

function getIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  )
}

export async function checkRateLimit(
  request: Request,
  limiter: Ratelimit | null,
): Promise<{ limited: boolean; response?: NextResponse }> {
  if (!limiter) return { limited: false }
  const { success } = await limiter.limit(getIp(request))
  if (!success) {
    return {
      limited: true,
      response: NextResponse.json(
        { error: 'Too many requests, please try again later.' },
        { status: 429 },
      ),
    }
  }
  return { limited: false }
}
