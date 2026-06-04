'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'
import { ShareButton } from '@/components/ShareButton'
import AddToCalendar from '@/components/AddToCalendar'
import { formatMoney } from '@/lib/analytics'
import { gigStartEnd } from '@/lib/ics'

const APP_BG = {
  background:
    'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0',
}

interface EventRow {
  booking_id: string
  restaurant_id: string
  musician_id: string
  venue_name: string | null
  venue_username: string | null
  venue_avatar: string | null
  venue_location: string | null
  venue_lat: number | null
  venue_lon: number | null
  venue_bio: string | null
  musician_name: string | null
  musician_username: string | null
  musician_avatar: string | null
  musician_bio: string | null
  performer_type: string | null
  band_members: number | null
  genres: string[] | null
  instagram_url: string | null
  youtube_url: string | null
  spotify_url: string | null
  gig_date: string
  start_time: string | null
  end_time: string | null
  cover_charge: number | null
  description: string | null
}

function fmtTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function fmtDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<EventRow | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  const [going, setGoing] = useState(false)
  const [goingCount, setGoingCount] = useState(0)
  const [rsvpBusy, setRsvpBusy] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: ev, error } = await supabase.rpc('event_detail', { event_id: id })
      if (!active) return
      if (error || !ev || ev.length === 0) {
        setEvent(null)
        setLoading(false)
        return
      }
      const row = ev[0] as EventRow
      setEvent(row)

      const { data: count } = await supabase.rpc('event_going_count', { event_id: id })
      if (active && typeof count === 'number') setGoingCount(count)

      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (user) {
        setUserId(user.id)
        const [{ data: f }, { data: r }] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', user.id)
            .in('following_id', [row.restaurant_id, row.musician_id]),
          supabase.from('rsvps').select('id').eq('booking_id', id).eq('user_id', user.id).maybeSingle(),
        ])
        if (!active) return
        if (f) setFollowed(new Set(f.map(x => x.following_id)))
        setGoing(!!r)
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [id])

  const toggleFollow = async (targetId: string) => {
    if (!userId) { router.push('/auth/login'); return }
    const isFollowing = followed.has(targetId)
    setFollowed(prev => {
      const next = new Set(prev)
      if (isFollowing) next.delete(targetId); else next.add(targetId)
      return next
    })
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId)
    } else {
      await supabase.from('follows').insert({ follower_id: userId, following_id: targetId })
    }
  }

  const toggleRsvp = async () => {
    if (!userId) { router.push('/auth/login'); return }
    if (rsvpBusy) return
    setRsvpBusy(true)
    const next = !going
    setGoing(next)
    setGoingCount(c => Math.max(0, c + (next ? 1 : -1)))
    try {
      if (next) {
        const { error } = await supabase.from('rsvps').insert({ booking_id: id, user_id: userId })
        if (error) throw error
        toast.success("You're going! 🎉")
      } else {
        const { error } = await supabase.from('rsvps').delete().eq('booking_id', id).eq('user_id', userId)
        if (error) throw error
      }
    } catch {
      // revert optimistic update
      setGoing(!next)
      setGoingCount(c => Math.max(0, c + (next ? -1 : 1)))
      toast.error('Could not update RSVP')
    } finally {
      setRsvpBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={APP_BG}>
        <div className="w-8 h-8 border-2 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={APP_BG}>
        <p className="text-graphite font-black text-xl mb-2">Event not found</p>
        <p className="text-charcoal text-sm mb-6">This show may have been cancelled or is no longer available.</p>
        <button onClick={() => router.push('/dashboard')} className="bg-chestnut text-snow font-bold px-6 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          Back to Dashboard
        </button>
      </div>
    )
  }

  const followingVenue = followed.has(event.restaurant_id)
  const followingMusician = followed.has(event.musician_id)
  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const cal = gigStartEnd(event.gig_date, event.start_time, event.end_time)

  return (
    <div className="min-h-screen" style={APP_BG}>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Back */}
        <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-charcoal text-sm font-bold mb-4 hover:text-graphite transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>

        {/* Hero — musician on graphite */}
        <div className="rounded-3xl overflow-hidden shadow-md">
          <div
            className="px-6 py-8 text-center"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 10% 20%, rgba(220,127,65,0.08), transparent 70%), radial-gradient(ellipse 80% 60% at 90% 80%, rgba(108,154,139,0.08), transparent 70%), #333333' }}
          >
            <p className="inline-flex items-center gap-1 text-teal text-[10px] font-bold uppercase tracking-[0.25em] mb-3">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              Live Music
            </p>
            <Avatar src={event.musician_avatar || ''} className="w-20 h-20 rounded-full mx-auto mb-3 ring-2 ring-white/15" textSize="text-2xl" />
            <h1 className="text-snow font-black text-2xl leading-tight">{event.musician_name}</h1>
            {event.performer_type && (
              <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full mt-2 ${event.performer_type === 'solo' ? 'bg-teal/20 text-teal' : 'bg-chestnut/20 text-chestnut'}`}>
                {event.performer_type === 'solo' ? 'Solo Artist' : `Band${event.band_members ? ` · ${event.band_members} members` : ''}`}
              </span>
            )}
            {event.genres && event.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                {event.genres.slice(0, 4).map(g => (
                  <span key={g} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-snow/80 border border-white/10">{g}</span>
                ))}
              </div>
            )}
          </div>

          {/* Details on white */}
          <div className="bg-white px-6 py-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-chestnut/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </div>
              <div>
                <p className="text-graphite font-black text-sm">{fmtDate(event.gig_date)}</p>
                <p className="text-charcoal text-xs">{fmtTime(event.start_time)}{event.end_time ? ` – ${fmtTime(event.end_time)}` : ''}</p>
              </div>
            </div>

            <button onClick={() => event.venue_username && router.push(`/profile/${event.venue_username}`)} className="w-full flex items-center gap-3 text-left">
              <Avatar src={event.venue_avatar || ''} className="w-10 h-10 rounded-xl shrink-0" textSize="text-base" />
              <div className="min-w-0">
                <p className="text-graphite font-black text-sm truncate">{event.venue_name}</p>
                <p className="inline-flex items-center gap-0.5 text-charcoal text-xs truncate">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                  {event.venue_location || 'See venue profile'}
                </p>
              </div>
            </button>

            {event.cover_charge != null && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal/10 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <p className="text-graphite font-bold text-sm">{event.cover_charge === 0 ? 'Free entry' : `${formatMoney(event.cover_charge)} cover at the door`}</p>
              </div>
            )}

            {event.description && (
              <p className="text-charcoal text-sm leading-relaxed border-t border-charcoal/[0.07] pt-4">{event.description}</p>
            )}
          </div>
        </div>

        {/* RSVP */}
        <div className="bg-white rounded-2xl shadow-sm mt-4 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-graphite font-black text-sm">{goingCount === 0 ? 'Be the first to RSVP' : `${goingCount} going`}</p>
            <p className="text-charcoal text-xs">Let the venue know you&apos;re coming</p>
          </div>
          <button
            onClick={toggleRsvp}
            disabled={rsvpBusy}
            className={`shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${going ? 'bg-teal text-snow shadow-sm' : 'bg-chestnut text-snow shadow-sm hover:shadow-md'}`}
          >
            {going ? "Going ✓" : "I'm going"}
          </button>
        </div>

        {/* Follow / Share / Calendar */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => toggleFollow(event.restaurant_id)}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${followingVenue ? 'bg-teal text-snow' : 'bg-white text-teal border border-teal hover:bg-teal hover:text-snow'}`}
          >
            {followingVenue ? 'Following Venue ✓' : 'Follow Venue'}
          </button>
          <button
            onClick={() => toggleFollow(event.musician_id)}
            className={`py-2.5 rounded-xl text-xs font-bold transition-all ${followingMusician ? 'bg-teal text-snow' : 'bg-white text-teal border border-teal hover:bg-teal hover:text-snow'}`}
          >
            {followingMusician ? 'Following Artist ✓' : 'Follow Artist'}
          </button>
        </div>

        <div className="flex items-center justify-between mt-4 bg-white rounded-2xl shadow-sm px-5 py-3">
          <ShareButton
            url={shareUrl}
            title={`${event.musician_name} at ${event.venue_name}`}
            text={`Live music: ${event.musician_name} at ${event.venue_name} on ${fmtDate(event.gig_date)}`}
            className="text-charcoal text-sm"
          />
          <AddToCalendar
            filename={`show-${event.musician_name}`}
            label="Add to Calendar"
            event={{
              uid: event.booking_id,
              title: `${event.musician_name} at ${event.venue_name}`,
              description: `Live music: ${event.musician_name} at ${event.venue_name}.`,
              location: event.venue_location || event.venue_name || '',
              ...cal,
            }}
          />
        </div>
      </div>
    </div>
  )
}
