'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type UserType = 'restaurant' | 'musician' | 'fan'

const TOTAL_STEPS = 3

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
  fullName: string
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
  const [userType, setUserType] = useState<UserType>('fan')
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)

  const [basic, setBasic] = useState<BasicInfo>({
    fullName: '',
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
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUserId(user.id)
      const t = (user.user_metadata?.user_type as UserType) || 'fan'
      setUserType(t)
      const meta = user.user_metadata ?? {}
      setBasic(prev => ({
        ...prev,
        fullName: meta.full_name ?? meta.name ?? '',
        avatarPreview: meta.avatar_url ?? '',
      }))
      setLoading(false)
    }
    init()
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

  const step1Valid = basic.fullName.trim().length > 0 && basic.locationText.trim().length > 0

  const next = () => {
    setError('')
    if (step === 1 && !step1Valid) {
      setError('Please enter your name and location to continue.')
      return
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1)
    else finish()
  }
  const back = () => {
    setError('')
    if (step > 1) setStep(s => s - 1)
  }

  const finish = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You\'re no longer signed in. Please log in again.')
      if (user.id !== userId) {
        console.warn('Auth user id changed since mount', { mounted: userId, current: user.id })
      }

      let avatarUrl = basic.avatarPreview.startsWith('blob:') ? '' : basic.avatarPreview
      if (basic.avatarFile) {
        const ext = basic.avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/avatar-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, basic.avatarFile, { upsert: true, contentType: basic.avatarFile.type })
        if (upErr) {
          console.error('Avatar upload failed', upErr)
          throw upErr
        }
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
        user_type: userType,
        full_name: basic.fullName || null,
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

      console.log('Upserting profile', profileRow)
      const { error: upsertErr } = await supabase.from('profiles').upsert(profileRow)
      if (upsertErr) {
        console.error('Profile upsert failed', upsertErr)
        throw upsertErr
      }
      router.push('/dashboard')
    } catch (e) {
      console.error('Onboarding finish failed', e)
      setError(formatError(e))
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
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
            Step {step} of {TOTAL_STEPS}
          </span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-6 md:px-12 mb-6 md:mb-10">
        <div className="h-1.5 bg-white/70 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-chestnut transition-all duration-500 ease-out rounded-full"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <main className="flex-1 px-4 md:px-6 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm p-6 md:p-10">

            {step === 1 && (
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

                {/* Full name */}
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

            {step === 2 && (
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

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-charcoal font-semibold text-sm mb-2">Setup</label>
                        <div className="grid grid-cols-3 gap-2">
                          {SOLO_BAND.map(opt => {
                            const active = role.soloOrBand === opt
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setRole(prev => ({ ...prev, soloOrBand: opt }))}
                                className={`py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all ${
                                  active ? 'bg-chestnut text-snow shadow-md' : 'bg-snow text-charcoal hover:shadow-md'
                                }`}
                              >
                                {opt}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="block text-charcoal font-semibold text-sm mb-2">Years performing</label>
                        <input
                          type="number"
                          placeholder="3"
                          value={role.yearsPerforming}
                          onChange={e => setRole(prev => ({ ...prev, yearsPerforming: e.target.value }))}
                          className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                        />
                      </div>
                    </div>
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

            {step === 3 && (
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

            {error && (
              <p className="bg-red-100 text-red-600 p-3 rounded-xl mt-6 text-sm">{error}</p>
            )}
          </div>

          {/* Footer nav */}
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
              {step !== 1 && (
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
                disabled={submitting || (step === 1 && !step1Valid)}
                className="bg-chestnut text-snow font-bold text-sm px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
              >
                {submitting
                  ? 'Saving...'
                  : step === TOTAL_STEPS
                    ? <>Finish <span className="group-hover:translate-x-0.5 transition-transform">✓</span></>
                    : <>Next <span className="group-hover:translate-x-0.5 transition-transform">→</span></>}
              </button>
            </div>
          </div>
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
