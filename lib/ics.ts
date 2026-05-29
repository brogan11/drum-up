export interface GigEvent {
  uid: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  url?: string
}

// Format a Date as UTC ICS timestamp: 20260530T193000Z
function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

// Escape per RFC 5545 (commas, semicolons, backslashes, newlines).
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildGigICS(ev: GigEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Drum Up//Gig//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.uid}@drum-up.app`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(ev.start)}`,
    `DTEND:${toICSDate(ev.end)}`,
    `SUMMARY:${esc(ev.title)}`,
  ]
  if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`)
  if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`)
  if (ev.url) lines.push(`URL:${esc(ev.url)}`)
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadICS(filename: string, ev: GigEvent): void {
  const blob = new Blob([buildGigICS(ev)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Google Calendar timestamps use the same compact UTC format.
export function googleCalendarUrl(ev: GigEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toICSDate(ev.start)}/${toICSDate(ev.end)}`,
  })
  const details = [ev.description, ev.url].filter(Boolean).join('\n\n')
  if (details) params.set('details', details)
  if (ev.location) params.set('location', ev.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// Build a Date from a `YYYY-MM-DD` date string + `HH:MM[:SS]` time string (local time).
export function gigDateTime(date: string, time: string | null | undefined): Date {
  const t = (time ?? '00:00').slice(0, 5)
  return new Date(`${date}T${t}:00`)
}
