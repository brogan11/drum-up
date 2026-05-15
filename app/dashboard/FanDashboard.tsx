'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ---- Types ----

type DiscoverView = 'venues' | 'musicians'

interface DiscoverVenue {
  id: string
  name: string
  type: string
  location: string
  avatar: string
  nextShow: string | null
}

interface DiscoverMusician {
  id: string
  name: string
  genres: string[]
  avatar: string
  bio: string
}

interface Show {
  id: string
  venueId: string
  venueName: string
  venueAvatar: string
  musicianName: string
  date: string
  rawDate: string
  time: string
  genres: string[]
  isTonight: boolean
}

interface FanProfile {
  name: string
  bio: string
  location: string
}

// ---- Initial data ----

const INITIAL_VENUES: DiscoverVenue[] = []
const INITIAL_MUSICIANS: DiscoverMusician[] = []
const INITIAL_SHOWS: Show[] = []
const INITIAL_PROFILE: FanProfile = { name: 'Your Name', bio: '', location: '' }

// ---- Main Component ----

export default function FanDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('feed')

  const [venues] = useState<DiscoverVenue[]>(INITIAL_VENUES)
  const [musicians] = useState<DiscoverMusician[]>(INITIAL_MUSICIANS)
  const [shows] = useState<Show[]>(INITIAL_SHOWS)

  const [followedVenueIds, setFollowedVenueIds] = useState<Set<string>>(new Set())
  const [followedMusicianIds, setFollowedMusicianIds] = useState<Set<string>>(new Set())

  const [discoverView, setDiscoverView] = useState<DiscoverView>('venues')
  const [discoverSearch, setDiscoverSearch] = useState('')

  const [profile, setProfile] = useState<FanProfile>(INITIAL_PROFILE)
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<FanProfile>(INITIAL_PROFILE)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleFollowVenue = (id: string) => {
    setFollowedVenueIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleFollowMusician = (id: string) => {
    setFollowedMusicianIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Derived
  const followingCount = followedVenueIds.size + followedMusicianIds.size
  const feedShows = shows.filter(s => followedVenueIds.has(s.venueId))
  const tonightShows = feedShows.filter(s => s.isTonight)
  const upcomingShows = feedShows.filter(s => !s.isTonight)
  const followedVenues = venues.filter(v => followedVenueIds.has(v.id))
  const followedMusicians = musicians.filter(m => followedMusicianIds.has(m.id))

  const filteredVenues = venues.filter(v => {
    const q = discoverSearch.toLowerCase()
    return !q || v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q) || v.location.toLowerCase().includes(q)
  })
  const filteredMusicians = musicians.filter(m => {
    const q = discoverSearch.toLowerCase()
    return !q || m.name.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q))
  })

  return (
    <div className="min-h-screen bg-snow pb-24">

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-snow/95 backdrop-blur-md border-b border-charcoal/10 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/orange-drum-up.png" alt="Drum Up" className="w-9 h-9 object-contain" />
          <h1 className="text-graphite text-lg font-black tracking-tight">Drum Up</h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-semibold text-charcoal hover:text-chestnut transition-colors bg-white border border-charcoal/10 px-3 py-1.5 rounded-lg"
        >
          Log Out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">

        {/* ---- FEED TAB ---- */}
        {activeTab === 'feed' && (
          <>
            {/* Profile strip */}
            <div className="bg-graphite rounded-2xl p-5 shadow-md mb-5 flex items-center gap-4 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
              <div className="absolute right-8 -bottom-6 w-14 h-14 bg-white/5 rounded-full pointer-events-none" />
              <div className="w-14 h-14 rounded-xl bg-chestnut/20 border border-chestnut/20 flex items-center justify-center text-2xl shrink-0 relative z-10">★</div>
              <div className="flex-1 min-w-0 relative z-10">
                <p className="text-snow font-bold truncate">{profile.name}</p>
                <p className="text-snow/50 text-xs mt-0.5 truncate">
                  {profile.location || 'Set your location in Profile'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('discover')}
                className="bg-chestnut text-snow px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity shrink-0 relative z-10"
              >
                Discover
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2.5 mb-6">
              <StatCard value={followingCount} label="Following" color="text-chestnut" icon="❤️" bgColor="bg-chestnut/10" />
              <StatCard value={tonightShows.length} label="Tonight" color="text-teal" icon="🎶" bgColor="bg-teal/10" />
              <StatCard value={upcomingShows.length} label="This Week" color="text-graphite" icon="📅" bgColor="bg-graphite/10" />
            </div>

            {/* Tonight */}
            {tonightShows.length > 0 && (
              <>
                <SectionHeader title="Tonight" accent />
                <div className="space-y-3 mb-6">
                  {tonightShows.map(show => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              </>
            )}

            {/* Upcoming this week */}
            <SectionHeader title="Upcoming Shows" />
            {feedShows.length === 0 ? (
              <EmptyState
                icon="🎵"
                title="Your feed is empty"
                body="Follow some venues and musicians to see their upcoming shows here."
                action={{ label: 'Discover Music', onClick: () => setActiveTab('discover') }}
              />
            ) : upcomingShows.length === 0 ? (
              <EmptyState
                icon="📅"
                title="Nothing coming up this week"
                body="The venues you follow haven't posted upcoming shows yet. Check back soon."
              />
            ) : (
              <div className="space-y-3">
                {upcomingShows.map(show => (
                  <ShowCard key={show.id} show={show} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- DISCOVER TAB ---- */}
        {activeTab === 'discover' && (
          <>
            <h2 className="text-graphite text-xl font-black mb-4">Discover</h2>

            {/* Segmented control */}
            <div className="flex bg-white rounded-xl shadow-sm overflow-hidden border border-charcoal/10 mb-4">
              <button
                onClick={() => { setDiscoverView('venues'); setDiscoverSearch('') }}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${discoverView === 'venues' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
              >
                🍽 Venues
              </button>
              <button
                onClick={() => { setDiscoverView('musicians'); setDiscoverSearch('') }}
                className={`flex-1 py-2.5 text-sm font-bold transition-all ${discoverView === 'musicians' ? 'bg-graphite text-snow' : 'text-charcoal hover:bg-snow'}`}
              >
                ♪ Musicians
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-charcoal/40 text-sm pointer-events-none">🔍</span>
              <input
                value={discoverSearch}
                onChange={e => setDiscoverSearch(e.target.value)}
                placeholder={discoverView === 'venues' ? 'Search by name, type, or location...' : 'Search by name or genre...'}
                className="w-full bg-white rounded-xl pl-10 pr-4 py-3 shadow-sm focus:outline-none focus:shadow-md transition-shadow text-sm"
              />
            </div>

            {/* Venues list */}
            {discoverView === 'venues' && (
              filteredVenues.length === 0 ? (
                <EmptyState
                  icon="🍽"
                  title="No venues yet"
                  body="Venues join Drum Up to post live music nights. Check back as the community grows."
                />
              ) : (
                <div className="space-y-3">
                  {filteredVenues.map(v => {
                    const isFollowing = followedVenueIds.has(v.id)
                    return (
                      <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-teal/10 rounded-full flex items-center justify-center text-2xl shrink-0">{v.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-graphite font-bold text-sm">{v.name}</p>
                          <p className="text-charcoal text-xs">{v.type} · {v.location}</p>
                          {v.nextShow && (
                            <p className="text-chestnut text-xs font-semibold mt-0.5">Next show: {v.nextShow}</p>
                          )}
                        </div>
                        <button
                          onClick={() => toggleFollowVenue(v.id)}
                          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            isFollowing
                              ? 'bg-chestnut/10 text-chestnut hover:bg-red-50 hover:text-red-500'
                              : 'bg-chestnut text-snow hover:opacity-90'
                          }`}
                        >
                          {isFollowing ? 'Following' : '+ Follow'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Musicians list */}
            {discoverView === 'musicians' && (
              filteredMusicians.length === 0 ? (
                <EmptyState
                  icon="♪"
                  title="No musicians yet"
                  body="Musicians join Drum Up to book gigs. They'll appear here as the community grows."
                />
              ) : (
                <div className="space-y-3">
                  {filteredMusicians.map(m => {
                    const isFollowing = followedMusicianIds.has(m.id)
                    return (
                      <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center gap-4 mb-2">
                          <div className="w-12 h-12 bg-chestnut/10 rounded-full flex items-center justify-center text-2xl shrink-0">{m.avatar}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-graphite font-bold text-sm">{m.name}</p>
                            <p className="text-charcoal text-xs">{m.genres.join(' · ')}</p>
                          </div>
                          <button
                            onClick={() => toggleFollowMusician(m.id)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                              isFollowing
                                ? 'bg-chestnut/10 text-chestnut hover:bg-red-50 hover:text-red-500'
                                : 'bg-chestnut text-snow hover:opacity-90'
                            }`}
                          >
                            {isFollowing ? 'Following' : '+ Follow'}
                          </button>
                        </div>
                        {m.bio && <p className="text-charcoal text-xs leading-relaxed pl-16">{m.bio}</p>}
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </>
        )}

        {/* ---- FOLLOWING TAB ---- */}
        {activeTab === 'following' && (
          <>
            <h2 className="text-graphite text-xl font-black mb-4">Following</h2>

            {followingCount === 0 ? (
              <EmptyState
                icon="❤️"
                title="Not following anyone yet"
                body="Discover venues and musicians and follow them to see their shows in your feed."
                action={{ label: 'Start Discovering', onClick: () => setActiveTab('discover') }}
              />
            ) : (
              <>
                {/* Followed venues */}
                {followedVenues.length > 0 && (
                  <>
                    <SectionHeader title={`Venues · ${followedVenues.length}`} />
                    <div className="space-y-2 mb-6">
                      {followedVenues.map(v => (
                        <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                          <div className="w-11 h-11 bg-teal/10 rounded-full flex items-center justify-center text-xl shrink-0">{v.avatar}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-graphite font-bold text-sm truncate">{v.name}</p>
                            <p className="text-charcoal text-xs">{v.type} · {v.location}</p>
                          </div>
                          <button
                            onClick={() => toggleFollowVenue(v.id)}
                            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            Unfollow
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Followed musicians */}
                {followedMusicians.length > 0 && (
                  <>
                    <SectionHeader title={`Musicians · ${followedMusicians.length}`} />
                    <div className="space-y-2">
                      {followedMusicians.map(m => (
                        <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                          <div className="w-11 h-11 bg-chestnut/10 rounded-full flex items-center justify-center text-xl shrink-0">{m.avatar}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-graphite font-bold text-sm truncate">{m.name}</p>
                            <p className="text-charcoal text-xs">{m.genres.join(' · ')}</p>
                          </div>
                          <button
                            onClick={() => toggleFollowMusician(m.id)}
                            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold bg-charcoal/10 text-charcoal hover:bg-red-50 hover:text-red-500 transition-all"
                          >
                            Unfollow
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---- PROFILE TAB ---- */}
        {activeTab === 'profile' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-graphite text-xl font-black">Your Profile</h2>
              {!editingProfile ? (
                <button onClick={() => { setEditingProfile(true); setProfileDraft(profile) }} className="text-chestnut text-sm font-bold hover:underline">Edit</button>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setEditingProfile(false)} className="text-charcoal text-sm font-medium hover:underline">Cancel</button>
                  <button onClick={() => { setProfile(profileDraft); setEditingProfile(false) }} className="bg-chestnut text-snow px-4 py-1.5 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Save</button>
                </div>
              )}
            </div>

            {/* Hero card */}
            <div className="bg-graphite rounded-2xl p-6 shadow-md mb-4 flex flex-col items-center relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/5 rounded-full pointer-events-none" />
              <div className="absolute right-10 -bottom-6 w-14 h-14 bg-white/5 rounded-full pointer-events-none" />
              <div className="w-24 h-24 bg-chestnut/20 border-2 border-chestnut/20 rounded-2xl flex items-center justify-center text-5xl mb-3 relative z-10">★</div>
              <p className="text-snow font-bold text-lg relative z-10">{profile.name}</p>
              {profile.location && (
                <p className="text-snow/50 text-sm relative z-10 mt-0.5">📍 {profile.location}</p>
              )}
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-chestnut text-2xl font-black">{followedVenueIds.size}</p>
                <p className="text-charcoal text-xs font-medium mt-0.5">Venues Following</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-chestnut text-2xl font-black">{followedMusicianIds.size}</p>
                <p className="text-charcoal text-xs font-medium mt-0.5">Musicians Following</p>
              </div>
            </div>

            {/* Edit fields */}
            <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4 mb-4">
              <ProfileField
                label="Display Name"
                value={editingProfile ? profileDraft.name : profile.name}
                editing={editingProfile}
                onChange={v => setProfileDraft(p => ({ ...p, name: v }))}
              />
              <ProfileField
                label="Bio"
                value={editingProfile ? profileDraft.bio : profile.bio}
                editing={editingProfile}
                onChange={v => setProfileDraft(p => ({ ...p, bio: v }))}
                multiline
                placeholder="Tell us what kind of music you love..."
              />
              <ProfileField
                label="Location"
                value={editingProfile ? profileDraft.location : profile.location}
                editing={editingProfile}
                onChange={v => setProfileDraft(p => ({ ...p, location: v }))}
                placeholder="City, State"
              />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="text-graphite font-bold mb-3">Account</h3>
              <button onClick={handleLogout} className="w-full text-left text-sm text-charcoal hover:text-chestnut transition-colors py-1 font-medium">
                Log Out
              </button>
            </div>
          </>
        )}

      </main>

      {/* ---- BOTTOM TAB BAR ---- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-snow/95 backdrop-blur-md border-t border-charcoal/10 z-40">
        <div className="max-w-2xl mx-auto grid grid-cols-4">
          <TabButton icon="🎶" label="Feed"      active={activeTab === 'feed'}      onClick={() => setActiveTab('feed')} />
          <TabButton icon="🔍" label="Discover"  active={activeTab === 'discover'}  onClick={() => setActiveTab('discover')} />
          <TabButton icon="❤️" label="Following" active={activeTab === 'following'} onClick={() => setActiveTab('following')} badge={followingCount} />
          <TabButton icon="★"  label="Profile"   active={activeTab === 'profile'}   onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

    </div>
  )
}

// ---- Sub-components ----

function ShowCard({ show }: { show: Show }) {
  const [, datePart] = show.date.split(', ')
  const [mon, day] = (datePart || show.date).split(' ')
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
      <div className="bg-chestnut/10 rounded-xl px-3 py-2.5 text-center shrink-0 min-w-[52px]">
        {show.isTonight ? (
          <>
            <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">LIVE</p>
            <p className="text-chestnut text-lg font-black leading-tight">★</p>
          </>
        ) : (
          <>
            <p className="text-chestnut text-[10px] font-black uppercase tracking-wide">{mon}</p>
            <p className="text-chestnut text-2xl font-black leading-tight">{day}</p>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-graphite font-bold text-sm truncate">{show.musicianName}</p>
        <p className="text-charcoal text-xs mt-0.5">@ {show.venueName} · {show.time}</p>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {show.genres.map(g => (
            <span key={g} className="text-[10px] bg-snow text-charcoal px-2 py-0.5 rounded-full font-medium">{g}</span>
          ))}
        </div>
      </div>
      <div className="w-10 h-10 bg-teal/10 rounded-full flex items-center justify-center text-xl shrink-0">{show.venueAvatar}</div>
    </div>
  )
}

function SectionHeader({ title, accent }: { title: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`w-1 h-5 rounded-full ${accent ? 'bg-teal' : 'bg-chestnut'}`} />
      <h3 className="text-graphite font-bold">{title}</h3>
      {accent && (
        <span className="bg-teal/10 text-teal text-[10px] font-black px-2 py-0.5 rounded-full tracking-widest uppercase">Live</span>
      )}
    </div>
  )
}

function EmptyState({ icon, title, body, action }: {
  icon: string
  title: string
  body: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
      <div className="w-16 h-16 bg-chestnut/10 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">{icon}</div>
      <p className="text-graphite font-bold mb-2">{title}</p>
      <p className="text-charcoal text-sm leading-relaxed mb-4">{body}</p>
      {action && (
        <button onClick={action.onClick} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:opacity-90 transition-opacity">
          {action.label}
        </button>
      )}
    </div>
  )
}

function StatCard({ value, label, color, icon, bgColor }: {
  value: number
  label: string
  color: string
  icon: string
  bgColor: string
}) {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
      <div className={`w-9 h-9 ${bgColor} rounded-xl flex items-center justify-center mx-auto mb-2 text-lg`}>{icon}</div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-charcoal text-[10px] font-medium mt-0.5">{label}</p>
    </div>
  )
}

function TabButton({ icon, label, active, onClick, badge }: {
  icon: string
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button onClick={onClick} className="py-3 flex flex-col items-center gap-0.5 transition-colors relative">
      {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-chestnut rounded-full" />}
      <span className="text-xl">{icon}</span>
      <span className={`text-[10px] font-semibold ${active ? 'text-chestnut' : 'text-charcoal'}`}>{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute top-2 right-[calc(50%-14px)] w-4 h-4 bg-chestnut rounded-full text-[10px] text-snow font-bold flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  )
}

function ProfileField({ label, value, editing, onChange, multiline, placeholder }: {
  label: string
  value: string
  editing: boolean
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">{label}</p>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={3}
            className="w-full bg-snow rounded-xl px-3 py-2 text-sm text-graphite focus:outline-none resize-none border border-charcoal/10"
            placeholder={placeholder}
          />
        ) : (
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-snow rounded-xl px-3 py-2 text-sm text-graphite focus:outline-none border border-charcoal/10"
            placeholder={placeholder}
          />
        )
      ) : (
        <p className="text-graphite text-sm">
          {value || <span className="text-charcoal/50">{placeholder || 'Not set'}</span>}
        </p>
      )}
    </div>
  )
}
