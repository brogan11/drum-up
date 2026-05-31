'use client'

// Dependency-free SVG/HTML chart primitives, styled to the Drum Up brand.
// SVG charts use a fixed viewBox + width:100% so they scale uniformly (viewBox coords
// map linearly to rendered pixels). That lets us position HTML hover tooltips with simple
// percentages: left% = x/W*100, top% = y/H*100. Every data chart is interactive — hovering
// reveals the exact value at that point/bar/slice/axis.

import { useId, useState } from 'react'

export const CHART = {
  chestnut: '#DC7F41',
  teal: '#6C9A8B',
  graphite: '#333333',
  charcoal: '#5E5E5E',
  snow: '#FCFAF9',
}

export interface Point {
  label: string
  value: number
}

const fmtCompact = (n: number) =>
  Math.abs(n) >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : String(Math.round(n))

const fmtFull = (n: number) => (n % 1 === 0 ? Math.round(n).toLocaleString('en-US') : n.toFixed(1))

// Shared floating tooltip. leftPct/topPct are % of the wrapper (which matches the SVG box).
function Tooltip({ leftPct, topPct, title, value }: { leftPct: number; topPct: number; title: string; value: string }) {
  const clamped = Math.min(92, Math.max(8, leftPct))
  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col items-center"
      style={{ left: `${clamped}%`, top: `${topPct}%`, transform: 'translate(-50%, calc(-100% - 8px))' }}
    >
      <div className="rounded-lg bg-graphite px-2.5 py-1.5 shadow-lg whitespace-nowrap">
        <div className="text-[10px] font-semibold text-snow/55 leading-tight">{title}</div>
        <div className="text-xs font-extrabold text-snow leading-tight">{value}</div>
      </div>
      <div className="w-2 h-2 bg-graphite rotate-45 -mt-1" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Area / line chart for time series (views, earnings, follower growth)
// ─────────────────────────────────────────────────────────────────────────────
export function AreaChart({
  data,
  color = CHART.chestnut,
  height = 200,
  format = fmtCompact,
  valueFormat = fmtFull,
  showDots = true,
}: {
  data: Point[]
  color?: string
  height?: number
  format?: (n: number) => string
  valueFormat?: (n: number) => string
  showDots?: boolean
}) {
  const gid = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = height
  const padL = 40, padR = 14, padT = 14, padB = 26

  if (data.length === 0) return <EmptyChart height={height} label="No data yet" />

  const max = Math.max(...data.map(d => d.value), 1)
  const min = Math.min(...data.map(d => d.value), 0)
  const span = max - min || 1
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const x = (i: number) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const y = (v: number) => padT + innerH - ((v - min) / span) * innerH

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${x(data.length - 1).toFixed(1)} ${padT + innerH} L ${x(0).toFixed(1)} ${padT + innerH} Z`
  const ticks = [0, 0.5, 1].map(t => min + t * span)
  const step = Math.ceil(data.length / 6)
  const bandStart = (i: number) => (i === 0 ? padL : (x(i - 1) + x(i)) / 2)
  const bandEnd = (i: number) => (i === data.length - 1 ? padL + innerW : (x(i) + x(i + 1)) / 2)

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block overflow-visible">
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tv, i) => {
          const yy = y(tv)
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={CHART.charcoal} strokeOpacity="0.12" strokeWidth="1" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="11" fill={CHART.charcoal} fillOpacity="0.55" fontWeight="600">{format(tv)}</text>
            </g>
          )
        })}
        <path d={areaPath} fill={`url(#area-${gid})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {hover != null && (
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + innerH} stroke={color} strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        {showDots && data.length <= 24 && data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 3.5 : 0} fill={color} />
        ))}
        {hover != null && <circle cx={x(hover)} cy={y(data[hover].value)} r="4.5" fill={color} stroke={CHART.snow} strokeWidth="2" />}
        {data.map((d, i) =>
          i % step === 0 || i === data.length - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={CHART.charcoal} fillOpacity="0.55" fontWeight="600">{d.label}</text>
          ) : null,
        )}
        {/* hover hit areas */}
        {data.map((d, i) => (
          <rect key={`h${i}`} x={bandStart(i)} y={padT} width={Math.max(bandEnd(i) - bandStart(i), 1)} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} />
        ))}
      </svg>
      {hover != null && (
        <Tooltip leftPct={(x(hover) / W) * 100} topPct={(y(data[hover].value) / H) * 100} title={data[hover].label} value={valueFormat(data[hover].value)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertical bar chart (e.g. earnings by month)
// ─────────────────────────────────────────────────────────────────────────────
export function BarChart({
  data,
  color = CHART.teal,
  height = 200,
  format = fmtCompact,
  valueFormat = fmtFull,
}: {
  data: Point[]
  color?: string
  height?: number
  format?: (n: number) => string
  valueFormat?: (n: number) => string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = height
  const padL = 40, padR = 14, padT = 14, padB = 26

  if (data.length === 0) return <EmptyChart height={height} label="No data yet" />

  const max = Math.max(...data.map(d => d.value), 1)
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const slot = innerW / data.length
  const bw = Math.min(slot * 0.6, 48)
  const y = (v: number) => padT + innerH - (v / max) * innerH
  const ticks = [0, 0.5, 1].map(t => t * max)
  const step = Math.ceil(data.length / 8)
  const cx = (i: number) => padL + slot * i + slot / 2

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="block overflow-visible">
        {ticks.map((tv, i) => {
          const yy = y(tv)
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={CHART.charcoal} strokeOpacity="0.12" strokeWidth="1" />
              <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize="11" fill={CHART.charcoal} fillOpacity="0.55" fontWeight="600">{format(tv)}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const yy = y(d.value)
          const h = padT + innerH - yy
          const active = hover === i
          return (
            <g key={i}>
              {active && <rect x={padL + slot * i} y={padT} width={slot} height={innerH} fill={CHART.charcoal} fillOpacity="0.05" />}
              <rect x={cx(i) - bw / 2} y={yy} width={bw} height={Math.max(h, 0)} rx="4" fill={color} fillOpacity={hover == null || active ? 1 : 0.55} />
              {(i % step === 0 || i === data.length - 1) && (
                <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={CHART.charcoal} fillOpacity="0.55" fontWeight="600">{d.label}</text>
              )}
            </g>
          )
        })}
        {data.map((d, i) => (
          <rect key={`h${i}`} x={padL + slot * i} y={padT} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} onMouseMove={() => setHover(i)} />
        ))}
      </svg>
      {hover != null && (
        <Tooltip leftPct={(cx(hover) / W) * 100} topPct={(y(data[hover].value) / H) * 100} title={data[hover].label} value={valueFormat(data[hover].value)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Donut chart with center label + hover (e.g. booking status breakdown)
// ─────────────────────────────────────────────────────────────────────────────
export interface Slice { label: string; value: number; color: string }

export function Donut({ slices, centerTop, centerBottom }: { slices: Slice[]; centerTop?: string; centerBottom?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((s, x) => s + x.value, 0)
  const R = 54
  const C = 2 * Math.PI * R
  let offset = 0

  const h = hover != null ? slices[hover] : null
  const hPct = h && total > 0 ? Math.round((h.value / total) * 100) : 0

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg viewBox="0 0 140 140" width="120" className="block -rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke={CHART.charcoal} strokeOpacity="0.1" strokeWidth="16" />
          {total > 0 &&
            slices.map((s, i) => {
              const frac = s.value / total
              const dash = frac * C
              const active = hover == null || hover === i
              const el = (
                <circle
                  key={i}
                  cx="70" cy="70" r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hover === i ? 19 : 16}
                  strokeOpacity={active ? 1 : 0.4}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: 'pointer', transition: 'stroke-width 0.12s' }}
                />
              )
              offset += dash
              return el
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {h ? (
            <>
              <p className="text-graphite text-lg font-black leading-none">{hPct}%</p>
              <p className="text-charcoal/50 text-[10px] font-semibold mt-0.5 max-w-[80px] truncate">{h.label}</p>
            </>
          ) : (
            <>
              {centerTop && <p className="text-graphite text-lg font-black leading-none">{centerTop}</p>}
              {centerBottom && <p className="text-charcoal/50 text-[10px] font-semibold mt-0.5">{centerBottom}</p>}
            </>
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm rounded-lg px-1.5 py-0.5 -mx-1.5 transition-colors cursor-default"
            style={{ background: hover === i ? CHART.charcoal + '12' : 'transparent' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-charcoal/70 font-medium flex-1 truncate">{s.label}</span>
            <span className="text-graphite font-bold tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Horizontal bars (rating distribution, aspect averages, top venues/talent)
// ─────────────────────────────────────────────────────────────────────────────
export interface HBarRow { label: string; value: number; display?: string; max?: number }

export function HBars({ rows, color = CHART.chestnut, suffix = '' }: { rows: HBarRow[]; color?: string; suffix?: string }) {
  const groupMax = Math.max(...rows.map(r => r.max ?? r.value), 1)
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => {
        const pct = Math.max(2, (r.value / (r.max ?? groupMax)) * 100)
        return (
          <div key={i} className="flex items-center gap-3 group">
            <span className="text-charcoal/70 text-xs font-semibold w-28 shrink-0 truncate text-right">{r.label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-charcoal/10 overflow-hidden">
              <div className="h-full rounded-full transition-all group-hover:brightness-110" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-graphite text-xs font-bold tabular-nums w-12 shrink-0">
              {r.display ?? (r.value % 1 === 0 ? r.value : r.value.toFixed(1))}{suffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Radar chart for per-aspect performance (1–5 scale) with hover
// ─────────────────────────────────────────────────────────────────────────────
export function Radar({ axes, color = CHART.chestnut, scaleMax = 5 }: { axes: { label: string; value: number }[]; color?: string; scaleMax?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 260, Hh = 230
  const cx = 130, cy = 120, R = 78
  const n = axes.length
  if (n < 3) return <EmptyChart height={200} label="Need 3+ rated aspects" />

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2
  const pt = (i: number, rad: number) => [cx + Math.cos(angle(i)) * rad, cy + Math.sin(angle(i)) * rad]
  const dataPoints = axes.map((a, i) => pt(i, (Math.min(a.value, scaleMax) / scaleMax) * R))
  const rings = [0.33, 0.66, 1]

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${Hh}`} width="100%" className="block overflow-visible">
        {rings.map((rr, i) => (
          <polygon key={i} points={axes.map((_, j) => pt(j, rr * R).join(',')).join(' ')} fill="none" stroke={CHART.charcoal} strokeOpacity={0.12} strokeWidth="1" />
        ))}
        {axes.map((_, i) => {
          const [ex, ey] = pt(i, R)
          return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke={CHART.charcoal} strokeOpacity={0.12} strokeWidth="1" />
        })}
        <polygon points={dataPoints.map(p => p.join(',')).join(' ')} fill={color} fillOpacity={0.18} stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 3} fill={color} stroke={CHART.snow} strokeWidth={hover === i ? 2 : 0} />
        ))}
        {axes.map((a, i) => {
          const [lx, ly] = pt(i, R + 16)
          const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end'
          return (
            <text key={i} x={lx} y={ly + 3} textAnchor={anchor} fontSize="10.5" fill={CHART.charcoal} fillOpacity={0.75} fontWeight="700">{a.label}</text>
          )
        })}
        {/* hover hit areas at each vertex */}
        {dataPoints.map((p, i) => (
          <circle key={`h${i}`} cx={p[0]} cy={p[1]} r="14" fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
      {hover != null && (
        <Tooltip leftPct={(dataPoints[hover][0] / W) * 100} topPct={(dataPoints[hover][1] / Hh) * 100} title={axes[hover].label} value={`${axes[hover].value.toFixed(1)} / ${scaleMax}`} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny sparkline for KPI cards (decorative)
// ─────────────────────────────────────────────────────────────────────────────
export function Sparkline({ data, color = CHART.chestnut, height = 36 }: { data: number[]; color?: string; height?: number }) {
  const gid = useId()
  const W = 120
  const H = height
  if (data.length < 2) return <div style={{ height }} />
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => H - 3 - ((v - min) / span) * (H - 6)
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L ${W} ${H} L 0 ${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="none" className="block">
      <defs>
        <linearGradient id={`sp-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sp-${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function EmptyChart({ height, label }: { height: number; label: string }) {
  return <div className="flex items-center justify-center text-charcoal/40 text-sm font-medium" style={{ height }}>{label}</div>
}
