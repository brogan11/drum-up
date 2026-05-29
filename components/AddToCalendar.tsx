'use client'

import { useEffect, useRef, useState } from 'react'
import { downloadICS, googleCalendarUrl, type GigEvent } from '@/lib/ics'

export default function AddToCalendar({
  event,
  filename = 'gig',
  label = 'Add to Calendar',
  className = '',
}: {
  event: GigEvent
  filename?: string
  label?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:opacity-80 transition-opacity ${className}`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
        {label}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-44 bg-white rounded-xl shadow-xl z-50 overflow-hidden border border-charcoal/10">
          <a
            href={googleCalendarUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); setOpen(false) }}
            className="block px-4 py-2.5 text-sm text-graphite hover:bg-snow transition-colors font-medium"
          >
            Google Calendar
          </a>
          <button
            onClick={(e) => { e.stopPropagation(); downloadICS(filename, event); setOpen(false) }}
            className="block w-full text-left px-4 py-2.5 text-sm text-graphite hover:bg-snow transition-colors font-medium border-t border-charcoal/5"
          >
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  )
}
