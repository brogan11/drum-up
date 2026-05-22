export function buildSocialUrl(platform: string, value: string): string {
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://')) return value

  const handle = value.replace(/^@/, '').trim()

  switch (platform) {
    case 'instagram': return `https://instagram.com/${handle}`
    case 'tiktok': return `https://tiktok.com/@${handle}`
    case 'spotify': return `https://open.spotify.com/artist/${handle}`
    case 'youtube': return `https://youtube.com/@${handle}`
    case 'website': return `https://${handle}`
    default: return `https://${handle}`
  }
}
