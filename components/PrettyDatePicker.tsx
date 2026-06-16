'use client'

import { useEffect, useRef, useState } from 'react'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Local-time helpers — avoid `new Date('YYYY-MM-DD')` which parses as UTC and can
// shift the day across timezones.
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromKey = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Brand-styled date picker that replaces the native <input type="date"> calendar
 * (which is OS-rendered and can't match our design system). Value/onChange use a
 * `YYYY-MM-DD` string. `min` (inclusive) disables earlier days.
 */
export function PrettyDatePicker({
  value,
  onChange,
  min,
  placeholder = 'Any date',
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  min?: string
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  // When there isn't room below the trigger, open the calendar upward instead.
  const [dropUp, setDropUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const today = new Date()
  const [view, setView] = useState(() => (value ? fromKey(value) : today))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Opening the picker re-syncs the visible month to the selected date and decides
  // whether to flip upward (done in the click handler rather than an effect to avoid
  // a cascading-render lint error). ~372px is the calendar's approximate height.
  const toggle = () => {
    if (!open) {
      setView(value ? fromKey(value) : new Date())
      const rect = ref.current?.getBoundingClientRect()
      if (rect) {
        const POPOVER_H = 372
        const spaceBelow = window.innerHeight - rect.bottom
        setDropUp(spaceBelow < POPOVER_H && rect.top > spaceBelow)
      }
    }
    setOpen(o => !o)
  }

  const minDate = min ? fromKey(min) : null
  const selectedKey = value || null
  const todayKey = toKey(today)

  const year = view.getFullYear()
  const month = view.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  const displayLabel = value
    ? fromKey(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder

  const isDisabled = (d: Date) => minDate != null && toKey(d) < toKey(minDate)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1.5 w-full text-sm font-bold focus:outline-none cursor-pointer"
      >
        <span className={`truncate flex-1 text-left ${value ? 'text-graphite' : 'text-charcoal/40'}`}>{displayLabel}</span>
        <svg className="w-4 h-4 text-charcoal/50 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 z-30 w-72 bg-white rounded-2xl shadow-xl ring-1 ring-charcoal/[0.06] p-3 ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          {/* Month header */}
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-graphite font-black text-sm">{MONTHS[month]} {year}</p>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Previous month" onClick={() => setView(new Date(year, month - 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-charcoal hover:bg-[#E8E4E0] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button type="button" aria-label="Next month" onClick={() => setView(new Date(year, month + 1, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg text-charcoal hover:bg-[#E8E4E0] transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </div>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[10px] font-bold uppercase tracking-wide text-charcoal/40 py-1">{w}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              const key = toKey(d)
              const selected = selectedKey === key
              const isToday = todayKey === key
              const disabled = isDisabled(d)
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(key); setOpen(false) }}
                  className={`h-9 rounded-lg text-sm font-semibold transition-colors ${
                    selected
                      ? 'bg-chestnut text-snow shadow-sm'
                      : disabled
                      ? 'text-charcoal/25 cursor-not-allowed'
                      : isToday
                      ? 'text-chestnut ring-1 ring-chestnut/40 hover:bg-chestnut/10'
                      : 'text-graphite hover:bg-[#E8E4E0]'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-charcoal/[0.07] px-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-charcoal/50 text-xs font-bold hover:text-graphite transition-colors">Clear</button>
            <button
              type="button"
              onClick={() => { const k = toKey(today); if (!(minDate && k < toKey(minDate))) { onChange(k); setOpen(false) } }}
              className="text-chestnut text-xs font-bold hover:underline"
            >Today</button>
          </div>
        </div>
      )}
    </div>
  )
}
