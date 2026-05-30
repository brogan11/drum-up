// Canonical config + math for the structured review system. A review always carries an
// overall 1–5 star rating, and optionally a set of per-aspect star ratings and a list of
// highlight tags. WHICH aspects/tags are offered depends on who is being reviewed: a
// restaurant rating a musician judges different things than a musician rating a venue.
// Keep this the single source of truth — the profile page reads aspect/tag definitions
// and the aggregate helpers from here so the modal and the summary never drift.

export type RevieweeType = 'musician' | 'restaurant'

export interface AspectDef {
  key: string
  label: string
  // Short hint shown under the label in the review modal.
  hint: string
}

// Aspect categories, keyed by the TYPE OF PROFILE BEING REVIEWED.
export const REVIEW_ASPECTS: Record<RevieweeType, AspectDef[]> = {
  musician: [
    { key: 'punctuality', label: 'Punctuality', hint: 'Showed up & started on time' },
    { key: 'sound', label: 'Sound Quality', hint: 'How they sounded live' },
    { key: 'professionalism', label: 'Professionalism', hint: 'Easy, reliable, prepared' },
    { key: 'engagement', label: 'Crowd Engagement', hint: 'Worked the room' },
    { key: 'communication', label: 'Communication', hint: 'Responsive before the gig' },
  ],
  restaurant: [
    { key: 'payment', label: 'Paid Fairly', hint: 'Paid the agreed amount, on time' },
    { key: 'hospitality', label: 'Hospitality', hint: 'How the staff treated you' },
    { key: 'atmosphere', label: 'Atmosphere & Crowd', hint: 'The vibe & the audience' },
    { key: 'communication', label: 'Communication', hint: 'Clear about the details' },
    { key: 'setup', label: 'Stage & Sound Setup', hint: 'Space, power, sound to play' },
  ],
}

// Selectable highlight chips, keyed by the type of profile being reviewed.
export const REVIEW_TAGS: Record<RevieweeType, string[]> = {
  musician: [
    'Crowd favorite', 'Right on time', 'Killer sound', 'Easy to work with',
    'Would book again', 'Versatile setlist', 'Brought their own gear', 'Read the room',
    'Great energy', 'True professional',
  ],
  restaurant: [
    'Paid promptly', 'Welcoming staff', 'Packed house', 'Clear communication',
    'Would play again', 'Great stage setup', 'Fed the band', 'Promoted the show',
    'Respectful crowd', 'Smooth load-in',
  ],
}

export function aspectLabel(type: RevieweeType, key: string): string {
  return REVIEW_ASPECTS[type].find(a => a.key === key)?.label ?? key
}

export interface ReviewLike {
  rating: number
  aspects?: Record<string, number> | null
  tags?: string[] | null
}

// Count of reviews at each star level, 5 → 1 (the order distribution bars render in).
export function ratingDistribution(reviews: ReviewLike[]): { stars: number; count: number }[] {
  const counts = [5, 4, 3, 2, 1].map(stars => ({
    stars,
    count: reviews.filter(r => Math.round(r.rating) === stars).length,
  }))
  return counts
}

// Average score per aspect (only over reviews that actually rated that aspect), in the
// canonical aspect order for the reviewee type. Aspects nobody rated are omitted.
export function aspectAverages(
  reviews: ReviewLike[],
  type: RevieweeType,
): { key: string; label: string; avg: number; count: number }[] {
  return REVIEW_ASPECTS[type]
    .map(def => {
      const vals = reviews
        .map(r => r.aspects?.[def.key])
        .filter((v): v is number => typeof v === 'number' && v > 0)
      const count = vals.length
      const avg = count > 0 ? vals.reduce((s, v) => s + v, 0) / count : 0
      return { key: def.key, label: def.label, avg, count }
    })
    .filter(a => a.count > 0)
}

// Compact reputation summary for a browse/discovery card.
export interface RepSummary { avg: number; count: number; topTag: string | null }

// Group raw review rows (each tagged with its reviewee_id) into one summary per profile.
// Used by the dashboards to badge many cards from a single `reviews` query.
export function groupReputations(
  rows: { reviewee_id: string; rating: number; tags?: string[] | null }[],
): Map<string, RepSummary> {
  const byId = new Map<string, { reviewee_id: string; rating: number; tags?: string[] | null }[]>()
  for (const r of rows) {
    const arr = byId.get(r.reviewee_id) ?? []
    arr.push(r)
    byId.set(r.reviewee_id, arr)
  }
  const out = new Map<string, RepSummary>()
  for (const [id, rs] of byId) {
    const count = rs.length
    const avg = count ? rs.reduce((s, r) => s + r.rating, 0) / count : 0
    out.set(id, { avg, count, topTag: topTags(rs, 1)[0]?.tag ?? null })
  }
  return out
}

// Most-used highlight tags across all reviews, highest first.
export function topTags(reviews: ReviewLike[], limit = 6): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const r of reviews) {
    for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
