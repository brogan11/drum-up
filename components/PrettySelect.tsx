'use client'

import { useEffect, useRef, useState } from 'react'

export interface PrettyOption {
  value: string
  label: string
}

/**
 * Brand-styled dropdown that replaces the native <select>, whose OS-rendered
 * option list ignores our design system (harsh borders, system blue highlight).
 * Renders a shadow-on-white trigger and a rounded popover menu with chestnut
 * active state. Closes on outside-click or Escape.
 */
export function PrettySelect({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
  align = 'left',
}: {
  value: string
  onChange: (value: string) => void
  options: PrettyOption[]
  ariaLabel?: string
  className?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 text-graphite text-sm font-bold focus:outline-none cursor-pointer w-full"
      >
        <span className="truncate flex-1 text-left">{current?.label ?? ''}</span>
        <svg className={`w-3.5 h-3.5 text-charcoal/50 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-30 mt-2 min-w-[8rem] bg-white rounded-xl shadow-lg ring-1 ring-charcoal/[0.06] overflow-hidden p-1 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map(o => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-chestnut text-snow' : 'text-charcoal hover:bg-[#E8E4E0]'}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
