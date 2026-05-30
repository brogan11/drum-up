import type { RepSummary } from '@/lib/reviews'

// Compact reputation badge for browse/discovery cards: a chestnut star + average, the
// review count, and (optionally) the single most-mentioned highlight tag. Renders nothing
// when there are no reviews yet, so cards for new users stay clean. `dark` adapts colors
// for dark surfaces (musician profile / dark cards).
export function RatingBadge({ rep, showTag = true, dark = false, className = '' }: {
  rep: RepSummary | undefined
  showTag?: boolean
  dark?: boolean
  className?: string
}) {
  if (!rep || rep.count === 0) return null
  const tagCls = dark
    ? 'bg-teal/20 text-teal'
    : 'bg-teal/10 text-teal'
  const countCls = dark ? 'text-snow/40' : 'text-charcoal/45'
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="inline-flex items-center gap-0.5">
        <svg className="w-3.5 h-3.5 text-chestnut" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        <span className="text-chestnut text-xs font-black">{rep.avg.toFixed(1)}</span>
      </span>
      <span className={`text-[11px] font-medium ${countCls}`}>({rep.count})</span>
      {showTag && rep.topTag && (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${tagCls}`}>{rep.topTag}</span>
      )}
    </span>
  )
}
