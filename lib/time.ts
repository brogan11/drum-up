// Shared time-of-day option helpers for every gig/availability/booking time picker.
// Centralized so the cross-midnight rule and the picker UX can't drift between forms.

function timeLabel(idx: number): string {
  const h = Math.floor(idx / 2)
  const m = (idx % 2) * 30
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`
}

function timeValue(idx: number): string {
  const h = Math.floor(idx / 2)
  const m = (idx % 2) * 30
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Every half hour of the day, 12:00 AM .. 11:30 PM, as { value: "HH:MM", label: "h:MM AM/PM" }.
// Used for the start-time picker.
export const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => ({
  label: timeLabel(i),
  value: timeValue(i),
}))

// End-time choices for a gig form: every half hour in the 24 hours AFTER the chosen
// start, so late-night gigs that cross midnight can be posted naturally. Times past
// midnight are tagged "(next day)" and still store the same naive HH:MM the DB expects —
// gigStartEnd (lib/ics) resolves the real end date from end_time < start_time. We stop
// 30 min short of a full wrap so the end can never equal the start (which would read as
// same-day / zero-length under the cross-midnight rule). Returns [] until a start is set.
export function endTimeOptions(startTime: string): { value: string; label: string }[] {
  if (!startTime) return []
  const [sh, sm] = startTime.split(':').map(Number)
  const startIdx = sh * 2 + (sm >= 30 ? 1 : 0)
  return Array.from({ length: 47 }, (_, i) => {
    const step = startIdx + 1 + i
    const idx = step % 48
    const nextDay = step >= 48
    return {
      value: timeValue(idx),
      label: `${timeLabel(idx)}${nextDay ? ' (next day)' : ''}`,
    }
  })
}
