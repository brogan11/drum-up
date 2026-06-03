// Shared analytics helpers used by both the musician and restaurant analytics pages.
// Pure functions only — no React — so they can be imported anywhere.

export type Range = '30d' | '90d' | '12mo' | 'all'

// The brand dashboard background (radial glows over #E8E4E0). Applied to the page root.
export const DASH_BG = {
  background:
    'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0',
}

export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

// Canonical money formatter for all customer-facing amounts (gig pay, fees,
// payouts, spend). Shows cents only when the value isn't a whole dollar, so
// whole-dollar pay reads as "$200" while an 8% fee reads as "$16.80".
export const formatMoney = (n: number | null | undefined) => {
  const v = Number(n) || 0
  return '$' + v.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export const moneyAxis = (n: number) => (n >= 1000 ? '$' + (n / 1000).toFixed(0) + 'k' : '$' + Math.round(n))

// Percent change of `cur` vs `prev`. null when there's no meaningful baseline.
export function pctDelta(cur: number, prev: number): number | null {
  if (prev > 0) return ((cur - prev) / prev) * 100
  return cur > 0 ? 100 : null
}

export interface Bucket { label: string; start: Date; end: Date }

// Build evenly-spaced time buckets for the selected range. 30d/90d → daily, 12mo → monthly,
// all → monthly from the earliest data point (capped at 36 months).
export function buildBuckets(range: Range, earliest: Date): Bucket[] {
  const now = new Date()
  const out: Bucket[] = []
  if (range === '30d' || range === '90d') {
    const days = range === '30d' ? 30 : 90
    for (let i = days - 1; i >= 0; i--) {
      const s = new Date(now)
      s.setHours(0, 0, 0, 0)
      s.setDate(s.getDate() - i)
      const e = new Date(s)
      e.setDate(e.getDate() + 1)
      out.push({ label: `${s.getMonth() + 1}/${s.getDate()}`, start: s, end: e })
    }
  } else {
    let count = 12
    if (range === 'all') {
      count = (now.getFullYear() - earliest.getFullYear()) * 12 + (now.getMonth() - earliest.getMonth()) + 1
      count = Math.min(Math.max(count, 1), 36)
    }
    for (let i = count - 1; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const showYear = count > 12
      out.push({
        label: s.toLocaleDateString('en-US', { month: 'short' }) + (showYear ? ` '${String(s.getFullYear()).slice(2)}` : ''),
        start: s,
        end: e,
      })
    }
  }
  return out
}

// Aggregate { date, value } items into the buckets. `cumulative` produces a running total
// (for growth curves like followers).
export function series(
  items: { date: Date; value: number }[],
  buckets: Bucket[],
  cumulative = false,
): { label: string; value: number }[] {
  return buckets.map(b => {
    const value = cumulative
      ? items.filter(it => it.date < b.end).reduce((s, it) => s + it.value, 0)
      : items.filter(it => it.date >= b.start && it.date < b.end).reduce((s, it) => s + it.value, 0)
    return { label: b.label, value }
  })
}
