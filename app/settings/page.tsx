'use client'

import { ChangeEvent, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type UserType = 'restaurant' | 'musician' | 'fan'

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

interface FormState {
  fullName: string
  avatarFile: File | null
  avatarPreview: string
  bannerFile: File | null
  bannerPreview: string
  locationText: string
  latitude: number | null
  longitude: number | null

  venueName: string
  capacity: string
  cuisineType: string
  musicNights: string[]

  genres: string[]
  instruments: string
  performerType: 'solo' | 'band' | ''
  bandMembers: string
  legalName: string
  yearsPerforming: string

  favoriteGenres: string[]

  maxDistance: number

  bio: string
  instagram: string
  tiktok: string
  spotify: string
  youtube: string
  website: string
}

const EMPTY: FormState = {
  fullName: '', avatarFile: null, avatarPreview: '', bannerFile: null, bannerPreview: '',
  locationText: '', latitude: null, longitude: null,
  venueName: '', capacity: '', cuisineType: '', musicNights: [],
  genres: [], instruments: '', performerType: '', bandMembers: '', legalName: '', yearsPerforming: '',
  favoriteGenres: [],
  maxDistance: 20,
  bio: '', instagram: '', tiktok: '', spotify: '', youtube: '', website: '',
}

function formatError(e: unknown): string {
  if (!e) return 'Something went wrong.'
  if (typeof e === 'string') return e
  if (typeof e === 'object') {
    const err = e as { message?: string; error?: string; details?: string; hint?: string; code?: string }
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

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)

  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [userType, setUserType] = useState<UserType>('fan')
  const [form, setForm] = useState<FormState>(EMPTY)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr) throw authErr
        if (!user) {
          router.push('/auth/login')
          return
        }
        setUserId(user.id)
        setEmail(user.email ?? '')

        const { data: profile, error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (pErr) throw pErr
        if (!profile) {
          router.push('/onboarding')
          return
        }

        const t = (profile.user_type as UserType) || (user.user_metadata?.user_type as UserType) || 'fan'
        setUserType(t)
        const meta = profile.role_metadata ?? {}

        setForm({
          fullName: profile.full_name ?? '',
          avatarFile: null,
          avatarPreview: profile.avatar_url ?? '',
          bannerFile: null,
          bannerPreview: (meta.banner_url as string | undefined) ?? '',
          locationText: profile.location_text ?? '',
          latitude: profile.latitude ?? null,
          longitude: profile.longitude ?? null,
          venueName: meta.venue_name ?? '',
          capacity: meta.capacity != null ? String(meta.capacity) : '',
          cuisineType: meta.cuisine_type ?? '',
          musicNights: Array.isArray(meta.music_nights) ? meta.music_nights : [],
          genres: Array.isArray(meta.genres) ? meta.genres : [],
          instruments: meta.instruments ?? '',
          performerType: (['solo', 'band'].includes(profile.performer_type ?? '') ? profile.performer_type : '') as 'solo' | 'band' | '',
          bandMembers: profile.band_members != null ? String(profile.band_members) : '',
          legalName: profile.legal_name ?? '',
          yearsPerforming: meta.years_performing != null ? String(meta.years_performing) : '',
          favoriteGenres: Array.isArray(meta.favorite_genres) ? meta.favorite_genres : [],
          maxDistance: typeof profile.max_distance_miles === 'number' ? profile.max_distance_miles : 20,
          bio: profile.bio ?? '',
          instagram: profile.instagram_url ?? '',
          tiktok: profile.tiktok_url ?? '',
          spotify: profile.spotify_url ?? '',
          youtube: profile.youtube_url ?? '',
          website: profile.website ?? '',
        })
      } catch (e) {
        console.error('Settings load failed', e)
        setError(formatError(e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
    setSavedAt(null)
  }
  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.')
      return
    }
    update('avatarFile', file)
    update('avatarPreview', URL.createObjectURL(file))
  }

  const handleBannerChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Banner image must be under 10MB.')
      return
    }
    update('bannerFile', file)
    update('bannerPreview', URL.createObjectURL(file))
  }

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
          setForm(prev => ({ ...prev, locationText: text, latitude: lat, longitude: lon }))
        } catch {
          setForm(prev => ({ ...prev, latitude: lat, longitude: lon, locationText: `${lat.toFixed(3)}, ${lon.toFixed(3)}` }))
        }
        setSavedAt(null)
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
    if (!form.locationText.trim()) return
    setLocationLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.locationText)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      )
      const data = await res.json()
      if (data[0]) {
        const display = data[0].display_name.split(',').slice(0, 2).join(',').trim()
        setForm(prev => ({
          ...prev,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          locationText: display,
        }))
      }
    } catch { /* noop */ }
    setLocationLoading(false)
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.error('Sign out failed', e)
    }
    router.push('/')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSavedAt(null)
    try {
      let avatarUrl = form.avatarPreview.startsWith('blob:') ? '' : form.avatarPreview
      if (form.avatarFile) {
        const ext = form.avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${userId}/avatar-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, form.avatarFile, { upsert: true, contentType: form.avatarFile.type })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = data.publicUrl
      }

      let bannerUrl = form.bannerPreview.startsWith('blob:') ? '' : form.bannerPreview
      if (form.bannerFile) {
        const ext = form.bannerFile.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${userId}/banner-${Date.now()}.${ext}`
        const { error: bannerUpErr } = await supabase.storage
          .from('avatars')
          .upload(path, form.bannerFile, { upsert: true, contentType: form.bannerFile.type })
        if (bannerUpErr) throw bannerUpErr
        const { data: bannerData } = supabase.storage.from('avatars').getPublicUrl(path)
        bannerUrl = bannerData.publicUrl
      }

      const roleMetadata: Record<string, unknown> = {}
      if (userType === 'restaurant') {
        roleMetadata.venue_name = form.venueName || null
        roleMetadata.capacity = form.capacity ? Number(form.capacity) : null
        roleMetadata.cuisine_type = form.cuisineType || null
        roleMetadata.music_nights = form.musicNights
        roleMetadata.banner_url = bannerUrl || null
      } else if (userType === 'musician') {
        roleMetadata.genres = form.genres
        roleMetadata.instruments = form.instruments || null
        roleMetadata.years_performing = form.yearsPerforming ? Number(form.yearsPerforming) : null
        roleMetadata.banner_url = bannerUrl || null
      } else {
        roleMetadata.favorite_genres = form.favoriteGenres
      }

      const { error: upErr } = await supabase.from('profiles').update({
        full_name: form.fullName || null,
        avatar_url: avatarUrl || null,
        location_text: form.locationText || null,
        latitude: form.latitude,
        longitude: form.longitude,
        max_distance_miles: form.maxDistance,
        bio: form.bio || null,
        instagram_url: form.instagram || null,
        tiktok_url: form.tiktok || null,
        spotify_url: form.spotify || null,
        youtube_url: form.youtube || null,
        website: form.website || null,
        ...(userType === 'musician' && {
          legal_name: form.legalName || null,
          performer_type: form.performerType || null,
          band_name: form.performerType === 'band' ? (form.fullName || null) : null,
          band_members: form.performerType === 'band' ? (parseInt(form.bandMembers) || null) : null,
        }),
        role_metadata: roleMetadata,
      }).eq('id', userId)

      if (upErr) throw upErr

      setForm(prev => ({ ...prev, avatarFile: null, avatarPreview: avatarUrl, bannerFile: null, bannerPreview: bannerUrl }))
      setSavedAt(Date.now())
    } catch (e) {
      console.error('Settings save failed', e)
      setError(formatError(e))
    } finally {
      setSaving(false)
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
      <header className="px-5 md:px-12 pt-6 pb-5 flex items-center justify-between gap-3">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-charcoal font-bold text-sm px-3 py-2 rounded-xl hover:bg-white/60 transition-colors"
        >
          <span>←</span> Dashboard
        </button>
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-xl p-1.5 shadow-sm">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
          </div>
          <span className="text-graphite font-black text-lg tracking-tight hidden sm:inline">Drum Up</span>
        </div>
        <span className="text-charcoal text-[10px] uppercase tracking-[0.25em] font-bold">Settings</span>
      </header>

      {/* Body */}
      <main className="flex-1 px-4 md:px-6 pb-32">
        <div className="max-w-2xl mx-auto space-y-5">

          {/* Page header */}
          <div className="px-1">
            <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.35em] mb-2">— Account</p>
            <h1 className="text-graphite text-3xl md:text-4xl font-black tracking-tight mb-1">
              Your <span className="text-chestnut italic">settings.</span>
            </h1>
            <p className="text-charcoal text-sm">Update anything from your onboarding here.</p>
          </div>

          {/* SECTION — Basic info */}
          <Card title="Basic info" eyebrow="01">
            <div className="flex items-center gap-5 mb-6">
              {form.avatarPreview ? (
                <img src={form.avatarPreview} alt="" className="w-20 h-20 rounded-2xl object-cover shadow-sm" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-snow shadow-sm flex items-center justify-center text-3xl text-chestnut">♪</div>
              )}
              <div>
                <label className="inline-block bg-snow text-graphite font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  {form.avatarPreview ? 'Change photo' : 'Upload photo'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </label>
                <p className="text-xs text-charcoal/60 mt-1.5">JPG or PNG, up to 5MB</p>
              </div>
            </div>

            <Field label={userType === 'restaurant' ? 'Contact name' : userType === 'musician' ? 'Stage name / band name' : 'Full name'}
              hint={userType === 'musician' ? 'How you appear publicly to venues and fans' : undefined}>
              <Input value={form.fullName} onChange={v => update('fullName', v)} placeholder={userType === 'musician' ? 'e.g. Johnny Blues or The Midnight Blues' : 'Your name'} />
            </Field>

            <Field label="Location" hint={form.latitude !== null ? `Coords saved (${form.latitude.toFixed(3)}, ${form.longitude?.toFixed(3)})` : undefined}>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="e.g. Philadelphia, PA"
                  value={form.locationText}
                  onChange={e => { update('locationText', e.target.value); update('latitude', null); update('longitude', null) }}
                  onBlur={lookupCity}
                  className="flex-1 bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationLoading}
                  className="bg-teal text-snow font-bold px-5 py-3.5 rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50 whitespace-nowrap text-sm flex items-center justify-center gap-2"
                >
                  {locationLoading
                    ? <span className="w-4 h-4 border-2 border-snow border-t-transparent rounded-full animate-spin" />
                    : <span>📍</span>}
                  Use my location
                </button>
              </div>
            </Field>
          </Card>

          {/* SECTION — Role-specific */}
          <Card
            title={userType === 'restaurant' ? 'Venue details' : userType === 'musician' ? 'Your sound' : 'Your taste'}
            eyebrow="02"
          >
            {userType === 'restaurant' && (
              <>
                <Field label="Banner photo">
                  <div className="relative rounded-2xl overflow-hidden mb-2" style={{ aspectRatio: '3/1', minHeight: 96 }}>
                    {form.bannerPreview && /^(https?:\/\/|blob:)/.test(form.bannerPreview) ? (
                      <img src={form.bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-20 select-none" style={{ background: 'linear-gradient(135deg, #DC7F41 0%, #3D2419 100%)' }}>🍽</div>
                    )}
                  </div>
                  <label className="inline-block bg-snow text-graphite font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    {form.bannerPreview ? 'Change banner' : 'Upload banner'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                  </label>
                  <p className="text-xs text-charcoal/60 mt-1.5">Landscape photo (3:1 ratio works best), up to 10MB</p>
                </Field>
                <Field label="Venue name">
                  <Input value={form.venueName} onChange={v => update('venueName', v)} placeholder="The Lantern Room" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Capacity">
                    <Input value={form.capacity} onChange={v => update('capacity', v)} type="number" placeholder="80" />
                  </Field>
                  <Field label="Cuisine">
                    <Input value={form.cuisineType} onChange={v => update('cuisineType', v)} placeholder="Italian, Tapas..." />
                  </Field>
                </div>
                <Field label="Typical music nights">
                  <ChipRow
                    items={NIGHTS}
                    selected={form.musicNights}
                    onToggle={n => update('musicNights', toggleArrayItem(form.musicNights, n))}
                  />
                </Field>
              </>
            )}

            {userType === 'musician' && (
              <>
                <Field label="Cover photo">
                  <div className="relative rounded-2xl overflow-hidden mb-2" style={{ aspectRatio: '3/1', minHeight: 96 }}>
                    {form.bannerPreview && /^(https?:\/\/|blob:)/.test(form.bannerPreview) ? (
                      <img src={form.bannerPreview} alt="Cover preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-20 select-none" style={{ background: 'linear-gradient(135deg, #DC7F41 0%, #2A2A2A 100%)' }}>♪</div>
                    )}
                  </div>
                  <label className="inline-block bg-snow text-graphite font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    {form.bannerPreview ? 'Change cover' : 'Upload cover'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
                  </label>
                  <p className="text-xs text-charcoal/60 mt-1.5">Stage or press photo (landscape works best), up to 10MB</p>
                </Field>
                <Field label="Genres">
                  <ChipRow
                    items={GENRES}
                    selected={form.genres}
                    onToggle={g => update('genres', toggleArrayItem(form.genres, g))}
                  />
                </Field>
                <Field label="Instruments">
                  <Input value={form.instruments} onChange={v => update('instruments', v)} placeholder="Acoustic guitar, vocals..." />
                </Field>
                <Field label="Performer type">
                  <div className="grid grid-cols-2 gap-3">
                    {(['solo', 'band'] as const).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => update('performerType', val)}
                        className={`py-3 rounded-xl font-bold text-sm transition-all flex flex-col items-center gap-1 ${
                          form.performerType === val
                            ? 'bg-chestnut text-snow shadow-md'
                            : 'bg-snow text-charcoal border border-charcoal/20 hover:shadow-md'
                        }`}
                      >
                        <span className="text-xl">{val === 'solo' ? '🎤' : '🎸'}</span>
                        <span>{val === 'solo' ? 'Solo Artist' : 'Band'}</span>
                      </button>
                    ))}
                  </div>
                </Field>
                {form.performerType === 'band' && (
                  <Field label="Number of members">
                    <Input value={form.bandMembers} onChange={v => update('bandMembers', v)} type="number" placeholder="4" />
                  </Field>
                )}
                <Field label="Years performing">
                  <Input value={form.yearsPerforming} onChange={v => update('yearsPerforming', v)} type="number" placeholder="3" />
                </Field>
                <Field label="🔒 Legal name">
                  <Input
                    value={form.legalName}
                    onChange={v => update('legalName', v)}
                    placeholder="First and last name as on your ID"
                  />
                  <p className="text-charcoal/50 text-xs italic mt-1.5">Private — only used for payment verification. Never shown publicly.</p>
                </Field>
              </>
            )}

            {userType === 'fan' && (
              <Field label="Favorite genres">
                <ChipRow
                  items={GENRES}
                  selected={form.favoriteGenres}
                  onToggle={g => update('favoriteGenres', toggleArrayItem(form.favoriteGenres, g))}
                />
              </Field>
            )}
          </Card>

          {/* SECTION — Discovery radius (musicians + fans) */}
          {userType !== 'restaurant' && (
            <Card title="Discovery radius" eyebrow="2.5">
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <label className="text-charcoal font-semibold text-sm">
                    {userType === 'musician'
                      ? 'How far would you travel for a gig?'
                      : 'Show shows within…'}
                  </label>
                  <span className="text-graphite font-black text-2xl tabular-nums">
                    {form.maxDistance}<span className="text-charcoal text-sm font-bold ml-1">mi</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={form.maxDistance}
                  onChange={e => update('maxDistance', Number(e.target.value))}
                  className="w-full accent-chestnut h-2"
                />
                <div className="flex justify-between text-[10px] text-charcoal/60 font-bold uppercase tracking-wider mt-1">
                  <span>5 mi</span>
                  <span>50 mi</span>
                  <span>100 mi</span>
                </div>
                <p className="text-xs text-charcoal/70 mt-3">
                  {userType === 'musician'
                    ? 'Only restaurant slots within this radius of your location will show up under Browse Gigs.'
                    : 'Only shows within this radius of your location will appear in your feed.'}
                </p>
              </div>
            </Card>
          )}

          {/* SECTION — Bio + socials */}
          <Card title="Bio & links" eyebrow="03">
            <Field label="Short bio">
              <textarea
                rows={3}
                placeholder="A line or two about who you are..."
                value={form.bio}
                onChange={e => update('bio', e.target.value)}
                className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite resize-none"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SocialInput label="Instagram" prefix="@" value={form.instagram} onChange={v => update('instagram', v)} />
              <SocialInput label="TikTok"    prefix="@" value={form.tiktok}    onChange={v => update('tiktok', v)} />
              <SocialInput label="Spotify"   prefix="🎵" value={form.spotify}   onChange={v => update('spotify', v)} placeholder="profile URL" />
              <SocialInput label="YouTube"   prefix="▶"  value={form.youtube}   onChange={v => update('youtube', v)} placeholder="channel URL" />
              <div className="sm:col-span-2">
                <SocialInput label="Website" prefix="🌐" value={form.website} onChange={v => update('website', v)} placeholder="https://..." />
              </div>
            </div>
          </Card>

          {/* SECTION — Account */}
          <Card title="Account" eyebrow="04">
            <Field label="Email">
              <div className="bg-snow/60 rounded-xl px-4 py-3.5 text-charcoal text-sm shadow-inner">{email || '—'}</div>
            </Field>
            <Field label="Account type">
              <div className="bg-snow/60 rounded-xl px-4 py-3.5 text-charcoal text-sm shadow-inner capitalize">{userType}</div>
            </Field>
            <button
              onClick={handleLogout}
              className="text-chestnut font-bold text-sm hover:underline mt-2"
            >
              Log out
            </button>
          </Card>

          {error && (
            <p className="bg-red-100 text-red-600 p-3 rounded-xl text-sm">{error}</p>
          )}
        </div>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
        <div className="max-w-2xl mx-auto px-5 py-3.5 flex items-center justify-between gap-3">
          <span className="text-sm text-snow/60">
            {saving
              ? 'Saving…'
              : savedAt
                ? <span className="text-teal font-semibold">Saved ✓</span>
                : 'Changes save when you tap Save'}
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="bg-chestnut text-snow font-bold text-sm px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {saving
              ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg> Saving…</>
              : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Tiny presentational helpers (kept local — only used here) ----

function Card({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-graphite font-black text-xl tracking-tight">{title}</h2>
        <span className="text-chestnut/60 text-[10px] font-bold tracking-[0.3em]">{eyebrow}</span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-charcoal font-semibold text-sm mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-teal font-semibold mt-1.5 flex items-center gap-1.5">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal" />{hint}
      </p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-snow rounded-xl px-4 py-3.5 shadow-sm focus:outline-none focus:shadow-md transition-shadow border-none text-graphite"
    />
  )
}

function ChipRow({ items, selected, onToggle }: {
  items: string[]; selected: string[]; onToggle: (item: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => {
        const active = selected.includes(item)
        return (
          <button
            key={item}
            type="button"
            onClick={() => onToggle(item)}
            className={`px-3.5 py-2 rounded-xl font-bold text-sm shadow-sm transition-all ${
              active ? 'bg-chestnut text-snow shadow-md' : 'bg-snow text-charcoal hover:shadow-md'
            }`}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

function SocialInput({ label, prefix, value, onChange, placeholder }: {
  label: string; prefix: string; value: string; onChange: (v: string) => void; placeholder?: string
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
