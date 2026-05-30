import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCookieValue } from '@/lib/admin-auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow the login page and login API through without a cookie check
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next()
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const session = request.cookies.get('admin_session')?.value
    const adminPassword = process.env.ADMIN_PASSWORD
    const expected = adminPassword ? await adminCookieValue(adminPassword) : null

    if (!session || !expected || session !== expected) {
      // API routes return JSON 401; page routes redirect to login
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const loginUrl = new URL('/admin/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
