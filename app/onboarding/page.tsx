'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

type UserType = 'restaurant' | 'musician' | 'fan'

const BASE_STEPS = 4

const PANEL_BG = `
  radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108, 154, 139, 0.10), transparent 70%),
  radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220, 127, 65, 0.12), transparent 70%),
  #E8E4E0
`

const GENRES = [
  'Rock', 'Jazz', 'Folk', 'Pop', 'Country', 'Blues', 'Hip Hop',
  'R&B', 'Acoustic', 'Indie', 'Classical', 'Electronic', 'Latin', 'Reggae',
]
const NIGHTS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const SOLO_BAND = ['Solo', 'Duo', 'Band']

function formatError(e: unknown): string {
  if (!e) return 'Something went wrong.'
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const err = e as { message?: string; error?: string; details?: string; hint?: string; code?: string; statusCode?: string | number }
    const parts = [
      err.message || err.error,
      err.details,
      err.hint,
      err.code ? `(code: ${err.code})` : null,
    ].filter(Boolean)
    if (parts.length) return parts.join(' — ')
    try { return JSON.stringify(e) } catch { /* noop */ }
  }
  return 'Something went wrong.'
}

const ROLE_LABELS: Record<UserType, { title: string; subtitle: string }> = {
  restaurant: { title: 'Tell us about your venue', subtitle: 'Help musicians know what kind of room they\'re walking into.' },
  musician:   { title: 'Tell us about your sound',  subtitle: 'Restaurants will use this to find a fit for their crowd.' },
  fan:        { title: 'What do you love?',         subtitle: 'We\'ll surface live shows you might dig.' },
}

interface BasicInfo {
  fullName: string        // stage name (solo) or band name — stored as full_name
  legalName: string       // private, for Stripe only
  performerType: 'solo' | 'band' | ''
  bandMembers: string
  avatarFile: File | null
  avatarPreview: string
  locationText: string
  latitude: number | null
  longitude: number | null
}

interface RoleInfo {
  venueName: string
  capacity: string
  cuisineType: string
  musicNights: string[]
  genres: string[]
  instruments: string
  soloOrBand: string
  yearsPerforming: string
  favoriteGenres: string[]
}

interface SocialInfo {
  bio: string
  instagram: string
  tiktok: string
  spotify: string
  youtube: string
  website: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [tosAccepted, setTosAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [userType, setUserType] = useState<UserType>('fan')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [savedAvatarUrl, setSavedAvatarUrl] = useState('')
  const [stripeConnecting, setStripeConnecting] = useState(false)
  const [sessionFailed, setSessionFailed] = useState(false)

  const totalSteps = userType === 'musician' ? BASE_STEPS + 1 : BASE_STEPS

  const [basic, setBasic] = useState<BasicInfo>({
    fullName: '',
    legalName: '',
    performerType: '',
    bandMembers: '',
    avatarFile: null,
    avatarPreview: '',
    locationText: '',
    latitude: null,
    longitude: null,
  })
  const [role, setRole] = useState<RoleInfo>({
    venueName: '', capacity: '', cuisineType: '', musicNights: [],
    genres: [], instruments: '', soloOrBand: '', yearsPerforming: '',
    favoriteGenres: [],
  })
  const [social, setSocial] = useState<SocialInfo>({
    bio: '', instagram: '', tiktok: '', spotify: '', youtube: '', website: '',
  })

  useEffect(() => {
    let resolved = false

    const applyUser = async (user: User) => {
      if (resolved) return
      resolved = true  // set before any await to block concurrent calls

      console.log('[Onboarding] applyUser — user_metadata:', JSON.stringify(user.user_metadata))

      // If this user already completed onboarding, skip straight to dashboard
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (existingProfile?.full_name) {
        console.log('[Onboarding] Profile already complete, redirecting to dashboard')
        router.replace('/dashboard')
        return
      }

      const t = (user.user_metadata?.user_type as UserType) || 'fan'
      console.log('[Onboarding] applyUser — resolved userType:', t)
      setError('')
      setSessionFailed(false)
      setUserId(user.id)
      setUserType(t)
      const meta = user.user_metadata ?? {}
      setBasic(prev => ({
        ...prev,
        fullName: meta.full_name ?? meta.name ?? '',
        avatarPreview: meta.avatar_url ?? '',
      }))
      setLoading(false)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void applyUser(session.user)
    })

    const getSessionWithRetry = async (retries = 3, delay = 500) => {
      for (let i = 0; i < retries; i++) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) return user
        if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay))
      }
      return null
    }

    getSessionWithRetry().then(async user => {
      if (user) {
        await applyUser(user)
      } else if (!resolved) {
        setError('Failed to load your session. Please refresh the page.')
        setSessionFailed(true)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }
    setLocationLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
            { headers: { 'Accept-Language': 'en' } },
          )
          const data = await res.json()
          const a = data.address ?? {}
          const city = a.city || a.town || a.village || a.hamlet || a.county || ''
          const state = a.state || ''
          const text = [city, state].filter(Boolean).join(', ') || data.display_name?.split(',').slice(0, 2).join(',').trim() || `${lat.toFixed(3)}, ${lon.toFixed(3)}`
          setBasic(prev => ({ ...prev, locationText: text, latitude: lat, longitude: lon }))
        } catch {
          setBasic(prev => ({ ...prev, latitude: lat, longitude: lon, locationText: `${lat.toFixed(3)}, ${lon.toFixed(3)}` }))
        }
        setLocationLoading(false)
      },
      () => {
        setError('Couldn\'t get your location — you can type it instead.')
        setLocationLoading(false)
      },
      { timeout: 10000 },
    )
  }

  const lookupCity = async () => {
    if (!basic.locationText.trim()) return
    setLocationLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(basic.locationText)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      )
      const data = await res.json()
      if (data[0]) {
        const display = data[0].display_name.split(',').slice(0, 2).join(',').trim()
        setBasic(prev => ({
          ...prev,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          locationText: display,
        }))
      }
    } catch {
      // silent — user can still proceed with the typed text
    }
    setLocationLoading(false)
  }

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }
    setBasic(prev => ({
      ...prev,
      avatarFile: file,
      avatarPreview: URL.createObjectURL(file),
    }))
  }

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const step1Valid = tosAccepted && privacyAccepted
  const step2Valid = userType === 'musician'
    ? basic.performerType !== ''
      && basic.fullName.trim().length > 0
      && basic.legalName.trim().length > 0
      && basic.locationText.trim().length > 0
      && (basic.performerType !== 'band' || basic.bandMembers !== '')
    : basic.fullName.trim().length > 0 && basic.locationText.trim().length > 0

  const next = () => {
    setError('')
    if (step === 1 && !step1Valid) {
      setError('You must accept both the Terms of Service and Privacy Policy to continue.')
      return
    }
    if (step === 2 && !step2Valid) {
      setError('Please enter your name and location to continue.')
      return
    }
    if (step < totalSteps) setStep(s => s + 1)
    else finish()
  }
  const back = () => {
    setError('')
    if (step > 1) setStep(s => s - 1)
  }

  const saveProfileToSupabase = async (): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('You\'re no longer signed in. Please log in again.')

    // Defensive: React state is the source of truth, but fall back to auth metadata
    // in case a re-render race left the state at the 'fan' default.
    const resolvedType: UserType =
      (userType as UserType) ||
      (user.user_metadata?.user_type as UserType) ||
      'fan'
    console.log('[Onboarding] saveProfileToSupabase — React state userType:', userType,
      '| auth metadata user_type:', user.user_metadata?.user_type,
      '| using:', resolvedType)

    let avatarUrl = basic.avatarPreview.startsWith('blob:') ? '' : basic.avatarPreview
    if (basic.avatarFile) {
      const ext = basic.avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, basic.avatarFile, { upsert: true, contentType: basic.avatarFile.type })
      if (upErr) { console.error('Avatar upload failed', upErr); throw upErr }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = data.publicUrl
    }

    const roleMetadata: Record<string, unknown> = {}
    if (userType === 'restaurant') {
      roleMetadata.venue_name = role.venueName || null
      roleMetadata.capacity = role.capacity ? Number(role.capacity) : null
      roleMetadata.cuisine_type = role.cuisineType || null
      roleMetadata.music_nights = role.musicNights
    } else if (userType === 'musician') {
      roleMetadata.genres = role.genres
      roleMetadata.instruments = role.instruments || null
      roleMetadata.solo_or_band = role.soloOrBand || null
      roleMetadata.years_performing = role.yearsPerforming ? Number(role.yearsPerforming) : null
    } else {
      roleMetadata.favorite_genres = role.favoriteGenres
    }

    const profileRow = {
      id: user.id,
      user_type: resolvedType,
      full_name: basic.fullName || null,
      legal_name: userType === 'musician' ? (basic.legalName || null) : null,
      performer_type: userType === 'musician' ? (basic.performerType || null) : null,
      band_name: userType === 'musician' && basic.performerType === 'band' ? (basic.fullName || null) : null,
      band_members: userType === 'musician' && basic.performerType === 'band' ? (parseInt(basic.bandMembers) || null) : null,
      avatar_url: avatarUrl || null,
      location_text: basic.locationText || null,
      latitude: basic.latitude,
      longitude: basic.longitude,
      bio: social.bio || null,
      instagram_url: social.instagram || null,
      tiktok_url: social.tiktok || null,
      spotify_url: social.spotify || null,
      youtube_url: social.youtube || null,
      website: social.website || null,
      role_metadata: roleMetadata,
    }

    const { error: upsertErr } = await supabase.from('profiles').upsert(profileRow)
    if (upsertErr) { console.error('Profile upsert failed', upsertErr); throw upsertErr }
    return avatarUrl
  }

  const finish = async () => {
    setSubmitting(true)
    setError('')
    try {
      const avatarUrl = await saveProfileToSupabase()
      setSavedAvatarUrl(avatarUrl)
      setShowSuccess(true)
      setSubmitting(false)
    } catch (e) {
      console.error('Onboarding finish failed', e)
      setError(formatError(e))
      setSubmitting(false)
    }
  }

  const connectStripe = async () => {
    setStripeConnecting(true)
    setError('')
    try {
      await saveProfileToSupabase()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in.')
      const res = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json() as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to start Stripe setup.')
      window.location.href = data.url
    } catch (e) {
      console.error('Stripe connect failed', e)
      setError(formatError(e))
      setStripeConnecting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (showSuccess) {
    const displayName = userType === 'restaurant'
      ? (role.venueName || basic.fullName || 'Your Venue')
      : (basic.fullName || 'Your Profile')
    const initials = displayName.slice(0, 2).toUpperCase()
    const roleLabel = userType === 'restaurant' ? '🍽 Restaurant' : userType === 'musician' ? '♪ Musician' : '★ Fan'
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: PANEL_BG }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-chestnut rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-xl">🎉</div>
            <h1 className="text-graphite text-3xl font-black tracking-tight mb-2">
              Your profile is <span className="text-chestnut italic">live!</span>
            </h1>
            <p className="text-charcoal leading-relaxed">You're all set. Musicians and venues can now find you on Drum Up.</p>
          </div>

          {/* Profile preview card */}
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
            <div className="flex items-center gap-4">
              {savedAvatarUrl
                ? <img src={savedAvatarUrl} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0 border-2 border-chestnut/20" />
                : <div className="w-14 h-14 rounded-2xl bg-chestnut/10 border-2 border-chestnut/20 flex items-center justify-center text-2xl font-black text-chestnut shrink-0">{initials}</div>}
              <div className="min-w-0">
                <p className="text-graphite font-black text-lg leading-tight truncate">{displayName}</p>
                <p className="text-charcoal text-sm">{roleLabel}</p>
                {basic.locationText && <p className="text-charcoal/60 text-xs mt-0.5">📍 {basic.locationText}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.replace('/profile/' + userId)}
              className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-black text-sm shadow-md hover:opacity-90 transition-opacity"
            >
              View My Profile →
            </button>
            <button
              onClick={() => router.replace('/dashboard')}
              className="w-full bg-white text-graphite py-3.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-shadow border border-charcoal/10"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: PANEL_BG }}>

      {/* Top bar */}
      <header className="px-6 md:px-12 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white rounded-xl p-1.5 shadow-sm">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-graphite font-black text-xl tracking-tight">Drum Up</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-charcoal text-xs uppercase tracking-[0.25em] font-bold">
            Step {step} of {totalSteps}
          </span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-6 md:px-12 mb-6 md:mb-10">
        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-chestnut transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <main className="flex-1 px-4 md:px-6 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-10">

            {step === 1 && (
              <div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3">— Before you begin</p>
                <h2 className="text-graphite text-3xl md:text-4xl font-black tracking-tight mb-2">
                  Review & <span className="text-chestnut italic">agree.</span>
                </h2>
                <p className="text-charcoal mb-6">Please read and accept our terms before creating your profile.</p>

                {/* Terms of Service */}
                <div className="bg-snow rounded-xl p-4 mb-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-graphite font-bold text-sm">Terms of Service</p>
                      <p className="text-charcoal/70 text-xs mt-0.5">Effective May 19, 2026 · Version 1.0</p>
                    </div>
                  </div>
                  <div className="h-40 overflow-y-auto bg-white rounded-lg p-3 text-xs text-charcoal leading-relaxed space-y-2 shadow-inner mb-3">
                    <p><strong>1. Introduction.</strong> Welcome to Drum Up. By creating an account you agree to these Terms. Drum Up is operated as a sole proprietorship in Pennsylvania, United States.</p>
                    <p><strong>2. Eligibility.</strong> You must be at least 18 years old, have legal capacity to enter a contract, and provide accurate registration information.</p>
                    <p><strong>3. Description.</strong> Drum Up is a marketplace connecting restaurants and musicians. We act solely as a facilitator — we do not employ or endorse any user.</p>
                    <p><strong>4. Accounts.</strong> You are responsible for your account credentials and all activity under your account.</p>
                    <p><strong>5. Booking & Payments.</strong> Drum Up charges an 8% platform fee on confirmed bookings. All payments must flow through the Platform via Stripe. Arranging off-platform payments to bypass the fee is a violation and may result in account termination.</p>
                    <p><strong>6. User Conduct.</strong> You agree not to provide false information, harass other users, circumvent fees, scrape the Platform, or otherwise violate these Terms.</p>
                    <p><strong>7. Content.</strong> You retain ownership of your content but grant Drum Up a license to display and distribute it on the Platform.</p>
                    <p><strong>8. Third-Party Services.</strong> The Platform integrates with Stripe, Google, Supabase, and Vercel. Your use of those services is subject to their own terms.</p>
                    <p><strong>9. Disclaimers.</strong> The Platform is provided "as is." Drum Up is not liable for indirect, incidental, or consequential damages. Total liability is capped at platform fees paid in the prior six months.</p>
                    <p><strong>10. Termination.</strong> Drum Up may suspend or terminate your account at any time for violations of these Terms.</p>
                    <p><strong>11. Governing Law.</strong> These Terms are governed by Pennsylvania law. Disputes will be resolved in Pennsylvania courts.</p>
                    <p><strong>12. Contact.</strong> support@drum-up.app</p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setTosAccepted(v => !v)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        tosAccepted ? 'bg-chestnut border-chestnut' : 'border-charcoal/30 bg-white group-hover:border-chestnut/60'
                      }`}
                    >
                      {tosAccepted && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="text-charcoal text-sm font-semibold select-none" onClick={() => setTosAccepted(v => !v)}>
                      I have read and agree to the <span className="text-chestnut">Terms of Service</span>
                    </span>
                  </label>
                </div>

                {/* Privacy Policy */}
                <div className="bg-snow rounded-xl p-4 mb-1 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-graphite font-bold text-sm">Privacy Policy</p>
                      <p className="text-charcoal/70 text-xs mt-0.5">Effective May 19, 2026 · Version 1.0</p>
                    </div>
                  </div>
                  <div className="h-40 overflow-y-auto bg-white rounded-lg p-3 text-xs text-charcoal leading-relaxed space-y-2 shadow-inner mb-3">
                    <p><strong>1. Introduction.</strong> Drum Up is committed to protecting your privacy. This Policy explains how we collect, use, disclose, and safeguard your personal information.</p>
                    <p><strong>2. Information We Collect.</strong> We collect your name, email, profile photo, location (city and coordinates), user type, social media links, booking information, messages, and reviews. We also collect usage data automatically (IP, device, browser, pages visited).</p>
                    <p><strong>3. How We Use It.</strong> We use your information to operate the Platform, connect restaurants with musicians, process bookings, enable messaging, send notifications, improve the service, prevent fraud, and comply with legal obligations.</p>
                    <p><strong>4. How We Share It.</strong> Your public profile is visible to other logged-in users. We share data with Supabase, Stripe, Google, and Vercel only as needed to operate the Platform. We do not sell your data to third parties or allow ad targeting.</p>
                    <p><strong>5. Location Data.</strong> We store your city and coordinates to power location-based matching. Your precise coordinates are never shown to other users — only your general location (e.g. "Philadelphia, PA") is displayed.</p>
                    <p><strong>6. Data Retention.</strong> Data is retained while your account is active. On deletion, personal data is removed within 30 days. Booking and payment records may be retained up to 7 years for compliance.</p>
                    <p><strong>7. Your Rights.</strong> You may request access, correction, deletion, or portability of your data by contacting privacy@drum-up.app. We respond within 30 days.</p>
                    <p><strong>8. Cookies.</strong> We use essential cookies (required for the Platform) and analytics cookies. You can control these through your browser.</p>
                    <p><strong>9. Children.</strong> The Platform is not intended for users under 18. We do not knowingly collect data from minors.</p>
                    <p><strong>10. Security.</strong> We use HTTPS, encrypted password storage, and access controls. No internet transmission is 100% secure.</p>
                    <p><strong>11. Contact.</strong> privacy@drum-up.app</p>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setPrivacyAccepted(v => !v)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                        privacyAccepted ? 'bg-chestnut border-chestnut' : 'border-charcoal/30 bg-white group-hover:border-chestnut/60'
                      }`}
                    >
                      {privacyAccepted && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className="text-charcoal text-sm font-semibold select-none" onClick={() => setPrivacyAccepted(v => !v)}>
                      I have read and agree to the <span className="text-chestnut">Privacy Policy</span>
                    </span>
                  </label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3">— The basics</p>
                <h2 className="text-graphite text-3xl md:text-4xl font-black tracking-tight mb-2">
                  Let's set up your <span className="text-chestnut italic">profile.</span>
                </h2>
                <p className="text-charcoal mb-8">A photo and a city help people recognize and find you.</p>

                {/* Avatar */}
                <div className="flex items-center gap-5 mb-7">
                  <div className="relative">
                    {basic.avatarPreview ? (
                      <img src={basic.avatarPreview} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-sm" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-snow shadow-sm flex items-center justify-center text-3xl text-chestnut">
                        ♪
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="inline-block bg-snow text-graphite font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      {basic.avatarPreview ? 'Change photo' : 'Upload photo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                    <p className="text-xs text-charcoal/60 mt-1.5">JPG or PNG, up to 5MB</p>
                  </div>
                </div>

                {/* Name section — musicians get performer type + stage/band name + legal name */}
                {userType === 'musician' ? (
                  <>
                    <label className="block text-charcoal font-semibold text-sm mb-2">
                      Are you a... <span className="text-chestnut">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      {(['solo', 'band'] as const).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setBasic(prev => ({ ...prev, performerType: val }))}
                          className={`py-4 rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-1 ${
                            basic.performerType === val
                              ? 'bg-chestnut text-snow shadow-md'
                              : 'bg-snow text-charcoal border border-charcoal/20 hover:shadow-md'
                          }`}
                        >
                          <span className="text-2xl">{val === 'solo' ? '🎤' : '🎸'}</span>
                          <span>{val === 'solo' ? 'Solo Artist' : 'Band'}</span>
                        </button>
                      ))}
                    </div>

                    {basic.performerType !== '' && (
                      <>
                        {basic.performerType === 'solo' ? (
                          <>
                            <label className="block text-charcoal font-semibold text-sm mb-2">
                              Stage Name <span className="text-chestnut">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="The name you perform under e.g. Johnny Blues"
                              value={basic.fullName}
                              onChange={e => setBasic(prev => ({ ...prev, fullName: e.target.value.slice(0, 50) }))}
                              className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite mb-1"
                            />
                            <p className="text-charcoal/60 text-xs mb-5">This is what venues and fans will see on your profile</p>
                          </>
                        ) : (
                          <>
                            <label className="block text-charcoal font-semibold text-sm mb-2">
                              Band Name <span className="text-chestnut">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. The Midnight Blues"
                              value={basic.fullName}
                              onChange={e => setBasic(prev => ({ ...prev, fullName: e.target.value.slice(0, 50) }))}
                              className="w-full bg-snow rounded-xl px-4 py-3.5 mb-5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                            />
                            <label className="block text-charcoal font-semibold text-sm mb-2">
                              Number of Members <span className="text-chestnut">*</span>
                            </label>
                            <input
                              type="number"
                              min={2}
                              max={50}
                              placeholder="4"
                              value={basic.bandMembers}
                              onChange={e => setBasic(prev => ({ ...prev, bandMembers: e.target.value }))}
                              className="w-full bg-snow rounded-xl px-4 py-3.5 mb-5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                            />
                          </>
                        )}

                        <label className="block text-charcoal font-semibold text-sm mb-2">
                          🔒 Your Legal Name <span className="text-chestnut">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="First and last name as on your ID"
                          value={basic.legalName}
                          onChange={e => setBasic(prev => ({ ...prev, legalName: e.target.value.slice(0, 100) }))}
                          className="w-full rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite mb-1"
                          style={{ background: '#F9F9F9' }}
                        />
                        <p className="text-charcoal/60 text-xs italic mb-6">Private — only used for payment verification. Never shown publicly.</p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-charcoal font-semibold text-sm mb-2">
                      {userType === 'restaurant' ? 'Contact name' : 'Full name'} <span className="text-chestnut">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={userType === 'restaurant' ? 'Who runs the booking?' : 'How should we list you?'}
                      value={basic.fullName}
                      onChange={e => setBasic(prev => ({ ...prev, fullName: e.target.value }))}
                      className="w-full bg-snow rounded-xl px-4 py-3.5 mb-6 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                    />
                  </>
                )}

                {/* Location */}
                <label className="block text-charcoal font-semibold text-sm mb-2">Location <span className="text-chestnut">*</span></label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="e.g. Philadelphia, PA"
                    value={basic.locationText}
                    onChange={e => setBasic(prev => ({ ...prev, locationText: e.target.value, latitude: null, longitude: null }))}
                    onBlur={lookupCity}
                    className="flex-1 bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                  />
                  <button
                    type="button"
                    onClick={detectLocation}
                    disabled={locationLoading}
                    className="bg-teal text-snow font-bold px-5 py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 whitespace-nowrap text-sm flex items-center justify-center gap-2"
                  >
                    {locationLoading ? (
                      <span className="w-4 h-4 border-2 border-snow border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span>📍</span>
                    )}
                    Use my location
                  </button>
                </div>
                {basic.latitude !== null && (
                  <p className="text-xs text-teal font-semibold flex items-center gap-1.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal" />
                    Got it — {basic.locationText}
                  </p>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3">— About you</p>
                <h2 className="text-graphite text-3xl md:text-4xl font-black tracking-tight mb-2">
                  {ROLE_LABELS[userType].title}
                </h2>
                <p className="text-charcoal mb-8">{ROLE_LABELS[userType].subtitle}</p>

                {userType === 'restaurant' && (
                  <>
                    <label className="block text-charcoal font-semibold text-sm mb-2">Venue name</label>
                    <input
                      type="text"
                      placeholder="The Lantern Room"
                      value={role.venueName}
                      onChange={e => setRole(prev => ({ ...prev, venueName: e.target.value }))}
                      className="w-full bg-snow rounded-xl px-4 py-3.5 mb-5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                    />

                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="block text-charcoal font-semibold text-sm mb-2">Capacity</label>
                        <input
                          type="number"
                          placeholder="80"
                          value={role.capacity}
                          onChange={e => setRole(prev => ({ ...prev, capacity: e.target.value }))}
                          className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                        />
                      </div>
                      <div>
                        <label className="block text-charcoal font-semibold text-sm mb-2">Cuisine</label>
                        <input
                          type="text"
                          placeholder="Italian, Tapas..."
                          value={role.cuisineType}
                          onChange={e => setRole(prev => ({ ...prev, cuisineType: e.target.value }))}
                          className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                        />
                      </div>
                    </div>

                    <label className="block text-charcoal font-semibold text-sm mb-2">Typical music nights</label>
                    <div className="flex flex-wrap gap-2">
                      {NIGHTS.map(n => {
                        const active = role.musicNights.includes(n)
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setRole(prev => ({ ...prev, musicNights: toggleArrayItem(prev.musicNights, n) }))}
                            className={`px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-all ${
                              active ? 'bg-chestnut text-snow shadow-md' : 'bg-snow text-charcoal hover:shadow-md'
                            }`}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}

                {userType === 'musician' && (
                  <>
                    <label className="block text-charcoal font-semibold text-sm mb-2">Genres</label>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {GENRES.map(g => {
                        const active = role.genres.includes(g)
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setRole(prev => ({ ...prev, genres: toggleArrayItem(prev.genres, g) }))}
                            className={`px-3.5 py-2 rounded-xl font-bold text-sm shadow-sm transition-all ${
                              active ? 'bg-chestnut text-snow shadow-md' : 'bg-snow text-charcoal hover:shadow-md'
                            }`}
                          >
                            {g}
                          </button>
                        )
                      })}
                    </div>

                    <label className="block text-charcoal font-semibold text-sm mb-2">Instruments</label>
                    <input
                      type="text"
                      placeholder="Acoustic guitar, vocals..."
                      value={role.instruments}
                      onChange={e => setRole(prev => ({ ...prev, instruments: e.target.value }))}
                      className="w-full bg-snow rounded-xl px-4 py-3.5 mb-5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                    />

                    <label className="block text-charcoal font-semibold text-sm mb-2">Years performing</label>
                    <input
                      type="number"
                      placeholder="3"
                      value={role.yearsPerforming}
                      onChange={e => setRole(prev => ({ ...prev, yearsPerforming: e.target.value }))}
                      className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                    />
                  </>
                )}

                {userType === 'fan' && (
                  <>
                    <label className="block text-charcoal font-semibold text-sm mb-2">Pick a few favorite genres</label>
                    <div className="flex flex-wrap gap-2">
                      {GENRES.map(g => {
                        const active = role.favoriteGenres.includes(g)
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setRole(prev => ({ ...prev, favoriteGenres: toggleArrayItem(prev.favoriteGenres, g) }))}
                            className={`px-3.5 py-2 rounded-xl font-bold text-sm shadow-sm transition-all ${
                              active ? 'bg-chestnut text-snow shadow-md' : 'bg-snow text-charcoal hover:shadow-md'
                            }`}
                          >
                            {g}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 4 && (
              <div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3">— Round it out</p>
                <h2 className="text-graphite text-3xl md:text-4xl font-black tracking-tight mb-2">
                  A few <span className="text-chestnut italic">finishing touches.</span>
                </h2>
                <p className="text-charcoal mb-8">All optional. You can always add these later from your profile.</p>

                <label className="block text-charcoal font-semibold text-sm mb-2">Short bio</label>
                <textarea
                  rows={3}
                  placeholder="A line or two about who you are..."
                  value={social.bio}
                  onChange={e => setSocial(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full bg-snow rounded-xl px-4 py-3.5 mb-5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite resize-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SocialInput label="Instagram"  prefix="@" value={social.instagram} onChange={v => setSocial(p => ({ ...p, instagram: v }))} />
                  <SocialInput label="TikTok"     prefix="@" value={social.tiktok}    onChange={v => setSocial(p => ({ ...p, tiktok: v }))} />
                  <SocialInput label="Spotify"    prefix="🎵" value={social.spotify}   onChange={v => setSocial(p => ({ ...p, spotify: v }))} placeholder="profile URL" />
                  <SocialInput label="YouTube"    prefix="▶"  value={social.youtube}   onChange={v => setSocial(p => ({ ...p, youtube: v }))} placeholder="channel URL" />
                  <div className="sm:col-span-2">
                    <SocialInput label="Website"  prefix="🌐" value={social.website}   onChange={v => setSocial(p => ({ ...p, website: v }))} placeholder="https://..." />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5 — Stripe Connect (musicians only) */}
            {step === 5 && userType === 'musician' && (
              <div>
                <div className="w-16 h-16 bg-chestnut/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">🏦</div>
                <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-3 text-center">— Get paid</p>
                <h2 className="text-graphite text-3xl md:text-4xl font-black tracking-tight mb-2 text-center">
                  Set up <span className="text-chestnut italic">payouts.</span>
                </h2>
                <p className="text-charcoal mb-6 text-center leading-relaxed">
                  Connect your bank account to receive payment for gigs directly through Drum Up.
                  It only takes a couple of minutes.
                </p>
                <button
                  type="button"
                  onClick={connectStripe}
                  disabled={stripeConnecting}
                  className="w-full bg-chestnut text-snow font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mb-4"
                >
                  {stripeConnecting
                    ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Connecting…</>
                    : <>🔗 Connect Bank Account</>}
                </button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={finish}
                    disabled={submitting || stripeConnecting}
                    className="text-charcoal/60 text-sm hover:text-charcoal transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving…' : 'Skip for now'}
                  </button>
                  <p className="text-charcoal/40 text-xs mt-1">You won't receive payment until this is set up.</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-100 text-red-600 p-3 rounded-xl mt-6 text-sm">
                <p>{error}</p>
                {sessionFailed && (
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-2 font-bold underline hover:no-underline"
                  >
                    Refresh Page
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer nav — hidden on Step 5 (has its own action buttons) */}
          {!(userType === 'musician' && step === 5) && (
          <div className="flex items-center justify-between mt-5 px-1">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || submitting}
              className="text-charcoal font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-white/60 transition-colors disabled:opacity-30 disabled:hover:bg-transparent flex items-center gap-1.5"
            >
              <span>←</span> Back
            </button>

            <div className="flex items-center gap-2">
              {step > 2 && (
                <button
                  type="button"
                  onClick={next}
                  disabled={submitting}
                  className="text-charcoal font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-white/60 transition-colors disabled:opacity-30"
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={submitting || (step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                className="bg-chestnut text-snow font-bold text-sm px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
              >
                {submitting
                  ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Saving…</>
                  : step === totalSteps
                    ? <>Finish <span className="group-hover:translate-x-0.5 transition-transform">✓</span></>
                    : <>Next <span className="group-hover:translate-x-0.5 transition-transform">→</span></>}
              </button>
            </div>
          </div>
          )}
        </div>
      </main>
    </div>
  )
}

function SocialInput({
  label, prefix, value, onChange, placeholder,
}: {
  label: string
  prefix: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-charcoal font-semibold text-sm mb-2">{label}</label>
      <div className="flex items-center bg-snow rounded-xl shadow-sm focus-within:shadow-md transition-shadow overflow-hidden">
        <span className="pl-4 pr-2 text-charcoal/60 text-base">{prefix}</span>
        <input
          type="text"
          placeholder={placeholder ?? 'username'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 bg-transparent py-3.5 pr-4 focus:outline-none text-graphite text-sm border-none"
        />
      </div>
    </div>
  )
}
