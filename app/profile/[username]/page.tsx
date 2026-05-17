'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'

// ---- Types ----

interface ProfileData {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  user_type: 'musician' | 'restaurant' | 'fan'
  location_text: string | null
  latitude: number | null
  longitude: number | null
  instagram_url: string | null
  tiktok_url: string | null
  spotify_url: string | null
  youtube_url: string | null
  website: string | null
  role_metadata: Record<string, unknown>
}

interface ViewerData {
  id: string
  user_type: string
  latitude: number | null
  longitude: number | null
}

interface Review {
  id: string
  rating: number
  review_text: string | null
  created_at: string
  verified: boolean
  reviewer_name: string
  reviewer_avatar: string | null
  reviewer_id: string
}

interface PastGig {
  bookingId: string
  date: string
  dateLabel: string
  venueName: string
  venueId: string
}

interface ShowEntry {
  bookingId: string
  date: string
  dateLabel: string
  time: string
  musicianName: string
  musicianId: string
}

interface FollowedProfile {
  id: string
  name: string
  avatar: string | null
  user_type: string
  location: string | null
}

// ---- Helpers ----

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getYouTubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? `https://www.youtube.com/embed/${m[1]}` : null
}

function dateLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function Stars({ rating, interactive, onSelect }: {
  rating: number
  interactive?: boolean
  onSelect?: (r: number) => void
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => interactive && onSelect?.(n)}
          className={`text-2xl leading-none transition-transform ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
        >
          <span className={n <= rating ? 'text-chestnut' : 'text-charcoal/20'}>★</span>
        </button>
      ))}
    </div>
  )
}

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide uppercase">
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Verified
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-graphite text-xl font-black tracking-tight mb-4">{children}</h2>
  )
}

// ---- Main Component ----

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.username as string

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [viewer, setViewer] = useState<ViewerData | null>(null)
  const [viewerId, setViewerId] = useState('')

  const [pastGigs, setPastGigs] = useState<PastGig[]>([])
  const [upcomingShows, setUpcomingShows] = useState<ShowEntry[]>([])
  const [pastShows, setPastShows] = useState<ShowEntry[]>([])
  const [followedProfiles, setFollowedProfiles] = useState<FollowedProfile[]>([])

  const [reviews, setReviews] = useState<Review[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [eligibleBookingId, setEligibleBookingId] = useState<string | null>(null)
  const [hasReviewed, setHasReviewed] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  const isOwnProfile = !!viewerId && viewerId === profile?.id
  const distance = profile && viewer?.latitude != null && viewer?.longitude != null
    && profile.latitude != null && profile.longitude != null
    ? milesBetween(viewer.latitude, viewer.longitude, profile.latitude, profile.longitude)
    : null

  useEffect(() => {
    const load = async () => {
      // 1. Auth check
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setViewerId(user.id)

      // 2. Viewer's profile (for coords + user_type)
      const { data: vp } = await supabase
        .from('profiles')
        .select('id, user_type, latitude, longitude')
        .eq('id', user.id)
        .maybeSingle()
      if (vp) setViewer(vp as ViewerData)

      // 3. Target profile — by username OR by UUID
      const q = UUID_RE.test(slug)
        ? supabase.from('profiles').select('*').eq('id', slug)
        : supabase.from('profiles').select('*').eq('username', slug)
      const { data: pd } = await q.maybeSingle()
      setLoading(false)
      if (!pd) return
      setProfile(pd as ProfileData)
      const pid = pd.id

      // 4. Follow counts + viewer's follow status
      const [{ count: fc }, { count: fng }, { data: frow }] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', pid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', pid),
        supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', pid).maybeSingle(),
      ])
      setFollowersCount(fc ?? 0)
      setFollowingCount(fng ?? 0)
      setIsFollowing(!!frow)

      const today = new Date().toISOString().slice(0, 10)

      // 5. Type-specific data
      if (pd.user_type === 'musician') {
        const { data: bks } = await supabase
          .from('bookings').select('id, availability_id, restaurant_id')
          .eq('musician_id', pid).eq('status', 'confirmed')
        if (bks && bks.length > 0) {
          const aIds = bks.map(b => b.availability_id)
          const rIds = [...new Set(bks.map(b => b.restaurant_id))]
          const [{ data: avails }, { data: venues }] = await Promise.all([
            supabase.from('availability').select('id, date').in('id', aIds).lt('date', today),
            supabase.from('profiles').select('id, full_name, role_metadata').in('id', rIds),
          ])
          const aMap = new Map((avails ?? []).map(a => [a.id, a]))
          const vMap = new Map((venues ?? []).map(v => [v.id, v]))
          const gigs: PastGig[] = bks
            .filter(b => aMap.has(b.availability_id))
            .map(b => {
              const a = aMap.get(b.availability_id)!
              const v = vMap.get(b.restaurant_id)
              const m = (v?.role_metadata ?? {}) as Record<string, unknown>
              return {
                bookingId: b.id,
                date: a.date,
                dateLabel: dateLabel(a.date),
                venueName: (m.venue_name as string | undefined) ?? v?.full_name ?? 'Venue',
                venueId: b.restaurant_id,
              }
            })
            .sort((a, b) => b.date.localeCompare(a.date))
          setPastGigs(gigs)
        }
      } else if (pd.user_type === 'restaurant') {
        const { data: bks } = await supabase
          .from('bookings').select('id, musician_id, availability_id')
          .eq('restaurant_id', pid).eq('status', 'confirmed')
        if (bks && bks.length > 0) {
          const aIds = bks.map(b => b.availability_id)
          const mIds = [...new Set(bks.map(b => b.musician_id))]
          const [{ data: avails }, { data: musicians }] = await Promise.all([
            supabase.from('availability').select('id, date, start_time, end_time').in('id', aIds),
            supabase.from('profiles').select('id, full_name').in('id', mIds),
          ])
          const aMap = new Map((avails ?? []).map(a => [a.id, a]))
          const mMap = new Map((musicians ?? []).map(m => [m.id, m]))
          const upcoming: ShowEntry[] = []
          const past: ShowEntry[] = []
          bks.forEach(b => {
            const a = aMap.get(b.availability_id)
            if (!a) return
            const mu = mMap.get(b.musician_id)
            const entry: ShowEntry = {
              bookingId: b.id,
              date: a.date,
              dateLabel: dateLabel(a.date),
              time: `${fmtTime(a.start_time?.slice(0, 5) ?? '')} – ${fmtTime(a.end_time?.slice(0, 5) ?? '')}`,
              musicianName: mu?.full_name ?? 'Musician',
              musicianId: b.musician_id,
            }
            if (a.date >= today) upcoming.push(entry)
            else past.push(entry)
          })
          setUpcomingShows(upcoming.sort((a, b) => a.date.localeCompare(b.date)))
          setPastShows(past.sort((a, b) => b.date.localeCompare(a.date)))
        }
      } else if (pd.user_type === 'fan') {
        const { data: fws } = await supabase
          .from('follows').select('following_id').eq('follower_id', pid)
        if (fws && fws.length > 0) {
          const ids = fws.map(f => f.following_id)
          const { data: fps } = await supabase
            .from('profiles').select('id, full_name, avatar_url, user_type, location_text').in('id', ids)
          setFollowedProfiles((fps ?? []).map(p => ({
            id: p.id,
            name: p.full_name ?? 'User',
            avatar: p.avatar_url ?? null,
            user_type: p.user_type,
            location: p.location_text ?? null,
          })))
        }
      }

      // 6. Reviews (table may not exist yet — handled gracefully)
      const { data: rws, error: rwErr } = await supabase
        .from('reviews')
        .select('id, rating, review_text, created_at, verified, reviewer_id, booking_id')
        .eq('reviewee_id', pid)
        .order('created_at', { ascending: false })
      if (!rwErr && rws && rws.length > 0) {
        const rIds = [...new Set(rws.map(r => r.reviewer_id))]
        const { data: rProfs } = await supabase
          .from('profiles').select('id, full_name, avatar_url').in('id', rIds)
        const rpMap = new Map((rProfs ?? []).map(p => [p.id, p]))
        setReviews(rws.map(r => {
          const rp = rpMap.get(r.reviewer_id)
          return {
            id: r.id,
            rating: r.rating,
            review_text: r.review_text ?? null,
            created_at: r.created_at,
            verified: r.verified,
            reviewer_name: rp?.full_name ?? 'Anonymous',
            reviewer_avatar: rp?.avatar_url ?? null,
            reviewer_id: r.reviewer_id,
          }
        }))
      }

      // 7. Review eligibility
      if (user.id !== pid && pd.user_type !== 'fan' && vp?.user_type !== 'fan') {
        const isRestViewer = vp?.user_type === 'restaurant' && pd.user_type === 'musician'
        const isMusiViewer = vp?.user_type === 'musician' && pd.user_type === 'restaurant'
        if (isRestViewer || isMusiViewer) {
          let bq = supabase.from('bookings').select('id').eq('status', 'confirmed').limit(1)
          bq = isRestViewer
            ? bq.eq('restaurant_id', user.id).eq('musician_id', pid)
            : bq.eq('musician_id', user.id).eq('restaurant_id', pid)
          const { data: eb } = await bq
          if (eb && eb.length > 0) {
            const { data: existRev } = await supabase
              .from('reviews').select('id').eq('reviewer_id', user.id).eq('reviewee_id', pid).maybeSingle()
            if (existRev) { setHasReviewed(true) }
            else { setEligibleBookingId(eb[0].id) }
          }
        }
      }
    }
    load()
  }, [slug, router])

  const handleToggleFollow = async () => {
    if (!viewerId || !profile) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', profile.id)
      setIsFollowing(false)
      setFollowersCount(c => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: viewerId, following_id: profile.id })
      setIsFollowing(true)
      setFollowersCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  const handleSubmitReview = async () => {
    if (!viewerId || !profile || !eligibleBookingId) return
    setSubmittingReview(true)
    const { error } = await supabase.from('reviews').insert({
      reviewer_id: viewerId,
      reviewee_id: profile.id,
      booking_id: eligibleBookingId,
      rating: reviewRating,
      review_text: reviewText.trim() || null,
      verified: true,
    })
    setSubmittingReview(false)
    if (error) { console.error('Review submit failed', error); return }
    setReviewModalOpen(false)
    setHasReviewed(true)
    setEligibleBookingId(null)
    setReviews(prev => [{
      id: 'new-' + Date.now(),
      rating: reviewRating,
      review_text: reviewText.trim() || null,
      created_at: new Date().toISOString(),
      verified: true,
      reviewer_name: 'You',
      reviewer_avatar: null,
      reviewer_id: viewerId,
    }, ...prev])
  }

  // ---- Loading ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#E8E4E0' }}>
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ---- 404 ----
  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#E8E4E0' }}>
        <div className="bg-white rounded-3xl p-10 shadow-xl text-center max-w-sm w-full">
          <div className="text-6xl mb-4">🎵</div>
          <h1 className="text-graphite text-2xl font-black mb-2">User not found</h1>
          <p className="text-charcoal text-sm mb-6 leading-relaxed">This profile doesn't exist or the link may have changed.</p>
          <button onClick={() => router.back()} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  // ---- Derived from profile ----
  const meta = (profile.role_metadata ?? {}) as Record<string, unknown>
  const genres = Array.isArray(meta.genres) ? meta.genres as string[] : []
  const instruments = (meta.instruments as string | undefined) ?? ''
  const soloOrBand = (meta.solo_or_band as string | undefined) ?? ''
  const yearsPerforming = (meta.years_performing as string | undefined) ?? ''
  const venueName = (meta.venue_name as string | undefined) ?? profile.full_name ?? ''
  const capacity = (meta.capacity as string | undefined) ?? ''
  const cuisineType = (meta.cuisine_type as string | undefined) ?? ''
  const musicNights = Array.isArray(meta.music_nights) ? meta.music_nights as string[] : []
  const displayName = profile.user_type === 'restaurant' ? venueName : (profile.full_name ?? 'User')
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null
  const embedUrl = profile.youtube_url ? getYouTubeEmbedUrl(profile.youtube_url) : null

  // ---- Reviews section (shared) ----
  const ReviewsSection = (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <SectionTitle>Reviews</SectionTitle>
          {avgRating != null && (
            <div className="flex items-center gap-2 -mt-3 mb-4">
              <Stars rating={Math.round(avgRating)} />
              <span className="text-graphite font-black text-lg">{avgRating.toFixed(1)}</span>
              <span className="text-charcoal text-sm">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
            </div>
          )}
        </div>
        {eligibleBookingId && !hasReviewed && (
          <button
            onClick={() => { setReviewRating(5); setReviewText(''); setReviewModalOpen(true) }}
            className="bg-chestnut text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            + Leave a Review
          </button>
        )}
      </div>
      {reviews.length === 0 ? (
        <div className="bg-[#F5F0EC] rounded-2xl p-6 text-center">
          <p className="text-charcoal/60 text-sm">No reviews yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-2">
                <Avatar src={r.reviewer_avatar ?? ''} className="w-9 h-9 rounded-full shrink-0" textSize="text-sm" bg="bg-chestnut/10" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-graphite font-bold text-sm">{r.reviewer_name}</p>
                    <div className="flex items-center gap-2">
                      {r.verified && <VerifiedBadge />}
                      <span className="text-charcoal/40 text-xs">
                        {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <Stars rating={r.rating} />
                </div>
              </div>
              {r.review_text && (
                <p className="text-charcoal text-sm leading-relaxed pl-12">{r.review_text}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )

  // ---- Render ----
  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0' }}>

      {/* Sticky top nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-graphite/95 border-b border-charcoal/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-snow/60 hover:text-snow shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-white rounded-lg p-1 shrink-0">
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-5 h-5 object-contain" />
            </div>
            <p className="text-snow font-black text-sm truncate">{displayName}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pb-12">
        {/* Banner + Avatar + Header info */}
        <div className="bg-white shadow-xl overflow-hidden">
          {/* Banner */}
          <div
            className="relative"
            style={{ height: 160, background: 'linear-gradient(135deg, #333333 0%, #5E5E5E 40%, #DC7F41 100%)' }}
          >
            <div className="absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(circle at 25% 60%, #6C9A8B 0%, transparent 55%), radial-gradient(circle at 75% 30%, #DC7F41 0%, transparent 55%)' }}
            />
            {/* EQ bars decoration */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-around opacity-[0.15] pointer-events-none" style={{ height: 80 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 bg-snow rounded-t"
                  style={{ height: `${25 + ((i * 37 + 13) % 60)}%` }}
                />
              ))}
            </div>
          </div>

          {/* Avatar overlapping banner */}
          <div className="px-5 relative" style={{ marginTop: -44 }}>
            <div className="flex items-end justify-between mb-4">
              <div className="w-22 h-22 rounded-full border-4 border-white shadow-xl overflow-hidden bg-chestnut/10 flex items-center justify-center shrink-0"
                style={{ width: 88, height: 88 }}>
                {profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-4xl">{profile.user_type === 'restaurant' ? '🍽' : profile.user_type === 'musician' ? '🎸' : '★'}</span>
                }
              </div>
              {/* Action buttons */}
              <div className="flex gap-2 pb-1">
                {isOwnProfile ? (
                  <button
                    onClick={() => router.push('/settings')}
                    className="bg-white text-graphite border border-charcoal/20 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-shadow"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${isFollowing ? 'bg-white text-chestnut border border-chestnut/30 hover:border-red-300 hover:text-red-500' : 'bg-chestnut text-snow hover:opacity-90'}`}
                    >
                      {followLoading ? '…' : isFollowing ? '✓ Following' : '+ Follow'}
                    </button>
                    {viewer?.user_type !== 'fan' && (
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="bg-graphite text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                      >
                        💬 Message
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Name + location */}
            <h1 className="text-graphite text-2xl font-black tracking-tight leading-tight mb-1">{displayName}</h1>
            {profile.location_text && (
              <p className="text-charcoal text-sm mb-1">📍 {profile.location_text}</p>
            )}
            {distance != null && viewer?.user_type === 'restaurant' && (
              <p className="text-chestnut text-sm font-semibold mb-1">{Math.round(distance)} miles away</p>
            )}

            {/* Follow stats */}
            <div className="flex gap-4 mb-3">
              <span className="text-charcoal text-sm"><span className="font-bold text-graphite">{followersCount}</span> followers</span>
              <span className="text-charcoal text-sm"><span className="font-bold text-graphite">{followingCount}</span> following</span>
            </div>

            {/* Genre / cuisine tags */}
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {genres.map(g => (
                  <span key={g} className="bg-teal text-snow text-xs font-bold px-3 py-1 rounded-full">{g}</span>
                ))}
                {instruments.split(',').filter(Boolean).map(inst => (
                  <span key={inst} className="bg-graphite/10 text-graphite text-xs font-semibold px-3 py-1 rounded-full">{inst.trim()}</span>
                ))}
              </div>
            )}
            {cuisineType && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="bg-teal text-snow text-xs font-bold px-3 py-1 rounded-full">{cuisineType}</span>
                {capacity && <span className="bg-graphite/10 text-graphite text-xs font-semibold px-3 py-1 rounded-full">Cap. {capacity}</span>}
                {musicNights.length > 0 && musicNights.map(n => (
                  <span key={n} className="bg-graphite/10 text-graphite text-xs font-semibold px-3 py-1 rounded-full">{n}</span>
                ))}
              </div>
            )}

            {/* Social links */}
            {(profile.instagram_url || profile.tiktok_url || profile.spotify_url || profile.youtube_url || profile.website) && (
              <div className="flex flex-wrap gap-4 pb-5">
                {profile.instagram_url && (
                  <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="text-charcoal/60 hover:text-chestnut transition-colors text-sm font-medium flex items-center gap-1">
                    📸 Instagram
                  </a>
                )}
                {profile.tiktok_url && (
                  <a href={profile.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-charcoal/60 hover:text-chestnut transition-colors text-sm font-medium flex items-center gap-1">
                    🎵 TikTok
                  </a>
                )}
                {profile.spotify_url && (
                  <a href={profile.spotify_url} target="_blank" rel="noopener noreferrer" className="text-charcoal/60 hover:text-chestnut transition-colors text-sm font-medium flex items-center gap-1">
                    🎧 Spotify
                  </a>
                )}
                {profile.youtube_url && (
                  <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer" className="text-charcoal/60 hover:text-chestnut transition-colors text-sm font-medium flex items-center gap-1">
                    ▶️ YouTube
                  </a>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-charcoal/60 hover:text-chestnut transition-colors text-sm font-medium flex items-center gap-1">
                    🌐 Website
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-charcoal/[0.08]" />

          {/* ---- Body content ---- */}
          <div className="px-5 py-6 space-y-10">

            {/* ======= MUSICIAN ======= */}
            {profile.user_type === 'musician' && (
              <>
                {/* About */}
                <section>
                  <SectionTitle>About</SectionTitle>
                  <div className="space-y-3">
                    {profile.bio && (
                      <p className="text-charcoal text-sm leading-relaxed">{profile.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {soloOrBand && (
                        <div>
                          <p className="text-charcoal/50 text-[10px] font-semibold uppercase tracking-wide">Format</p>
                          <p className="text-graphite font-bold text-sm">{soloOrBand}</p>
                        </div>
                      )}
                      {yearsPerforming && (
                        <div>
                          <p className="text-charcoal/50 text-[10px] font-semibold uppercase tracking-wide">Experience</p>
                          <p className="text-graphite font-bold text-sm">{yearsPerforming} yrs</p>
                        </div>
                      )}
                      {instruments && (
                        <div>
                          <p className="text-charcoal/50 text-[10px] font-semibold uppercase tracking-wide">Instruments</p>
                          <p className="text-graphite font-bold text-sm">{instruments}</p>
                        </div>
                      )}
                    </div>
                    {!profile.bio && !soloOrBand && !yearsPerforming && !instruments && (
                      <p className="text-charcoal/50 text-sm italic">No details yet.</p>
                    )}
                  </div>
                </section>

                {/* Videos */}
                <section>
                  <SectionTitle>Watch &amp; Listen</SectionTitle>
                  {embedUrl ? (
                    <div className="rounded-2xl overflow-hidden shadow-sm" style={{ aspectRatio: '16/9' }}>
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="Performance video"
                      />
                    </div>
                  ) : profile.youtube_url ? (
                    <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-[#F5F0EC] rounded-2xl p-4 hover:bg-[#EDE9E4] transition-colors group">
                      <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white text-xl shrink-0">▶</div>
                      <div>
                        <p className="text-graphite font-bold text-sm group-hover:text-chestnut transition-colors">Watch on YouTube</p>
                        <p className="text-charcoal/50 text-xs truncate max-w-xs">{profile.youtube_url}</p>
                      </div>
                    </a>
                  ) : (
                    <div className="bg-[#F5F0EC] rounded-2xl p-6 text-center">
                      <p className="text-charcoal/60 text-sm">No videos yet.</p>
                    </div>
                  )}
                </section>

                {/* Past Performances */}
                <section>
                  <SectionTitle>Past Performances</SectionTitle>
                  {pastGigs.length === 0 ? (
                    <div className="bg-[#F5F0EC] rounded-2xl p-6 text-center">
                      <p className="text-charcoal/60 text-sm">No gigs yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pastGigs.map(gig => (
                        <button
                          key={gig.bookingId}
                          onClick={() => router.push('/profile/' + gig.venueId)}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
                        >
                          <div className="bg-chestnut/10 rounded-xl px-3 py-2 text-center shrink-0 min-w-[52px]">
                            <p className="text-chestnut text-[10px] font-black uppercase">{gig.dateLabel.split(' ')[0]}</p>
                            <p className="text-chestnut text-xl font-black leading-tight">{gig.dateLabel.split(' ')[2]?.replace(',', '')}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-graphite font-bold text-sm truncate">{gig.venueName}</p>
                            <p className="text-charcoal/60 text-xs mt-0.5">{gig.dateLabel}</p>
                          </div>
                          <VerifiedBadge />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Reviews */}
                {ReviewsSection}
              </>
            )}

            {/* ======= RESTAURANT ======= */}
            {profile.user_type === 'restaurant' && (
              <>
                {/* About */}
                <section>
                  <SectionTitle>About</SectionTitle>
                  <div className="space-y-3">
                    {profile.bio && (
                      <p className="text-charcoal text-sm leading-relaxed">{profile.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {capacity && (
                        <div>
                          <p className="text-charcoal/50 text-[10px] font-semibold uppercase tracking-wide">Capacity</p>
                          <p className="text-graphite font-bold text-sm">{capacity} guests</p>
                        </div>
                      )}
                      {musicNights.length > 0 && (
                        <div>
                          <p className="text-charcoal/50 text-[10px] font-semibold uppercase tracking-wide">Music Nights</p>
                          <p className="text-graphite font-bold text-sm">{musicNights.join(', ')}</p>
                        </div>
                      )}
                    </div>
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-chestnut text-sm font-semibold hover:underline">
                        🌐 {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {!profile.bio && !capacity && musicNights.length === 0 && (
                      <p className="text-charcoal/50 text-sm italic">No details yet.</p>
                    )}
                  </div>
                </section>

                {/* Upcoming Live Music */}
                <section>
                  <SectionTitle>Upcoming Live Music</SectionTitle>
                  {upcomingShows.length === 0 ? (
                    <div className="bg-[#F5F0EC] rounded-2xl p-6 text-center">
                      <p className="text-charcoal/60 text-sm">No upcoming shows booked.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingShows.map(show => (
                        <div key={show.bookingId} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                          <div className="bg-teal/10 rounded-xl px-3 py-2 text-center shrink-0 min-w-[52px]">
                            <p className="text-teal text-[10px] font-black uppercase">{show.dateLabel.split(' ')[0]}</p>
                            <p className="text-teal text-xl font-black leading-tight">{show.dateLabel.split(' ')[2]?.replace(',', '')}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => router.push('/profile/' + show.musicianId)}
                              className="text-graphite font-bold text-sm hover:text-chestnut transition-colors text-left truncate block"
                            >
                              {show.musicianName}
                            </button>
                            <p className="text-charcoal/60 text-xs mt-0.5">{show.time}</p>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Past Shows */}
                <section>
                  <SectionTitle>Past Shows</SectionTitle>
                  {pastShows.length === 0 ? (
                    <div className="bg-[#F5F0EC] rounded-2xl p-6 text-center">
                      <p className="text-charcoal/60 text-sm">No past shows yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pastShows.map(show => (
                        <button
                          key={show.bookingId}
                          onClick={() => router.push('/profile/' + show.musicianId)}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
                        >
                          <div className="bg-chestnut/10 rounded-xl px-3 py-2 text-center shrink-0 min-w-[52px]">
                            <p className="text-chestnut text-[10px] font-black uppercase">{show.dateLabel.split(' ')[0]}</p>
                            <p className="text-chestnut text-xl font-black leading-tight">{show.dateLabel.split(' ')[2]?.replace(',', '')}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-graphite font-bold text-sm truncate">{show.musicianName}</p>
                            <p className="text-charcoal/60 text-xs mt-0.5">{show.dateLabel}</p>
                          </div>
                          <VerifiedBadge />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Reviews */}
                {ReviewsSection}
              </>
            )}

            {/* ======= FAN ======= */}
            {profile.user_type === 'fan' && (
              <>
                {profile.bio && (
                  <section>
                    <SectionTitle>About</SectionTitle>
                    <p className="text-charcoal text-sm leading-relaxed">{profile.bio}</p>
                  </section>
                )}
                <section>
                  <SectionTitle>Following</SectionTitle>
                  {followedProfiles.length === 0 ? (
                    <div className="bg-[#F5F0EC] rounded-2xl p-6 text-center">
                      <p className="text-charcoal/60 text-sm">Not following anyone yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {followedProfiles.map(fp => (
                        <button
                          key={fp.id}
                          onClick={() => router.push('/profile/' + fp.id)}
                          className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
                        >
                          <Avatar src={fp.avatar ?? ''} className="w-11 h-11 rounded-full shrink-0" textSize="text-xl" bg="bg-chestnut/10" />
                          <div className="flex-1 min-w-0">
                            <p className="text-graphite font-bold text-sm truncate">{fp.name}</p>
                            <p className="text-charcoal/60 text-xs capitalize">{fp.user_type}{fp.location ? ` · ${fp.location}` : ''}</p>
                          </div>
                          <svg className="w-4 h-4 text-charcoal/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

          </div>
        </div>
      </main>

      {/* ---- Review Modal ---- */}
      {reviewModalOpen && (
        <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Your Experience</p>
                <h3 className="text-snow text-xl font-black tracking-tight">Leave a Review</h3>
              </div>
              <button onClick={() => setReviewModalOpen(false)} className="text-snow/60 hover:text-snow transition-colors text-xl leading-none">✕</button>
            </div>
            <div className="p-6">
              <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-3">Rating</p>
              <div className="mb-5">
                <Stars rating={reviewRating} interactive onSelect={setReviewRating} />
              </div>
              <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
                Review <span className="text-charcoal/40 font-normal normal-case">(optional, max 500 chars)</span>
              </p>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value.slice(0, 500))}
                rows={4}
                placeholder={`Share your experience with ${displayName}…`}
                className="w-full bg-white rounded-xl px-4 py-3 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10 mb-1"
              />
              <p className="text-charcoal/40 text-xs text-right mb-5">{reviewText.length}/500</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewModalOpen(false)}
                  className="flex-1 bg-snow text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReview}
                  disabled={submittingReview}
                  className="flex-1 bg-chestnut text-snow py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {submittingReview ? 'Submitting…' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
