'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { milesBetween } from '@/lib/distance'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'
import { SkeletonProfilePageMusician, SkeletonProfilePageLight } from '@/components/Skeleton'
import { buildSocialUrl } from '@/lib/social-urls'
import { getVideoEmbed, getAudioEmbed, videoProviderLabel } from '@/lib/embeds'
import { gigStartEnd } from '@/lib/ics'
import InviteModal from '@/components/InviteModal'
import { ShareButton } from '@/components/ShareButton'
import {
  REVIEW_ASPECTS, REVIEW_TAGS, aspectAverages, ratingDistribution, topTags,
  type RevieweeType,
} from '@/lib/reviews'

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
  created_at: string
  performer_type: string | null
  band_members: number | null
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
  aspects: Record<string, number> | null
  tags: string[]
  reply: string | null
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
  musicianAvatar?: string
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

function toAbsoluteUrl(url: string): string {
  if (!url) return url
  return /^https?:\/\//.test(url) ? url : 'https://' + url
}

function dateFmt(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// ---- Shared sub-components ----

function Stars({ rating, interactive, onSelect, dark }: {
  rating: number; interactive?: boolean; onSelect?: (r: number) => void; dark?: boolean
}) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => interactive && onSelect?.(n)}
          className={`transition-transform ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}>
          <svg className={`w-5 h-5 ${n <= rating ? 'text-chestnut' : dark ? 'text-snow/20' : 'text-charcoal/20'}`} viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        </button>
      ))}
    </div>
  )
}

function VerifiedBadge({ dark }: { dark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-teal text-[10px] font-black px-2 py-0.5 rounded-full tracking-wide uppercase ${dark ? 'bg-teal/20' : 'bg-teal/10'}`}>
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Verified
    </span>
  )
}

// Social icon SVG paths
function SocialIcon({ type }: { type: 'instagram' | 'tiktok' | 'spotify' | 'youtube' | 'website' }) {
  if (type === 'instagram') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
  if (type === 'tiktok') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
  if (type === 'spotify') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  )
  if (type === 'youtube') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
      <path d="M23.495 6.205a3.007 3.007 0 00-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 00.527 6.205a31.247 31.247 0 00-.522 5.805 31.247 31.247 0 00.522 5.783 3.007 3.007 0 002.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 002.088-2.088 31.247 31.247 0 00.5-5.783 31.247 31.247 0 00-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
    </svg>
  )
}

// ---- Main Component ----

interface ReturnTo {
  partnerId: string
  partnerName: string
  partnerAvatar: string
}

export default function ProfilePage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.username as string

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const { toast } = useToast()
  const [viewer, setViewer] = useState<ViewerData | null>(null)
  const [viewerId, setViewerId] = useState('')
  const [returnTo, setReturnTo] = useState<ReturnTo | null>(null)

  const [pastGigs, setPastGigs] = useState<PastGig[]>([])
  const [upcomingShows, setUpcomingShows] = useState<ShowEntry[]>([])
  const [pastShows, setPastShows] = useState<ShowEntry[]>([])
  const [followedProfiles, setFollowedProfiles] = useState<FollowedProfile[]>([])

  const [reviews, setReviews] = useState<Review[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // A completed (past) confirmed gig between the two parties makes the viewer eligible to
  // review. myReviewId is set when the viewer has ALREADY reviewed this profile — they may
  // then edit that one review rather than leave another (one review per pair).
  const [eligibleBookingId, setEligibleBookingId] = useState<string | null>(null)
  const [myReviewId, setMyReviewId] = useState<string | null>(null)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewAspects, setReviewAspects] = useState<Record<string, number>>({})
  const [reviewTags, setReviewTags] = useState<string[]>([])
  const [submittingReview, setSubmittingReview] = useState(false)

  // Open the review composer with a clean slate (new review).
  const openReviewModal = () => {
    setReviewRating(5); setReviewText(''); setReviewAspects({}); setReviewTags([])
    setReviewModalOpen(true)
  }

  // Open the composer pre-filled with the viewer's existing review (edit mode).
  const openReviewEditor = () => {
    const mine = reviews.find(r => r.id === myReviewId)
    setReviewRating(mine?.rating ?? 5)
    setReviewText(mine?.review_text ?? '')
    setReviewAspects(mine?.aspects ?? {})
    setReviewTags(mine?.tags ?? [])
    setReviewModalOpen(true)
  }

  // Close the photo lightbox on Escape.
  useEffect(() => {
    if (!lightboxUrl) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxUrl])

  // Check if we navigated here from a messages conversation
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('profileReturnTo')
      if (stored) setReturnTo(JSON.parse(stored) as ReturnTo)
    } catch { /* ignore */ }
  }, [])

  const handleReturnToMessages = () => {
    if (!returnTo) return
    sessionStorage.setItem('drumup_open_msg', JSON.stringify({
      id: returnTo.partnerId,
      name: returnTo.partnerName,
      avatar: returnTo.partnerAvatar,
    }))
    sessionStorage.setItem('drumup_goto_messages', '1')
    sessionStorage.removeItem('profileReturnTo')
    setReturnTo(null)
    router.push('/dashboard')
  }

  const isOwnProfile = !!viewerId && viewerId === profile?.id
  const distance = profile && viewer?.latitude != null && viewer?.longitude != null
    && profile.latitude != null && profile.longitude != null
    ? milesBetween(viewer.latitude, viewer.longitude, profile.latitude, profile.longitude)
    : null

  useEffect(() => {
    const load = async () => {
      try {
      // Public profiles are viewable logged-out (shareable "Book me on Drum Up" links).
      // `user` is null for anonymous visitors; every viewer-dependent block below is guarded.
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user ?? null
      if (user) setViewerId(user.id)

      // NOTE: Never include legal_name in queries unless fetching the current user's own profile
      // or in server-side Stripe routes. legal_name is private.
      let vp: ViewerData | null = null
      if (user) {
        const { data: vpData, error: vpErr } = await supabase.from('profiles')
          .select('id, user_type, latitude, longitude').eq('id', user.id).maybeSingle()
        if (vpErr) throw vpErr
        if (vpData) { vp = vpData as ViewerData; setViewer(vp) }
      }

      // NOTE: Never include legal_name here — this is a public query readable by any logged-in user.
      // legal_name is private and only allowed in the user's own settings page or server-side Stripe routes.
      const publicColumns = 'id, username, full_name, avatar_url, bio, user_type, location_text, latitude, longitude, instagram_url, tiktok_url, spotify_url, youtube_url, website, role_metadata, created_at, performer_type, band_members, deleted_at'
      const q = UUID_RE.test(slug)
        ? supabase.from('profiles').select(publicColumns).eq('id', slug)
        : supabase.from('profiles').select(publicColumns).eq('username', slug)
      const { data: pd, error: pdErr } = await q.maybeSingle()
      if (pdErr) throw pdErr
      setLoading(false)
      // Treat deleted/anonymized accounts as not found.
      if (!pd || (pd as { deleted_at?: string | null }).deleted_at) return
      setProfile(pd as ProfileData)

      const pid = pd.id

      // Track profile view BEFORE the canonical redirect below. Every in-app link
      // navigates by UUID (router.push('/profile/' + id)), so the UUID→username
      // redirect's early return used to skip this entirely and no view was ever recorded.
      // Upserts one row per viewer; re-visits (incl. the redirected canonical load)
      // just refresh viewed_at for accurate 7d/30d windows.
      if (user && user.id !== pid) {
        const { error: viewErr } = await supabase.from('profile_views').upsert(
          { profile_id: pid, viewer_id: user.id, viewed_at: new Date().toISOString() },
          { onConflict: 'profile_id,viewer_id' }
        )
        if (viewErr) console.error('Failed to record profile view:', viewErr.message)
      }

      // Redirect UUID-based URLs to the canonical /profile/[username]
      if (UUID_RE.test(slug) && pd.username) {
        router.replace('/profile/' + pd.username)
        return
      }

      // Follower counts are public (anon RLS); the viewer's own follow-state needs a session.
      const [{ count: fc }, { count: fng }] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', pid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', pid),
      ])
      setFollowersCount(fc ?? 0)
      setFollowingCount(fng ?? 0)
      if (user) {
        const { data: frow } = await supabase.from('follows').select('id')
          .eq('follower_id', user.id).eq('following_id', pid).maybeSingle()
        setIsFollowing(!!frow)
      }

      const today = new Date().toISOString().slice(0, 10)

      // Gig history reads the bookings table, which carries payment data and is not
      // exposed to anon — so it only loads for signed-in viewers.
      if (user && pd.user_type === 'musician') {
        const { data: bks } = await supabase
          .from('confirmed_gigs').select('id, availability_id, restaurant_id')
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
                bookingId: b.id, date: a.date, dateLabel: dateFmt(a.date),
                venueName: (m.venue_name as string | undefined) ?? v?.full_name ?? 'Venue',
                venueId: b.restaurant_id,
              }
            })
            .sort((a, b) => b.date.localeCompare(a.date))
          setPastGigs(gigs)
        }
      } else if (pd.user_type === 'restaurant') {
        const { data: bks } = await supabase
          .from('confirmed_gigs').select('id, musician_id, availability_id')
          .eq('restaurant_id', pid).eq('status', 'confirmed')
        if (bks && bks.length > 0) {
          const aIds = bks.map(b => b.availability_id)
          const mIds = [...new Set(bks.map(b => b.musician_id))]
          const [{ data: avails }, { data: musicians }] = await Promise.all([
            supabase.from('availability').select('id, date, start_time, end_time').in('id', aIds),
            supabase.from('profiles').select('id, full_name, avatar_url').in('id', mIds),
          ])
          const aMap = new Map((avails ?? []).map(a => [a.id, a]))
          const mMap = new Map((musicians ?? []).map(m => [m.id, m]))
          const upcoming: ShowEntry[] = []
          const past: ShowEntry[] = []
          bks.forEach(b => {
            const a = aMap.get(b.availability_id); if (!a) return
            const mu = mMap.get(b.musician_id)
            const entry: ShowEntry = {
              bookingId: b.id, date: a.date, dateLabel: dateFmt(a.date),
              time: `${fmtTime(a.start_time?.slice(0, 5) ?? '')} – ${fmtTime(a.end_time?.slice(0, 5) ?? '')}`,
              musicianName: mu?.full_name ?? 'Musician', musicianId: b.musician_id,
              musicianAvatar: (mu as unknown as { avatar_url?: string })?.avatar_url ?? '',
            }
            if (a.date >= today) upcoming.push(entry); else past.push(entry)
          })
          setUpcomingShows(upcoming.sort((a, b) => a.date.localeCompare(b.date)))
          setPastShows(past.sort((a, b) => b.date.localeCompare(a.date)))
        }
      } else if (pd.user_type === 'fan') {
        const { data: fws } = await supabase.from('follows').select('following_id').eq('follower_id', pid)
        if (fws && fws.length > 0) {
          const ids = fws.map(f => f.following_id)
          const { data: fps } = await supabase
            .from('profiles').select('id, full_name, avatar_url, user_type, location_text').in('id', ids)
          setFollowedProfiles((fps ?? []).map(p => ({
            id: p.id, name: p.full_name ?? 'User', avatar: p.avatar_url ?? null,
            user_type: p.user_type, location: p.location_text ?? null,
          })))
        }
      }

      const { data: rws, error: rwErr } = await supabase
        .from('reviews').select('id, rating, review_text, created_at, verified, reviewer_id, booking_id, aspects, tags, reply')
        .eq('reviewee_id', pid).order('created_at', { ascending: false })
      if (!rwErr && rws && rws.length > 0) {
        const rIds2 = [...new Set(rws.map(r => r.reviewer_id))]
        const { data: rProfs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', rIds2)
        const rpMap = new Map((rProfs ?? []).map(p => [p.id, p]))
        setReviews(rws.map(r => {
          const rp = rpMap.get(r.reviewer_id)
          const rawAspects = (r as { aspects?: unknown }).aspects
          const rawTags = (r as { tags?: unknown }).tags
          return {
            id: r.id, rating: r.rating, review_text: r.review_text ?? null,
            created_at: r.created_at, verified: r.verified,
            reviewer_name: rp?.full_name ?? 'Anonymous',
            reviewer_avatar: rp?.avatar_url ?? null, reviewer_id: r.reviewer_id,
            aspects: rawAspects && typeof rawAspects === 'object' ? rawAspects as Record<string, number> : null,
            tags: Array.isArray(rawTags) ? rawTags as string[] : [],
            reply: (r as { reply?: string | null }).reply ?? null,
          }
        }))
      }

      if (user && user.id !== pid && pd.user_type !== 'fan' && vp?.user_type !== 'fan') {
        const isRestViewer = vp?.user_type === 'restaurant' && pd.user_type === 'musician'
        const isMusiViewer = vp?.user_type === 'musician' && pd.user_type === 'restaurant'
        if (isRestViewer || isMusiViewer) {
          // Has the viewer already reviewed this profile? If so they edit that one.
          const { data: existRev } = await supabase.from('reviews').select('id')
            .eq('reviewer_id', user.id).eq('reviewee_id', pid).maybeSingle()
          if (existRev) setMyReviewId(existRev.id)

          // Eligible to review only once a confirmed gig between the two has actually
          // finished (its end time is in the past — cross-midnight aware via gigStartEnd).
          let bq = supabase.from('confirmed_gigs').select('id, availability_id').eq('status', 'confirmed')
          bq = isRestViewer
            ? bq.eq('restaurant_id', user.id).eq('musician_id', pid)
            : bq.eq('musician_id', user.id).eq('restaurant_id', pid)
          const { data: ebs } = await bq
          if (ebs && ebs.length > 0) {
            const aIds = ebs.map(b => b.availability_id)
            const { data: avs } = await supabase
              .from('availability').select('id, date, start_time, end_time').in('id', aIds)
            const avMap = new Map((avs ?? []).map(a => [a.id, a]))
            const nowD = new Date()
            const completed = ebs.find(b => {
              const a = avMap.get(b.availability_id)
              if (!a?.date) return false
              return gigStartEnd(a.date, a.start_time, a.end_time).end < nowD
            })
            if (completed) setEligibleBookingId(completed.id)
          }
        }
      }
      } catch (err) {
        console.error('Failed to load profile:', err)
        setLoadError('Could not load this profile. Please try again.')
        setLoading(false)
      }
    }
    load()
  }, [slug, router])

  // When a dashboard "Review" CTA routes here, auto-open the composer once eligibility has
  // resolved — in edit mode if they've already reviewed, otherwise as a fresh review.
  useEffect(() => {
    if (!eligibleBookingId && !myReviewId) return
    try {
      if (sessionStorage.getItem('drumup_open_review') === '1') {
        sessionStorage.removeItem('drumup_open_review')
        if (myReviewId) openReviewEditor()
        else openReviewModal()
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleBookingId, myReviewId])

  const handleToggleFollow = async () => {
    if (!viewerId) { router.push('/auth/signup'); return }
    if (!profile) return
    setFollowLoading(true)
    try {
      if (isFollowing) {
        const { error } = await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', profile.id)
        if (error) throw error
        setIsFollowing(false); setFollowersCount(c => c - 1)
      } else {
        const { error } = await supabase.from('follows').insert({ follower_id: viewerId, following_id: profile.id })
        if (error) throw error
        setIsFollowing(true); setFollowersCount(c => c + 1)
      }
    } catch (err) {
      console.error('Follow toggle failed:', err)
      toast.error('Could not update follow. Please try again.')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleMessage = () => {
    if (!viewerId) { router.push('/auth/signup'); return }
    if (!profile) return
    const meta = (profile.role_metadata ?? {}) as Record<string, unknown>
    const name = profile.user_type === 'restaurant'
      ? ((meta.venue_name as string | undefined) ?? profile.full_name ?? 'Venue')
      : (profile.full_name ?? 'User')
    sessionStorage.setItem('drumup_open_msg', JSON.stringify({
      id: profile.id, name, avatar: profile.avatar_url ?? '',
    }))
    sessionStorage.setItem('drumup_goto_messages', '1')
    router.push('/dashboard')
  }

  const handleSubmitReview = async () => {
    if (!viewerId || !profile) return
    if (!myReviewId && !eligibleBookingId) return
    setSubmittingReview(true)
    try {
      const cleanAspects = Object.fromEntries(
        Object.entries(reviewAspects).filter(([, v]) => v > 0),
      )
      const aspectsForState = Object.keys(cleanAspects).length > 0 ? cleanAspects : null
      const textValue = reviewText.trim() || null

      if (myReviewId) {
        // Edit the viewer's existing review (RLS: reviewer can update their own row).
        const { error } = await supabase.from('reviews').update({
          rating: reviewRating, review_text: textValue, aspects: cleanAspects, tags: reviewTags,
        }).eq('id', myReviewId)
        if (error) throw error
        setReviews(prev => prev.map(r => r.id === myReviewId
          ? { ...r, rating: reviewRating, review_text: textValue, aspects: aspectsForState, tags: reviewTags }
          : r))
        toast.success('Review updated!')
      } else {
        // First review for this pair.
        const { data: inserted, error } = await supabase.from('reviews').insert({
          reviewer_id: viewerId, reviewee_id: profile.id, booking_id: eligibleBookingId,
          rating: reviewRating, review_text: textValue, verified: true,
          aspects: cleanAspects, tags: reviewTags,
        }).select('id').single()
        if (error) throw error
        setMyReviewId(inserted.id)
        setReviews(prev => [{
          id: inserted.id, rating: reviewRating, review_text: textValue,
          created_at: new Date().toISOString(), verified: true,
          reviewer_name: 'You', reviewer_avatar: null, reviewer_id: viewerId,
          aspects: aspectsForState, tags: reviewTags, reply: null,
        }, ...prev])
        toast.success('Review submitted!')
      }
      setReviewModalOpen(false)
    } catch (err) {
      console.error('Review submit failed:', err)
      toast.error('Could not submit your review. Please try again.')
    } finally {
      setSubmittingReview(false)
    }
  }

  // ---- Loading ----
  if (loading) {
    return <SkeletonProfilePageMusician />
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-graphite">
        <div className="w-16 h-16 bg-chestnut/20 rounded-2xl flex items-center justify-center text-chestnut mb-4 mx-auto"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
        <p className="text-snow font-black text-lg mb-1">Something went wrong</p>
        <p className="text-snow/60 text-sm mb-6">{loadError}</p>
        <button onClick={() => window.location.reload()} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
          Try Again
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#E8E4E0' }}>
        <div className="bg-white rounded-3xl p-10 shadow-xl text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-chestnut/10 rounded-2xl flex items-center justify-center text-chestnut mb-4 mx-auto"><svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
          <h1 className="text-graphite text-2xl font-black mb-2">Profile not found</h1>
          <p className="text-charcoal text-sm mb-6 leading-relaxed">This profile doesn&apos;t exist — but the music plays on.</p>
          <button onClick={() => router.back()} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
            ← Go Back
          </button>
        </div>
      </div>
    )
  }

  // ---- Derived ----
  const meta = (profile.role_metadata ?? {}) as Record<string, unknown>
  const bannerUrl = (meta.banner_url as string | undefined) ?? ''
  const genres = Array.isArray(meta.genres) ? meta.genres as string[] : []
  const instruments = (meta.instruments as string | undefined) ?? ''
  const soloOrBand = (meta.solo_or_band as string | undefined) ?? ''
  const yearsPerforming = (meta.years_performing as string | undefined) ?? ''
  const performerType = profile.performer_type ?? ''
  const bandMembers = profile.band_members ?? null
  const venueName = (meta.venue_name as string | undefined) ?? profile.full_name ?? ''

  // Showcase media (musicians)
  const videos: { url: string; title: string }[] = Array.isArray(meta.videos)
    ? (meta.videos as unknown[]).map(v => {
        const o = (v ?? {}) as Record<string, unknown>
        return { url: String(o.url ?? ''), title: String(o.title ?? '') }
      }).filter(v => v.url)
    : []
  const photos: string[] = Array.isArray(meta.photos)
    ? (meta.photos as unknown[]).map(String).filter(u => /^https?:\/\//.test(u))
    : []
  const audioUrl = (meta.audio_url as string | undefined) ?? ''
  const audioEmbed = getAudioEmbed(audioUrl) ?? (profile.spotify_url ? getAudioEmbed(profile.spotify_url) : null)
  const repertoire = (meta.repertoire as string | undefined) ?? ''
  const setLength = (meta.set_length as string | undefined) ?? ''
  const ownPa = meta.own_pa === true
  const payRange = (meta.pay_range as string | undefined) ?? ''
  const stageNotes = (meta.stage_notes as string | undefined) ?? ''
  const hasLogistics = !!(setLength || ownPa || payRange || stageNotes)
  const capacity = (meta.capacity as string | undefined) ?? ''
  const cuisineType = (meta.cuisine_type as string | undefined) ?? ''
  const musicNights = Array.isArray(meta.music_nights) ? meta.music_nights as string[] : []
  const displayName = profile.user_type === 'restaurant' ? venueName : (profile.full_name ?? 'User')
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/profile/${profile.username ?? profile.id}`
    : ''
  const shareText = profile.user_type === 'musician'
    ? `Check out ${displayName} on Drum Up`
    : `Check out ${displayName} on Drum Up`
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null
  const revieweeType: RevieweeType | null = profile.user_type === 'musician'
    ? 'musician' : profile.user_type === 'restaurant' ? 'restaurant' : null
  // Featured clip = first gallery video, falling back to the legacy youtube_url field.
  const galleryVideos = videos.length > 0
    ? videos
    : (profile.youtube_url ? [{ url: profile.youtube_url, title: '' }] : [])
  const featuredVideo = galleryVideos[0] ?? null
  const featuredEmbed = featuredVideo ? getVideoEmbed(featuredVideo.url) : null
  const otherVideos = galleryVideos.slice(1)
  const hasAnyMedia = galleryVideos.length > 0 || !!audioEmbed || !!profile.tiktok_url
  const memberSince = new Date(profile.created_at).getFullYear()

  // ==============================
  // MUSICIAN PROFILE — Dark/Spotify
  // ==============================

  if (profile.user_type === 'musician') {
    return (
      <div className="min-h-screen" style={{ background: '#2A2A2A' }}>

        {/* Floating nav — back left, DU logo right */}
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 pt-4 flex justify-between items-start pointer-events-auto">
            {returnTo ? (
              <button
                onClick={handleReturnToMessages}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-chestnut"
                style={{ background: 'rgba(42,42,42,0.80)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,127,65,0.35)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Messages
              </button>
            ) : (
              <button onClick={() => router.back()}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(42,42,42,0.80)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <svg className="w-4 h-4 text-snow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="rounded-xl p-1.5" style={{ background: 'rgba(42,42,42,0.80)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            </div>
          </div>
        </div>

        {/* Hero — full-bleed photo, name overlaid at bottom */}
        <section className="relative" style={{ minHeight: '56vh' }}>
          {(() => {
            const heroSrc = /^https?:\/\//.test(bannerUrl) ? bannerUrl
              : (profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)) ? profile.avatar_url
              : null
            return heroSrc ? (
              <img src={heroSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #DC7F41 0%, #2A2A2A 100%)' }} />
            )
          })()}
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(42,42,42,0.45) 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 h-3/4" style={{ background: 'linear-gradient(to bottom, transparent, rgba(42,42,42,0.88) 55%, #2A2A2A 100%)' }} />

          <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 max-w-2xl mx-auto w-full">
            <h1 className="text-snow font-black leading-none mb-1.5" style={{ fontSize: 'clamp(2.5rem, 8vw, 3.5rem)' }}>
              {displayName}
            </h1>
            {profile.location_text && (
              <p className="text-snow/55 text-sm mb-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {profile.location_text}
                {distance != null && viewer?.user_type === 'restaurant' && (
                  <span className="text-chestnut font-semibold ml-1">· {Math.round(distance)} mi away</span>
                )}
              </p>
            )}
            {(genres.length > 0 || instruments || performerType) && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {performerType === 'solo' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(108,154,139,0.25)', color: '#6C9A8B' }}><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>Solo Artist</span>
                )}
                {performerType === 'band' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(220,127,65,0.2)', color: '#DC7F41' }}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m11.9 12.1 4.514-4.514"/><path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414L14 10l1.5 1.5"/><path d="m13.5 8.5 1.5 1.5"/><path d="M9.2 14.8a3 3 0 0 1-3.9.4l-.3-.3a3 3 0 0 1 .4-3.9l5.6-5.6a3 3 0 0 1 3.9-.4l.3.3a3 3 0 0 1-.4 3.9z"/></svg>Band{bandMembers ? ` · ${bandMembers} members` : ''}
                  </span>
                )}
                {genres.map(g => (
                  <span key={g} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(108,154,139,0.2)', color: '#6C9A8B' }}>{g}</span>
                ))}
                {instruments.split(',').filter(Boolean).map(inst => (
                  <span key={inst} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(220,127,65,0.2)', color: '#DC7F41' }}>{inst.trim()}</span>
                ))}
              </div>
            )}
            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap mb-4">
              {isOwnProfile ? (
                <button onClick={() => router.push('/settings')}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#FCFAF9', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  Edit Profile
                </button>
              ) : (
                <>
                  {viewer?.user_type === 'restaurant' && profile?.user_type === 'musician' && (
                    <button
                      onClick={() => setInviteModalOpen(true)}
                      className="bg-chestnut text-snow px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                    >
                      Invite to Gig
                    </button>
                  )}
                  <button onClick={handleToggleFollow} disabled={followLoading}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                    style={isFollowing
                      ? { background: 'rgba(108,154,139,0.2)', color: '#6C9A8B', border: '1px solid rgba(108,154,139,0.35)' }
                      : { background: '#DC7F41', color: '#FCFAF9' }}>
                    {followLoading ? '…' : isFollowing ? '✓ Following' : viewerId ? '+ Follow' : 'Sign up to follow'}
                  </button>
                  <button onClick={handleMessage}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: 'rgba(255,255,255,0.10)', color: '#FCFAF9', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                    Message
                  </button>
                </>
              )}
              <ShareButton url={shareUrl} title={`${displayName} · Drum Up`} text={shareText}
                label={isOwnProfile ? 'Copy your link' : 'Share'}
                className="px-5 py-2.5 rounded-xl text-sm bg-white/10 text-snow border border-white/20 backdrop-blur" />
            </div>
            {/* Platform pill links — scrollable branded row */}
            {(profile.instagram_url || profile.tiktok_url || profile.spotify_url || profile.youtube_url || profile.website) && (
              <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                {profile.instagram_url && (
                  <a href={buildSocialUrl('instagram', profile.instagram_url)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(193,53,232,0.22)', color: '#f0abfc', border: '1px solid rgba(193,53,232,0.40)' }}>
                    <SocialIcon type="instagram" />Instagram
                  </a>
                )}
                {profile.tiktok_url && (
                  <a href={buildSocialUrl('tiktok', profile.tiktok_url)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#FCFAF9', border: '1px solid rgba(255,255,255,0.22)' }}>
                    <SocialIcon type="tiktok" />TikTok
                  </a>
                )}
                {profile.spotify_url && (
                  <a href={buildSocialUrl('spotify', profile.spotify_url)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(29,185,84,0.22)', color: '#4ade80', border: '1px solid rgba(29,185,84,0.38)' }}>
                    <SocialIcon type="spotify" />Spotify
                  </a>
                )}
                {profile.youtube_url && (
                  <a href={buildSocialUrl('youtube', profile.youtube_url)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(255,0,0,0.18)', color: '#f87171', border: '1px solid rgba(255,0,0,0.32)' }}>
                    <SocialIcon type="youtube" />YouTube
                  </a>
                )}
                {profile.website && (
                  <a href={buildSocialUrl('website', profile.website)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 hover:opacity-80 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.10)', color: '#FCFAF9', border: '1px solid rgba(255,255,255,0.16)' }}>
                    <SocialIcon type="website" />Website
                  </a>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Stats strip — dark */}
        <section style={{ background: '#333333', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="max-w-2xl mx-auto grid grid-cols-4 divide-x divide-snow/10 py-5">
            {[
              { value: pastGigs.length, label: 'Gigs Played' },
              { value: followersCount, label: 'Followers' },
              { value: avgRating != null ? <span className="inline-flex items-center gap-1">{avgRating.toFixed(1)}<svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span> : '—', label: 'Avg Rating' },
              { value: memberSince, label: 'Member Since' },
            ].map(s => (
              <div key={s.label} className="text-center px-3">
                <p className="text-chestnut text-2xl font-black leading-none">{s.value}</p>
                <p className="text-snow/40 text-[10px] font-semibold uppercase tracking-wide mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-5 pb-16">
          <section className="py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-4">· About</p>
            {(profile.bio || performerType || soloOrBand || yearsPerforming || instruments) ? (
              <div className="space-y-4">
                {profile.bio && <p className="text-snow/80 text-base leading-relaxed">{profile.bio}</p>}
                <div className="flex flex-wrap gap-6">
                  {(performerType || soloOrBand) && (
                    <div>
                      <p className="text-snow/30 text-[10px] font-semibold uppercase tracking-wide">Format</p>
                      <p className="text-snow font-bold mt-0.5">
                        {performerType === 'solo' ? 'Solo Artist'
                          : performerType === 'band' ? `Band${bandMembers ? ` (${bandMembers})` : ''}`
                          : soloOrBand}
                      </p>
                    </div>
                  )}
                  {yearsPerforming && <div><p className="text-snow/30 text-[10px] font-semibold uppercase tracking-wide">Experience</p><p className="text-snow font-bold mt-0.5">{yearsPerforming} yrs</p></div>}
                  {instruments && <div><p className="text-snow/30 text-[10px] font-semibold uppercase tracking-wide">Instruments</p><p className="text-snow font-bold mt-0.5">{instruments}</p></div>}
                </div>
              </div>
            ) : (
              <p className="text-snow/30 italic text-sm">No details yet.</p>
            )}
          </section>

          <section className="py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-5">· Watch &amp; Listen</p>

            {/* Featured clip */}
            {featuredVideo && (featuredEmbed ? (
              <div className="mb-2">
                <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <iframe src={featuredEmbed} className="w-full h-full" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={featuredVideo.title || 'Featured performance'} />
                </div>
                {featuredVideo.title && <p className="text-snow/55 text-xs mt-2">{featuredVideo.title}</p>}
              </div>
            ) : (
              <a href={toAbsoluteUrl(featuredVideo.url)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-2xl group mb-2"
                style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-12 h-12 bg-chestnut rounded-xl flex items-center justify-center shrink-0 text-snow">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-snow font-bold text-sm group-hover:text-chestnut transition-colors">{featuredVideo.title || `Watch on ${videoProviderLabel(featuredVideo.url)}`}</p>
                  <p className="text-snow/40 text-xs truncate mt-0.5">{featuredVideo.url}</p>
                </div>
                <svg className="w-4 h-4 text-snow/20 group-hover:text-chestnut transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            ))}

            {/* Additional clips */}
            {otherVideos.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {otherVideos.map((v, i) => {
                  const e = getVideoEmbed(v.url)
                  return e ? (
                    <div key={i}>
                      <div className="rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: '16/9', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <iframe src={e} className="w-full h-full" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={v.title || `Performance clip ${i + 2}`} />
                      </div>
                      {v.title && <p className="text-snow/50 text-xs mt-1.5">{v.title}</p>}
                    </div>
                  ) : (
                    <a key={i} href={toAbsoluteUrl(v.url)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl group" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-9 h-9 rounded-lg bg-chestnut/20 text-chestnut flex items-center justify-center shrink-0"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg></div>
                      <div className="min-w-0">
                        <p className="text-snow text-xs font-bold truncate group-hover:text-chestnut transition-colors">{v.title || `Watch on ${videoProviderLabel(v.url)}`}</p>
                        <p className="text-snow/40 text-[10px] truncate">{videoProviderLabel(v.url)}</p>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Audio player (Spotify / SoundCloud) */}
            {audioEmbed && (
              <div className="mt-4 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <iframe src={audioEmbed.src} className="w-full block" style={{ height: audioEmbed.height }} loading="lazy" allow="encrypted-media; clipboard-write" title="Music player" />
              </div>
            )}

            {/* Link-out cards for platforms we can't embed inline */}
            {(profile.tiktok_url || (profile.spotify_url && !audioEmbed)) && (
              <div className={`grid gap-3 mt-4 ${profile.tiktok_url && profile.spotify_url && !audioEmbed ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {profile.spotify_url && !audioEmbed && (
                  <a href={buildSocialUrl('spotify', profile.spotify_url)} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl group hover:opacity-90 transition-opacity"
                    style={{ background: 'rgba(29,185,84,0.14)', border: '1px solid rgba(29,185,84,0.28)' }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-snow shadow-sm" style={{ background: '#1DB954' }}><SocialIcon type="spotify" /></div>
                    <div className="text-center"><p className="text-snow font-bold text-sm">Listen on Spotify</p><p className="text-snow/40 text-[11px] mt-0.5">Stream music</p></div>
                  </a>
                )}
                {profile.tiktok_url && (
                  <a href={buildSocialUrl('tiktok', profile.tiktok_url)} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center gap-3 p-5 rounded-2xl group hover:opacity-90 transition-opacity"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-snow shadow-sm bg-black"><SocialIcon type="tiktok" /></div>
                    <div className="text-center"><p className="text-snow font-bold text-sm">Watch on TikTok</p><p className="text-snow/40 text-[11px] mt-0.5">Short-form videos</p></div>
                  </a>
                )}
              </div>
            )}

            {/* Empty state */}
            {!hasAnyMedia && (
              <div className="p-8 rounded-2xl text-center" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(220,127,65,0.15)', color: '#DC7F41' }}>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                </div>
                <p className="text-snow/60 font-bold text-sm mb-1">No media yet</p>
                <p className="text-snow/30 text-xs">{isOwnProfile ? 'Add performance clips and a music player in settings.' : 'This artist hasn’t added clips yet.'}</p>
              </div>
            )}
          </section>

          {/* Repertoire */}
          {repertoire && (
            <section className="py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-4">· Repertoire</p>
              <p className="text-snow/80 text-sm leading-relaxed whitespace-pre-line">{repertoire}</p>
            </section>
          )}

          {/* What I bring */}
          {hasLogistics && (
            <section className="py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-5">· What I Bring</p>
              <div className="flex flex-wrap gap-3 mb-3">
                {setLength && (
                  <div className="rounded-xl px-4 py-3" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-snow/30 text-[10px] font-semibold uppercase tracking-wide">Set length</p>
                    <p className="text-snow font-bold mt-0.5 text-sm">{setLength}</p>
                  </div>
                )}
                {payRange && (
                  <div className="rounded-xl px-4 py-3" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-snow/30 text-[10px] font-semibold uppercase tracking-wide">Typical pay</p>
                    <p className="text-snow font-bold mt-0.5 text-sm">{payRange}</p>
                  </div>
                )}
                {ownPa && (
                  <div className="rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: 'rgba(108,154,139,0.16)', border: '1px solid rgba(108,154,139,0.3)' }}>
                    <svg className="w-4 h-4 text-teal shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    <p className="text-snow font-bold text-sm">Brings own PA / sound</p>
                  </div>
                )}
              </div>
              {stageNotes && <p className="text-snow/70 text-sm leading-relaxed whitespace-pre-line">{stageNotes}</p>}
            </section>
          )}

          {/* Photos */}
          {photos.length > 0 && (
            <section className="py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-5">· Photos</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <button key={i} type="button" onClick={() => setLightboxUrl(url)}
                    className="block rounded-xl overflow-hidden cursor-zoom-in" style={{ aspectRatio: '1/1', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <img src={url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" loading="lazy" />
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="py-8 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-5">· Live History</p>
            {pastGigs.length === 0 ? (
              <div className="p-8 rounded-2xl text-center" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 mx-auto" style={{ background: 'rgba(108,154,139,0.25)', color: '#6C9A8B' }}><svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg></div>
                <p className="text-snow/60 font-bold text-sm mb-1">No gigs yet</p>
                <p className="text-snow/30 text-xs">Their story starts somewhere.</p>
              </div>
            ) : (
              <div>
                {pastGigs.map((gig, idx) => (
                  <button key={gig.bookingId} onClick={() => router.push('/profile/' + gig.venueId)}
                    className="w-full flex items-center justify-between py-4 text-left hover:opacity-75 transition-opacity"
                    style={{ borderBottom: idx < pastGigs.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <div>
                      <p className="text-snow font-semibold text-sm">{gig.venueName}</p>
                      <p className="text-snow/40 text-xs mt-0.5">{gig.dateLabel}</p>
                    </div>
                    <VerifiedBadge dark />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="py-8">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-2">· Reviews</p>
                {avgRating != null && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-chestnut text-3xl font-black">{avgRating.toFixed(1)}<svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>
                    <span className="text-snow/40 text-sm">({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
                  </div>
                )}
              </div>
              {myReviewId ? (
                <button onClick={openReviewEditor}
                  className="border border-chestnut/50 text-chestnut px-4 py-2 rounded-xl text-sm font-bold hover:bg-chestnut/10 transition-colors">
                  Edit your review
                </button>
              ) : eligibleBookingId && (
                <button onClick={openReviewModal}
                  className="border border-chestnut/50 text-chestnut px-4 py-2 rounded-xl text-sm font-bold hover:bg-chestnut/10 transition-colors">
                  + Leave a Review
                </button>
              )}
            </div>
            {revieweeType && reviews.length > 0 && avgRating != null && (
              <div className="mb-4">
                <RatingSummary reviews={reviews} revieweeType={revieweeType} avgRating={avgRating} dark />
              </div>
            )}
            {reviews.length === 0 ? (
              <div className="p-6 rounded-2xl text-center" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-snow/30 text-sm">No reviews yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-2xl p-4" style={{ background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-3 mb-2">
                      <Avatar src={r.reviewer_avatar ?? ''} className="w-9 h-9 rounded-full shrink-0" textSize="text-sm" bg="bg-chestnut/20" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                          <p className="text-snow font-bold text-sm">{r.reviewer_name}</p>
                          <div className="flex items-center gap-2">
                            {r.verified && <VerifiedBadge dark />}
                            <span className="text-snow/30 text-xs">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                          </div>
                        </div>
                        <Stars rating={r.rating} dark />
                      </div>
                    </div>
                    {r.review_text && <p className="text-snow/70 text-sm leading-relaxed pl-12">{r.review_text}</p>}
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-12 mt-2">
                        {r.tags.map(t => (
                          <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(108,154,139,0.18)', color: '#6C9A8B' }}>{t}</span>
                        ))}
                      </div>
                    )}
                    {r.reply && (
                      <div className="ml-12 mt-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(108,154,139,0.10)', borderLeft: '2px solid #6C9A8B' }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#6C9A8B' }}>Response from {displayName}</p>
                        <p className="text-snow/70 text-sm leading-relaxed">{r.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {reviewModalOpen && revieweeType && (
          <ReviewModal displayName={displayName} revieweeType={revieweeType} reviewRating={reviewRating} reviewText={reviewText}
            aspects={reviewAspects} tags={reviewTags} submitting={submittingReview} editing={!!myReviewId} onClose={() => setReviewModalOpen(false)}
            onRating={setReviewRating} onText={setReviewText}
            onAspect={(k, v) => setReviewAspects(p => ({ ...p, [k]: v }))}
            onToggleTag={t => setReviewTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
            onSubmit={handleSubmitReview} />
        )}

        {inviteModalOpen && profile && (
          <InviteModal
            musicianId={profile.id}
            musicianName={displayName}
            onClose={() => setInviteModalOpen(false)}
            onSuccess={() => {
              setInviteModalOpen(false)
              toast.success(`Invite sent to ${displayName}! They'll be notified to accept or decline.`)
            }}
          />
        )}

        {lightboxUrl && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
            style={{ background: 'rgba(20,20,20,0.92)', backdropFilter: 'blur(4px)' }}
            onClick={() => setLightboxUrl(null)}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setLightboxUrl(null)}
              aria-label="Close"
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-snow text-2xl leading-none"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              ×
            </button>
            <img
              src={lightboxUrl}
              alt=""
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    )
  }

  // ==============================
  // RESTAURANT PROFILE — Warm/Editorial
  // ==============================

  if (profile.user_type === 'restaurant') {
    const tonightShows = upcomingShows.filter(s => s.date === new Date().toISOString().slice(0, 10))
    const tonight = tonightShows.length > 0
    const restaurantBg = 'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(220,127,65,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(108,154,139,0.08), transparent 70%), #E8E4E0'

    return (
      <div className="min-h-screen" style={{ background: restaurantBg }}>

        {/* Floating nav — back left, DU logo right */}
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="max-w-2xl mx-auto px-4 pt-4 flex justify-between items-start pointer-events-auto">
            {returnTo ? (
              <button
                onClick={handleReturnToMessages}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-chestnut"
                style={{ background: 'rgba(232,228,224,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,127,65,0.35)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Messages
              </button>
            ) : (
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(232,228,224,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,127,65,0.20)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
              >
                <svg className="w-4 h-4 text-graphite" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div
              className="rounded-xl p-1.5"
              style={{ background: 'rgba(232,228,224,0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,127,65,0.20)', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
            >
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            </div>
          </div>
        </div>

        {/* Hero — tall gradient strip (or banner photo) with venue name overlaid */}
        <div className="relative" style={{ height: '56vw', maxHeight: 260, minHeight: 200 }}>
          {/^https?:\/\//.test(bannerUrl) ? (
            <>
              <img src={bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(30,15,5,0.55) 55%, rgba(20,10,0,0.82) 100%)' }} />
            </>
          ) : (
            <>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #DC7F41 0%, #3D2419 55%, #2A1A0A 100%)' }} />
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.07] select-none pointer-events-none text-snow"><svg className="w-36 h-36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div>
            </>
          )}
          {/* Bottom fade to page bg */}
          <div className="absolute inset-x-0 bottom-0 h-20" style={{ background: 'linear-gradient(to bottom, transparent, #E8E4E0)' }} />
          {/* Live tonight badge */}
          {tonight && (
            <div className="absolute top-16 right-4 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-snow text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-snow animate-pulse inline-block" />
              Live Tonight
            </div>
          )}
          {/* Venue name at bottom of hero */}
          <div className="absolute bottom-6 left-5 right-5">
            <h1 className="text-snow text-3xl font-black tracking-tight leading-tight drop-shadow-sm">{displayName}</h1>
            {profile.location_text && (
              <p className="text-snow/70 text-sm flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {profile.location_text}
              </p>
            )}
          </div>
        </div>

        {/* Avatar + actions row, overlapping hero bottom */}
        <div className="max-w-2xl mx-auto px-5 -mt-6 flex items-end justify-between mb-4 relative z-10">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-lg"
            style={{ border: '2.5px solid #E8E4E0' }}
          >
            {profile.avatar_url && /^https?:\/\//.test(profile.avatar_url) ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-snow text-2xl font-black" style={{ background: 'linear-gradient(135deg, #DC7F41, #3D2419)' }}>
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex gap-2 pb-1">
            {isOwnProfile ? (
              <button
                onClick={() => router.push('/settings')}
                className="bg-graphite text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
              >
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-sm ${
                    isFollowing
                      ? 'bg-white text-chestnut border border-chestnut/25'
                      : 'bg-chestnut text-snow hover:opacity-90'
                  }`}
                >
                  {followLoading ? '…' : isFollowing ? '✓ Following' : viewerId ? '+ Follow' : 'Sign up to follow'}
                </button>
                {viewer?.user_type === 'musician' && (
                  <button
                    onClick={handleMessage}
                    className="bg-graphite text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Message
                  </button>
                )}
              </>
            )}
            <ShareButton url={shareUrl} title={`${displayName} · Drum Up`} text={shareText}
              label={isOwnProfile ? 'Copy link' : 'Share'}
              className="bg-white text-chestnut border border-chestnut/25 px-4 py-2 rounded-xl text-sm shadow-sm" />
          </div>
        </div>

        {/* Tags row */}
        {(cuisineType || capacity || musicNights.length > 0) && (
          <div className="max-w-2xl mx-auto px-5 flex flex-wrap gap-2 mb-5">
            {cuisineType && (
              <span className="bg-chestnut/12 text-chestnut text-xs font-semibold px-3 py-1.5 rounded-full border border-chestnut/15">{cuisineType}</span>
            )}
            {capacity && (
              <span className="bg-graphite/8 text-graphite text-xs font-semibold px-3 py-1.5 rounded-full border border-graphite/10">Cap. {capacity}</span>
            )}
            {musicNights.map(n => (
              <span key={n} className="bg-teal/10 text-teal text-xs font-semibold px-3 py-1.5 rounded-full border border-teal/15">{n}</span>
            ))}
          </div>
        )}

        {/* Stats strip — white card, 4 columns */}
        <div className="max-w-2xl mx-auto px-5 mb-5">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-4 divide-x divide-charcoal/[0.07]">
              <div className="py-4 flex flex-col items-center">
                <p className="text-chestnut text-xl font-black">{upcomingShows.length + pastShows.length}</p>
                <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Shows</p>
              </div>
              <div className="py-4 flex flex-col items-center">
                <p className="text-chestnut text-xl font-black">{followersCount}</p>
                <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Followers</p>
              </div>
              <div className="py-4 flex flex-col items-center">
                <p className="text-chestnut text-xl font-black">{avgRating != null ? avgRating.toFixed(1) : '—'}</p>
                <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Rating</p>
              </div>
              <div className="py-4 flex flex-col items-center">
                <p className="text-chestnut text-xl font-black">{capacity || '—'}</p>
                <p className="text-charcoal/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">Capacity</p>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-2xl mx-auto px-5 pb-20 space-y-0">

          {/* Live Tonight spotlight */}
          {tonight && (
            <section className="py-6 border-b border-charcoal/[0.08]">
              <div className="rounded-2xl p-5 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, rgba(220,127,65,0.16) 0%, rgba(220,127,65,0.06) 100%)', border: '1.5px solid rgba(220,127,65,0.32)' }}>
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 75% 65% at 95% 50%, rgba(220,127,65,0.14), transparent 70%)' }} />
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-chestnut animate-pulse inline-block" />
                    <p className="text-chestnut text-[10px] font-black uppercase tracking-[0.3em]">Live Tonight</p>
                  </div>
                  <div className="space-y-3">
                    {tonightShows.map(show => (
                      <div key={show.bookingId} className="flex items-center gap-3">
                        <Avatar src={show.musicianAvatar ?? ''} className="w-12 h-12 rounded-2xl shrink-0" textSize="text-xl" bg="bg-chestnut/20" />
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => router.push('/profile/' + show.musicianId)}
                            className="text-graphite font-black text-base leading-tight hover:text-chestnut transition-colors text-left block w-full truncate"
                          >
                            {show.musicianName}
                          </button>
                          <p className="text-charcoal/60 text-sm mt-0.5">{show.time}</p>
                        </div>
                        <button
                          onClick={() => router.push('/profile/' + show.musicianId)}
                          className="bg-chestnut text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0 shadow-sm"
                        >
                          View Artist
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Bio */}
          {profile.bio && (
            <section className="py-6 border-b border-charcoal/[0.08]">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">· About</p>
              <p className="text-charcoal text-sm leading-relaxed">{profile.bio}</p>
            </section>
          )}

          {/* Social links */}
          {(profile.instagram_url || profile.website || profile.tiktok_url || profile.youtube_url || profile.spotify_url) && (
            <section className="py-6 border-b border-charcoal/[0.08]">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-3">· Connect</p>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-charcoal/[0.06]">
                {profile.instagram_url && (
                  <a href={buildSocialUrl('instagram', profile.instagram_url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F2EF] transition-colors group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-snow shadow-sm"
                      style={{ background: 'linear-gradient(135deg, #405DE6 0%, #833AB4 35%, #C13584 55%, #FD1D1D 80%, #FCAF45 100%)' }}>
                      <SocialIcon type="instagram" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-graphite font-bold text-sm">Instagram</p>
                      <p className="text-charcoal/50 text-xs truncate">@{profile.instagram_url.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\/?/, '').replace(/\/$/, '')}</p>
                    </div>
                    <svg className="w-4 h-4 text-charcoal/25 group-hover:text-chestnut transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
                {profile.tiktok_url && (
                  <a href={buildSocialUrl('tiktok', profile.tiktok_url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F2EF] transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 text-snow shadow-sm">
                      <SocialIcon type="tiktok" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-graphite font-bold text-sm">TikTok</p>
                      <p className="text-charcoal/50 text-xs truncate">@{profile.tiktok_url.replace(/^@/, '').replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/, '').replace(/\/$/, '')}</p>
                    </div>
                    <svg className="w-4 h-4 text-charcoal/25 group-hover:text-chestnut transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
                {profile.youtube_url && (
                  <a href={buildSocialUrl('youtube', profile.youtube_url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F2EF] transition-colors group">
                    <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center shrink-0 text-snow shadow-sm">
                      <SocialIcon type="youtube" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-graphite font-bold text-sm">YouTube</p>
                      <p className="text-charcoal/50 text-xs truncate">{profile.youtube_url.replace(/^https?:\/\/(www\.)?youtube\.com\/@?/, '').replace(/^https?:\/\/youtu\.be\//, '').replace(/\/$/, '')}</p>
                    </div>
                    <svg className="w-4 h-4 text-charcoal/25 group-hover:text-chestnut transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
                {profile.spotify_url && (
                  <a href={buildSocialUrl('spotify', profile.spotify_url)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F2EF] transition-colors group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-snow shadow-sm" style={{ background: '#1DB954' }}>
                      <SocialIcon type="spotify" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-graphite font-bold text-sm">Spotify</p>
                      <p className="text-charcoal/50 text-xs truncate">{profile.spotify_url.replace(/^https?:\/\/open\.spotify\.com\//, '').replace(/\/$/, '')}</p>
                    </div>
                    <svg className="w-4 h-4 text-charcoal/25 group-hover:text-chestnut transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
                {profile.website && (
                  <a href={buildSocialUrl('website', profile.website)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F5F2EF] transition-colors group">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-snow shadow-sm" style={{ background: '#333333' }}>
                      <SocialIcon type="website" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-graphite font-bold text-sm">Website</p>
                      <p className="text-charcoal/50 text-xs truncate">{profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
                    </div>
                    <svg className="w-4 h-4 text-charcoal/25 group-hover:text-chestnut transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                )}
              </div>
            </section>
          )}

          {/* Upcoming Live Music */}
          <section className="py-6 border-b border-charcoal/[0.08]">
            <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">· Schedule</p>
            <h2 className="text-graphite text-xl font-black tracking-tight mb-4">Upcoming Live Music</h2>
            {upcomingShows.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                <div className="w-12 h-12 bg-chestnut/10 rounded-2xl flex items-center justify-center text-chestnut mb-2 mx-auto"><svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div>
                <p className="text-graphite font-bold text-sm mb-1">Nothing booked yet</p>
                <p className="text-charcoal/50 text-xs">Check back soon for upcoming shows.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingShows.map(show => {
                  const [, datePart] = show.dateLabel.split(', ')
                  const [mon, day] = (datePart || '').split(' ')
                  return (
                    <div key={show.bookingId} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                      <div className="rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]" style={{ background: 'rgba(220,127,65,0.10)' }}>
                        <p className="text-chestnut text-[10px] font-black uppercase">{mon}</p>
                        <p className="text-chestnut text-xl font-black leading-tight">{day}</p>
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
                      {show.musicianAvatar && (
                        <Avatar src={show.musicianAvatar} className="w-10 h-10 rounded-full shrink-0" textSize="text-lg" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Past Shows */}
          {pastShows.length > 0 && (
            <section className="py-6 border-b border-charcoal/[0.08]">
              <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">· History</p>
              <h2 className="text-graphite text-xl font-black tracking-tight mb-4">Past Shows</h2>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-charcoal/[0.06]">
                {pastShows.map(show => (
                  <button
                    key={show.bookingId}
                    onClick={() => router.push('/profile/' + show.musicianId)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#F5F2EF] transition-colors"
                  >
                    <div>
                      <p className="text-graphite font-semibold text-sm">{show.musicianName}</p>
                      <p className="text-charcoal/50 text-xs mt-0.5">{show.dateLabel}</p>
                    </div>
                    <VerifiedBadge />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Reviews */}
          <section className="py-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em] mb-1">· Reputation</p>
                <h2 className="text-graphite text-xl font-black tracking-tight">Reviews</h2>
              </div>
              {myReviewId ? (
                <button
                  onClick={openReviewEditor}
                  className="bg-white text-chestnut border border-chestnut/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-chestnut/10 transition-colors shadow-sm"
                >
                  Edit your review
                </button>
              ) : eligibleBookingId && (
                <button
                  onClick={openReviewModal}
                  className="bg-chestnut text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shadow-sm"
                >
                  + Leave a Review
                </button>
              )}
            </div>
            {revieweeType && reviews.length > 0 && avgRating != null && (
              <div className="mb-4">
                <RatingSummary reviews={reviews} revieweeType={revieweeType} avgRating={avgRating} />
              </div>
            )}
            {reviews.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
                <p className="text-3xl mb-2">⭐</p>
                <p className="text-graphite font-bold text-sm mb-1">No reviews yet</p>
                <p className="text-charcoal/50 text-xs">Be the first to leave a review after a show.</p>
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
                    {r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pl-12 mt-2">
                        {r.tags.map(t => (
                          <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-teal/10 text-teal">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {reviewModalOpen && revieweeType && (
          <ReviewModal
            displayName={displayName}
            revieweeType={revieweeType}
            reviewRating={reviewRating}
            reviewText={reviewText}
            aspects={reviewAspects}
            tags={reviewTags}
            submitting={submittingReview}
            editing={!!myReviewId}
            onClose={() => setReviewModalOpen(false)}
            onRating={setReviewRating}
            onText={setReviewText}
            onAspect={(k, v) => setReviewAspects(p => ({ ...p, [k]: v }))}
            onToggleTag={t => setReviewTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}
            onSubmit={handleSubmitReview}
          />
        )}
      </div>
    )
  }

  // ==============================
  // FAN PROFILE — Light
  // ==============================

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0' }}>
      <header className="sticky top-0 z-40 backdrop-blur-md bg-graphite/95 border-b border-charcoal/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {returnTo ? (
            <button
              onClick={handleReturnToMessages}
              className="flex items-center gap-1 text-chestnut text-xs font-bold hover:opacity-70 transition-opacity shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Messages
            </button>
          ) : (
            <button onClick={() => router.back()}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-snow/60 hover:text-snow shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <p className="text-snow font-black text-sm">{displayName}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Avatar + info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <Avatar src={profile.avatar_url ?? ''} className="w-16 h-16 rounded-2xl shrink-0" textSize="text-3xl" bg="bg-chestnut/10" />
          <div className="flex-1 min-w-0">
            <h1 className="text-graphite text-xl font-black truncate">{displayName}</h1>
            {profile.location_text && <p className="inline-flex items-center gap-1 text-charcoal text-sm"><svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>{profile.location_text}</p>}
            <div className="flex gap-4 mt-1.5">
              <span className="text-charcoal text-sm"><span className="font-bold text-graphite">{followersCount}</span> followers</span>
              <span className="text-charcoal text-sm"><span className="font-bold text-graphite">{followingCount}</span> following</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {!isOwnProfile && (
              <button onClick={handleToggleFollow} disabled={followLoading}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                  isFollowing ? 'bg-white text-chestnut border border-chestnut/30' : 'bg-chestnut text-snow hover:opacity-90'
                }`}>
                {followLoading ? '…' : isFollowing ? '✓' : viewerId ? '+ Follow' : 'Sign up'}
              </button>
            )}
            <ShareButton url={shareUrl} title={`${displayName} · Drum Up`} text={shareText}
              label={isOwnProfile ? 'Copy link' : 'Share'}
              className="justify-center bg-white text-chestnut border border-chestnut/25 px-4 py-2 rounded-xl text-sm shadow-sm" />
          </div>
        </div>

        {profile.bio && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <p className="text-charcoal/50 text-[10px] font-semibold uppercase tracking-wide mb-2">About</p>
            <p className="text-charcoal text-sm leading-relaxed">{profile.bio}</p>
          </div>
        )}

        <div>
          <p className="text-graphite font-black text-lg mb-3">Following</p>
          {followedProfiles.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <p className="text-charcoal/50 text-sm">Not following anyone yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-charcoal/[0.06]">
              {followedProfiles.map(fp => (
                <button key={fp.id} onClick={() => router.push('/profile/' + fp.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-snow/80 transition-colors">
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
        </div>
      </main>
    </div>
  )
}

// ---- Review aspect icon ----

function AspectIcon({ k, className = 'w-4 h-4' }: { k: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    punctuality: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    sound: <><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></>,
    professionalism: <><path d="M20 6 9 17l-5-5"/></>,
    engagement: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    communication: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    payment: <><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>,
    hospitality: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></>,
    atmosphere: <><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></>,
    setup: <><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="4"/></>,
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[k] ?? <circle cx="12" cy="12" r="9"/>}
    </svg>
  )
}

// ---- Rating Summary (aggregate: distribution + aspect bars + top tags) ----

function RatingSummary({ reviews, revieweeType, avgRating, dark }: {
  reviews: Review[]
  revieweeType: RevieweeType
  avgRating: number
  dark?: boolean
}) {
  const dist = ratingDistribution(reviews)
  const aspects = aspectAverages(reviews, revieweeType)
  const tags = topTags(reviews, 6)
  const total = reviews.length
  const cardCls = dark ? 'rounded-2xl p-5' : 'bg-white rounded-2xl p-5 shadow-sm'
  const cardStyle = dark ? { background: '#3D3D3D', border: '1px solid rgba(255,255,255,0.06)' } : undefined
  const muted = dark ? 'text-snow/40' : 'text-charcoal/50'
  const strong = dark ? 'text-snow' : 'text-graphite'
  const divider = dark ? 'border-white/[0.06]' : 'border-charcoal/[0.07]'
  const track = dark ? 'rgba(255,255,255,0.10)' : 'rgba(94,94,94,0.12)'

  return (
    <div className={cardCls} style={cardStyle}>
      {/* Average + distribution */}
      <div className="flex gap-5">
        <div className="text-center shrink-0">
          <p className="text-chestnut text-5xl font-black leading-none">{avgRating.toFixed(1)}</p>
          <div className="flex justify-center mt-1.5"><Stars rating={Math.round(avgRating)} dark={dark} /></div>
          <p className={`${muted} text-xs mt-1`}>{total} review{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 flex flex-col justify-center gap-1">
          {dist.map(d => (
            <div key={d.stars} className="flex items-center gap-2">
              <span className={`${muted} text-[11px] w-3 text-right`}>{d.stars}</span>
              <svg className="w-3 h-3 text-chestnut shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: track }}>
                <div className="h-full rounded-full bg-chestnut transition-all" style={{ width: total > 0 ? `${(d.count / total) * 100}%` : '0%' }} />
              </div>
              <span className={`${muted} text-[11px] w-4`}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Aspect breakdown */}
      {aspects.length > 0 && (
        <div className={`mt-5 pt-5 border-t ${divider}`}>
          <p className={`${muted} text-[10px] font-bold uppercase tracking-[0.2em] mb-3`}>What stood out</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
            {aspects.map(a => (
              <div key={a.key} className="flex items-center gap-2.5">
                <span className="text-teal shrink-0"><AspectIcon k={a.key} /></span>
                <span className={`${strong} text-xs font-semibold flex-1 min-w-0 truncate`}>{a.label}</span>
                <div className="w-16 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: track }}>
                  <div className="h-full rounded-full bg-teal" style={{ width: `${(a.avg / 5) * 100}%` }} />
                </div>
                <span className="text-teal text-xs font-black w-6 text-right shrink-0">{a.avg.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most-mentioned highlight tags */}
      {tags.length > 0 && (
        <div className={`mt-5 pt-5 border-t ${divider}`}>
          <p className={`${muted} text-[10px] font-bold uppercase tracking-[0.2em] mb-3`}>Most mentioned</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(t => (
              <span key={t.tag} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ background: dark ? 'rgba(220,127,65,0.18)' : 'rgba(220,127,65,0.10)', color: '#DC7F41' }}>
                {t.tag}<span className="opacity-60">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Review Modal (shared) ----

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing']

function ReviewModal({ displayName, revieweeType, reviewRating, reviewText, aspects, tags, submitting, editing = false, onClose, onRating, onText, onAspect, onToggleTag, onSubmit }: {
  displayName: string
  revieweeType: RevieweeType
  reviewRating: number
  reviewText: string
  aspects: Record<string, number>
  tags: string[]
  submitting: boolean
  editing?: boolean
  onClose: () => void
  onRating: (r: number) => void
  onText: (t: string) => void
  onAspect: (key: string, v: number) => void
  onToggleTag: (tag: string) => void
  onSubmit: () => void
}) {
  const aspectDefs = REVIEW_ASPECTS[revieweeType]
  const tagOptions = REVIEW_TAGS[revieweeType]
  const firstName = displayName.split(' ')[0]
  return (
    <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-25 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">{editing ? 'Update Your Review' : 'Your Experience'}</p>
            <h3 className="text-snow text-xl font-black tracking-tight">{editing ? 'Edit' : 'Review'} <span className="text-chestnut italic">{firstName}.</span></h3>
          </div>
          <button onClick={onClose} className="relative z-10 text-snow/60 hover:text-snow transition-colors"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Overall rating */}
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-2">Overall rating</p>
          <div className="flex items-center gap-3 mb-6">
            <div className="scale-110 origin-left"><Stars rating={reviewRating} interactive onSelect={onRating} /></div>
            <span className="text-graphite font-black text-sm">{RATING_WORDS[reviewRating] ?? ''}</span>
          </div>

          {/* Per-aspect ratings */}
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1">
            Rate the details <span className="text-charcoal/40 font-normal normal-case">(optional)</span>
          </p>
          <p className="text-charcoal/45 text-[11px] mb-3">Tap stars for what matters most.</p>
          <div className="space-y-3 mb-6">
            {aspectDefs.map(a => (
              <div key={a.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded-xl bg-teal/10 text-teal flex items-center justify-center shrink-0"><AspectIcon k={a.key} /></span>
                  <div className="min-w-0">
                    <p className="text-graphite text-sm font-semibold leading-tight truncate">{a.label}</p>
                    <p className="text-charcoal/45 text-[11px] leading-tight truncate">{a.hint}</p>
                  </div>
                </div>
                <div className="shrink-0"><Stars rating={aspects[a.key] ?? 0} interactive onSelect={v => onAspect(a.key, v)} /></div>
              </div>
            ))}
          </div>

          {/* Highlight tags */}
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-3">
            Highlights <span className="text-charcoal/40 font-normal normal-case">(pick any)</span>
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {tagOptions.map(t => {
              const active = tags.includes(t)
              return (
                <button key={t} type="button" onClick={() => onToggleTag(t)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${active ? 'bg-chestnut text-snow border-chestnut shadow-sm' : 'bg-white text-charcoal border-charcoal/15 hover:border-chestnut/40'}`}>
                  {active && <span className="mr-1">✓</span>}{t}
                </button>
              )
            })}
          </div>

          {/* Free text */}
          <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">
            Review <span className="text-charcoal/40 font-normal normal-case">(optional, max 500 chars)</span>
          </p>
          <textarea
            value={reviewText}
            onChange={e => onText(e.target.value.slice(0, 500))}
            rows={4}
            placeholder={`Share your experience with ${firstName}…`}
            className="w-full bg-white rounded-xl px-4 py-3 shadow-sm focus:outline-none text-sm resize-none border border-charcoal/10 mb-1"
          />
          <p className="text-charcoal/40 text-xs text-right">{reviewText.length}/500</p>
        </div>

        <div className="p-6 pt-0 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10">
            Cancel
          </button>
          <button onClick={onSubmit} disabled={submitting} className="flex-1 bg-chestnut text-snow py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50">
            {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
