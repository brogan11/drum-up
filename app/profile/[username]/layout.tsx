import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Server-side metadata so shared "Book me on Drum Up" links render a real preview
// card (the profile page itself is a client component and can't export this).
export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> },
): Promise<Metadata> {
  const { username: slug } = await params

  const fallback: Metadata = {
    title: 'Drum Up',
    description: 'Live music booking — restaurants, musicians, and fans on one stage.',
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return fallback

  try {
    const supabase = createClient(url, anon)
    const cols = 'username, full_name, avatar_url, bio, user_type, role_metadata, location_text'
    const q = UUID_RE.test(slug)
      ? supabase.from('profiles').select(cols).eq('id', slug)
      : supabase.from('profiles').select(cols).eq('username', slug)
    const { data: p } = await q.maybeSingle()
    if (!p) return fallback

    const meta = (p.role_metadata ?? {}) as Record<string, unknown>
    const name = p.user_type === 'restaurant'
      ? ((meta.venue_name as string | undefined) ?? p.full_name ?? 'Drum Up')
      : (p.full_name ?? 'Drum Up')

    const location = p.location_text ? ` · ${p.location_text}` : ''
    const roleLabel = p.user_type === 'restaurant' ? 'Venue' : p.user_type === 'musician' ? 'Musician' : 'Member'
    const description = (p.bio as string | null)?.trim()
      || `${roleLabel} on Drum Up${location}. Discover and book live music.`

    const banner = meta.banner_url as string | undefined
    const isHttp = (u?: string | null): u is string => !!u && /^https?:\/\//.test(u)
    const image = isHttp(banner) ? banner : isHttp(p.avatar_url) ? p.avatar_url : '/orange-drum-up.png'

    const canonical = `/profile/${p.username ?? slug}`
    const title = `${name} · Drum Up`

    return {
      title,
      description,
      openGraph: {
        type: 'profile',
        title,
        description,
        url: canonical,
        siteName: 'Drum Up',
        images: [{ url: image, alt: name }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    }
  } catch {
    return fallback
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
