'use client'

// Shared dashboard sub-components, extracted from the three near-identical copies
// that lived in MusicianDashboard / RestaurantDashboard / FanDashboard. Each shared
// version is a faithful superset of the three originals — optional props reproduce
// the per-dashboard variations (Fan's `live` section header, the teal stat accent,
// the restaurant tab-icon styling, etc.) so rendered output is unchanged.

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { eqBarStyle } from '@/lib/eq'
import { buildSocialUrl } from '@/lib/social-urls'
import NotificationBell from '@/components/NotificationBell'

// ---- Social icons (shared by SocialLinks) ----
// Each takes the size class directly on the <svg> (matching the originals, where the
// dimension class lived on the svg, not a wrapper).

const IG_ICON = (cls: string) => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
const YT_ICON = (cls: string) => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 3 14 9-14 9V3z"/></svg>
const SP_ICON = (cls: string) => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>

// Renders the Instagram / YouTube / Spotify links (whichever are present) as inline
// <a> tags — the caller keeps its own wrapping container + presence guard. Two sizes:
// 'sm' (compact charcoal links, the common case) and 'pill' (snow rounded pills).
export function SocialLinks({ instagram, youtube, spotify, size = 'sm' }: {
  instagram?: string
  youtube?: string
  spotify?: string
  size?: 'sm' | 'pill'
}) {
  const linkClass = size === 'pill'
    ? 'inline-flex items-center gap-1.5 bg-snow px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal hover:bg-[#E8E4E0] transition-colors'
    : 'inline-flex items-center gap-1 text-[10px] text-charcoal/60 hover:text-chestnut font-medium transition-colors'
  const iconClass = size === 'pill' ? 'w-3 h-3' : 'w-2.5 h-2.5'
  const items: { value: string | undefined; platform: string; icon: (cls: string) => React.ReactNode; label: string }[] = [
    { value: instagram, platform: 'instagram', icon: IG_ICON, label: 'Instagram' },
    { value: youtube, platform: 'youtube', icon: YT_ICON, label: 'YouTube' },
    { value: spotify, platform: 'spotify', icon: SP_ICON, label: 'Spotify' },
  ]
  return (
    <>
      {items.map(it => it.value ? (
        <a key={it.platform} href={buildSocialUrl(it.platform, it.value)} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {it.icon(iconClass)}{it.label}
        </a>
      ) : null)}
    </>
  )
}

// ---- SectionHeader ----

export function SectionHeader({ title, eyebrow, accent, live }: {
  title: string
  eyebrow?: string
  accent?: string
  live?: boolean
}) {
  return (
    <div className="mb-5 mt-3">
      {(eyebrow || live) && (
        <div className="flex items-center gap-2 mb-1">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal" />
            </span>
          )}
          {eyebrow && <p className={`text-[10px] font-bold uppercase tracking-[0.3em] ${live ? 'text-teal' : 'text-chestnut'}`}>{eyebrow}</p>}
        </div>
      )}
      <h3 className="text-graphite text-[1.65rem] font-black tracking-tight leading-none">
        {title}
        {accent && <span className={`italic ${live ? 'text-teal' : 'text-chestnut'}`}> {accent}</span>}
      </h3>
    </div>
  )
}

// ---- EmptyState ----
// `seed` controls the decorative eq-bar pattern (Musician 23, Restaurant 17, Fan 29).
// `twoActions` is the Fan variant (two muted buttons instead of one solid CTA).

export function EmptyState({ icon, title, body, action, twoActions, seed = 23 }: {
  icon: React.ReactNode
  title: string
  body: string
  action?: { label: string; onClick: () => void }
  twoActions?: { label: string; onClick: () => void }[]
  seed?: number
}) {
  return (
    <div className="relative bg-graphite rounded-3xl overflow-hidden shadow-md">
      <div className="absolute inset-x-0 bottom-0 top-2/3 flex items-end justify-around opacity-[0.08] pointer-events-none">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="eq-bar w-1.5 bg-chestnut rounded-t" style={eqBarStyle(i, seed)} />
        ))}
      </div>
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-chestnut opacity-15 blur-2xl pointer-events-none" />
      <div className="relative z-10 p-8 text-center">
        <div className="w-16 h-16 bg-chestnut/20 border border-chestnut/30 rounded-2xl flex items-center justify-center text-chestnut mx-auto mb-4 shadow-inner">{icon}</div>
        <p className="text-snow font-black text-lg mb-1.5 tracking-tight">{title}</p>
        <p className="text-snow/60 text-sm leading-relaxed mb-5 max-w-xs mx-auto">{body}</p>
        {twoActions ? (
          <div className="flex gap-3 justify-center">
            {twoActions.map(a => (
              <button key={a.label} onClick={a.onClick} className="bg-chestnut/20 border border-chestnut/40 text-snow px-4 py-2 rounded-xl font-bold text-xs hover:bg-chestnut transition-colors">
                {a.label}
              </button>
            ))}
          </div>
        ) : action ? (
          <button onClick={action.onClick} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity">
            {action.label} →
          </button>
        ) : null}
      </div>
    </div>
  )
}

// ---- StatCard ----
// `accent` controls the highlight background (chestnut for Musician/Restaurant, teal
// for Fan). `iconPlacement` is 'corner' (large faded glyph, Musician/Fan) or 'top'
// (small top-right glyph, Restaurant).

export function StatCard({ value, label, color, icon, highlight, accent = 'chestnut', iconPlacement = 'corner' }: {
  value: number | string
  label: string
  color: string
  icon: React.ReactNode
  highlight?: boolean
  accent?: 'chestnut' | 'teal'
  iconPlacement?: 'corner' | 'top'
}) {
  const iconCls = iconPlacement === 'top'
    ? `absolute top-2 right-2 pointer-events-none ${highlight ? 'text-snow/20' : 'text-charcoal/10'}`
    : `absolute -bottom-1 -right-1 w-10 h-10 pointer-events-none select-none ${highlight ? 'opacity-20 text-snow' : 'opacity-10 text-graphite'}`
  if (highlight) {
    const bg = accent === 'teal' ? 'bg-teal' : 'bg-chestnut'
    const labelOpacity = accent === 'teal' ? 'text-snow/80' : 'text-snow/70'
    return (
      <div className={`relative ${bg} rounded-2xl p-4 shadow-md overflow-hidden`}>
        <span className={iconCls}>{icon}</span>
        <p className="text-snow text-3xl font-black tracking-tight leading-none">{value}</p>
        <p className={`${labelOpacity} text-[9px] font-bold uppercase tracking-[0.2em] mt-2`}>{label}</p>
      </div>
    )
  }
  return (
    <div className="relative bg-white rounded-2xl p-4 shadow-sm overflow-hidden">
      <span className={iconCls}>{icon}</span>
      <p className={`text-3xl font-black tracking-tight leading-none ${color}`}>{value}</p>
      <p className="text-charcoal text-[9px] font-bold uppercase tracking-[0.2em] mt-2">{label}</p>
    </div>
  )
}

// ---- TabButton + DashboardTabBar ----
// `iconWrapClass` is the icon-span sizing ('w-5 h-5' for Musician/Fan whose svgs carry
// no size; 'flex items-center justify-center' for Restaurant whose svgs are sized).
// `iconColorInactive` is the resting icon color (snow/50 for Musician/Fan, charcoal/60
// for Restaurant).

export interface TabItem {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  badge?: number
  animation?: string
}

export function TabButton({ icon, label, active, onClick, badge, animation = 'bounce', iconWrapClass = 'w-5 h-5', iconColorInactive = 'text-snow/50' }: TabItem & {
  iconWrapClass?: string
  iconColorInactive?: string
}) {
  return (
    <button onClick={onClick} className={`py-1 min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors relative tab-hover-${animation}`}>
      <div className={`relative w-11 h-9 rounded-xl flex items-center justify-center transition-all ${active ? 'bg-chestnut shadow-md' : ''}`}>
        <span className={`tab-icon ${iconWrapClass} ${active ? 'text-snow' : iconColorInactive}`}>{icon}</span>
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-chestnut border-2 border-graphite rounded-full text-[9px] text-snow font-bold flex items-center justify-center">
            {badge}
          </span>
        )}
      </div>
      <span className={`text-[10px] font-semibold tracking-wide ${active ? 'text-chestnut' : 'text-snow/50'}`}>{label}</span>
    </button>
  )
}

export function DashboardTabBar({ items, iconWrapClass, iconColorInactive }: {
  items: TabItem[]
  iconWrapClass?: string
  iconColorInactive?: string
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-graphite/95 backdrop-blur-md border-t border-charcoal/30 z-40">
      <div className="max-w-2xl mx-auto grid grid-cols-5 px-2 py-2">
        {items.map((it, i) => (
          <TabButton key={i} {...it} iconWrapClass={iconWrapClass} iconColorInactive={iconColorInactive} />
        ))}
      </div>
    </nav>
  )
}

// ---- ProfileField ----

export function ProfileField({ label, value, placeholder }: {
  label: string
  value: string
  placeholder?: string
}) {
  return (
    <div>
      <p className="text-charcoal text-xs font-semibold uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-graphite text-sm">
        {value || <span className="text-charcoal/50">{placeholder || 'Not set'}</span>}
      </p>
    </div>
  )
}

// ---- DashboardHeader ----
// The sticky top bar shared by all three dashboards: logo + "Drum Up" + live dot,
// then the notification bell and an avatar dropdown (View Profile / Settings / Log Out).
// Manages its own dropdown open state.

export function DashboardHeader({ profileName, avatarUrl, userId, onLogout }: {
  profileName: string
  avatarUrl?: string
  userId: string
  onLogout: () => void
}) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-graphite/95 border-b border-charcoal/30">
      <div className="max-w-2xl mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-lg p-1">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-6 h-6 object-contain" />
          </div>
          <h1 className="text-snow text-lg font-black tracking-tight">Drum Up</h1>
          <span className="relative flex h-2 w-2 ml-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chestnut opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-chestnut" />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell userId={userId} />
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Account menu" aria-expanded={menuOpen} aria-haspopup="menu" className="flex items-center gap-2 group">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-chestnut/40 group-hover:border-chestnut transition-colors" />
                : <div className="w-8 h-8 rounded-full bg-graphite border-2 border-chestnut/40 group-hover:border-chestnut transition-colors flex items-center justify-center text-snow text-xs font-black">
                    {profileName.slice(0, 2).toUpperCase() || 'DU'}
                  </div>}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl z-50 overflow-hidden border border-charcoal/10">
                  <button onClick={() => { router.push('/profile/' + userId); setMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> View Profile
                  </button>
                  <button onClick={() => { router.push('/settings'); setMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-semibold text-graphite hover:bg-snow transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Settings
                  </button>
                  <div className="border-t border-charcoal/10" />
                  <button onClick={() => { onLogout(); setMenuOpen(false) }} className="w-full px-4 py-3 text-left text-sm font-medium text-charcoal hover:bg-snow transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4 text-charcoal/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg> Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
