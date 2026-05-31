'use client'

// Shared presentational pieces for the analytics pages (musician + restaurant):
// the KPI metric card, a section card, empty state, the time-range tab switcher, and
// the page header. Charts themselves live in Charts.tsx.

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkline, CHART } from '@/components/Charts'
import { TrendingUp } from '@/components/Icons'
import type { Range } from '@/lib/analytics'

export function AnalyticsHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const router = useRouter()
  return (
    <header className="sticky top-0 z-30 bg-graphite/95 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} aria-label="Back to dashboard" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-snow">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-snow font-black text-xl leading-tight">{title}</h1>
          <p className="text-snow/50 text-xs font-medium truncate">{subtitle}</p>
        </div>
        <TrendingUp className="w-5 h-5 text-chestnut" />
      </div>
    </header>
  )
}

export function RangeTabs({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="inline-flex bg-white rounded-xl shadow-sm p-1">
      {(['30d', '90d', '12mo', 'all'] as Range[]).map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${value === r ? 'bg-chestnut text-snow' : 'text-charcoal/60 hover:text-graphite'}`}
        >
          {r === '12mo' ? '12 mo' : r === 'all' ? 'All' : r}
        </button>
      ))}
    </div>
  )
}

export function Kpi({
  icon, label, value, sub, delta, spark, sparkColor = CHART.chestnut, accent = CHART.chestnut,
}: {
  icon: ReactNode
  label: string
  value: string
  sub?: string
  delta?: number | null
  spark?: number[]
  sparkColor?: string
  accent?: string
}) {
  const hasSpark = !!spark && spark.some(v => v > 0)
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: accent + '22', color: accent }}>{icon}</span>
        <span className="text-charcoal/55 text-[11px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-graphite text-2xl sm:text-[28px] font-black leading-none">{value}</p>
        {delta != null && (
          <span className={`text-xs font-bold flex items-center gap-0.5 ${delta >= 0 ? 'text-teal' : 'text-charcoal/50'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))}%
          </span>
        )}
      </div>
      {hasSpark && <div className="mt-2 -mb-1"><Sparkline data={spark!} color={sparkColor} height={30} /></div>}
      {sub && <p className="text-charcoal/45 text-xs font-medium mt-1.5">{sub}</p>}
    </div>
  )
}

export function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="mb-4">
        <p className="text-graphite font-bold text-sm">{title}</p>
        {subtitle && <p className="text-charcoal/50 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export function EmptyCard({ label }: { label: string }) {
  return <div className="flex items-center justify-center text-charcoal/40 text-sm font-medium py-10">{label}</div>
}

export function InsightsCard({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null
  return (
    <div className="bg-graphite rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-chestnut" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></svg>
        <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.3em]">Insights</p>
      </div>
      <ul className="space-y-2.5">
        {insights.map((t, i) => (
          <li key={i} className="flex gap-2.5 text-snow/90 text-sm leading-snug">
            <span className="text-chestnut mt-0.5 shrink-0">●</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
