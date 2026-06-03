// Turns the links a musician pastes into playable embeds. Anything we can embed
// renders inline; anything we can't falls back to a labeled link card on the
// profile. Pure string parsing — safe on server and client.

export type VideoProvider = 'youtube' | 'vimeo' | 'instagram' | 'tiktok' | 'facebook' | 'other'
export type AudioProvider = 'spotify' | 'soundcloud' | 'other'

// ---- Video ----

/** Returns an iframe-embeddable src for YouTube / Vimeo, else null (use a link card). */
export function getVideoEmbed(url: string): string | null {
  if (!url) return null
  const u = url.trim()

  // YouTube: watch?v=, youtu.be/, /embed/, /shorts/
  const yt = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`

  // Vimeo: vimeo.com/123456789 (optionally /hash)
  const vi = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`

  return null
}

/** Best-effort provider label, used for the link-card fallback and badges. */
export function videoProvider(url: string): VideoProvider {
  const u = (url || '').toLowerCase()
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
  if (/vimeo\.com/.test(u)) return 'vimeo'
  if (/instagram\.com/.test(u)) return 'instagram'
  if (/tiktok\.com/.test(u)) return 'tiktok'
  if (/facebook\.com|fb\.watch/.test(u)) return 'facebook'
  return 'other'
}

export function videoProviderLabel(url: string): string {
  switch (videoProvider(url)) {
    case 'youtube': return 'YouTube'
    case 'vimeo': return 'Vimeo'
    case 'instagram': return 'Instagram'
    case 'tiktok': return 'TikTok'
    case 'facebook': return 'Facebook'
    default: return 'Watch video'
  }
}

// ---- Audio ----

/** Returns an embeddable player src + suggested height for Spotify / SoundCloud, else null. */
export function getAudioEmbed(url: string): { src: string; provider: AudioProvider; height: number } | null {
  if (!url) return null
  const u = url.trim()

  // Spotify: open.spotify.com/{track|album|artist|playlist|episode|show}/{id}
  const sp = u.match(/open\.spotify\.com\/(track|album|artist|playlist|episode|show)\/([a-zA-Z0-9]+)/)
  if (sp) {
    const type = sp[1]
    // Single tracks get the compact player; collections get the tall one.
    const height = type === 'track' || type === 'episode' ? 152 : 352
    return { src: `https://open.spotify.com/embed/${type}/${sp[2]}`, provider: 'spotify', height }
  }

  // SoundCloud: any track/set URL — player takes the encoded URL.
  if (/soundcloud\.com\//.test(u)) {
    const encoded = encodeURIComponent(u)
    return {
      src: `https://w.soundcloud.com/player/?url=${encoded}&color=%23dc7f41&auto_play=false&hide_related=true&show_comments=false&show_reposts=false&visual=false`,
      provider: 'soundcloud',
      height: 166,
    }
  }

  return null
}

/** True if the URL looks like a usable http(s) link. */
export function looksLikeUrl(url: string): boolean {
  return /^https?:\/\/\S+\.\S+/.test((url || '').trim())
}
