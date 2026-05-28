'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface OpenSlot {
  id: string
  date: string
  dateLabel: string
  time: string
  pay: number
  genres: string[]
}

interface Props {
  musicianId: string
  musicianName: string
  onClose: () => void
  onSuccess: (bookingId: string) => void
  prefillDate?: string
  prefillStartTime?: string
  prefillEndTime?: string
}

function fmt(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export default function InviteModal({ musicianId, musicianName, onClose, onSuccess, prefillDate, prefillStartTime, prefillEndTime }: Props) {
  const [mode, setMode] = useState<'pick' | 'create'>(prefillDate ? 'create' : 'pick')
  const [slots, setSlots] = useState<OpenSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  // Create-new form
  const [date, setDate] = useState(prefillDate ?? '')
  const [startTime, setStartTime] = useState(prefillStartTime ?? '')
  const [endTime, setEndTime] = useState(prefillEndTime ?? '')
  const [pay, setPay] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSlotsLoading(false); return }

      const today = new Date().toISOString().slice(0, 10)
      const { data } = await supabase
        .from('availability')
        .select('id, date, start_time, end_time, pay, genres')
        .eq('restaurant_id', user.id)
        .eq('status', 'open')
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(20)

      if (data) {
        setSlots(data.map(s => {
          const rawStart = s.start_time?.slice(0, 5) ?? ''
          const rawEnd = s.end_time?.slice(0, 5) ?? ''
          return {
            id: s.id,
            date: s.date,
            dateLabel: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
            }),
            time: rawStart && rawEnd ? `${fmt(rawStart)} – ${fmt(rawEnd)}` : '—',
            pay: Number(s.pay) || 0,
            genres: Array.isArray(s.genres) ? s.genres : [],
          }
        }))
      }
      setSlotsLoading(false)
    }
    void load()
  }, [])

  const handleSubmit = async () => {
    setError('')
    if (mode === 'pick' && !selectedSlotId) {
      setError('Please select a slot.')
      return
    }
    if (mode === 'create') {
      if (!date) { setError('Please enter a date.'); return }
      if (!startTime) { setError('Please enter a start time.'); return }
      if (!endTime) { setError('Please enter an end time.'); return }
      if (!pay || isNaN(Number(pay)) || Number(pay) <= 0) { setError('Please enter a valid pay amount.'); return }
    }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const body = mode === 'pick'
        ? { musician_id: musicianId, availability_id: selectedSlotId, note: note.trim() || undefined }
        : {
            musician_id: musicianId,
            date,
            start_time: startTime,
            end_time: endTime,
            pay: Number(pay),
            note: note.trim() || undefined,
          }

      const res = await fetch('/api/bookings/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json() as { booking_id?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')
      onSuccess(data.booking_id!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-snow w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Private Booking</p>
            <h3 className="text-snow text-xl font-black tracking-tight">
              Invite <span className="text-chestnut italic">{musicianName.split(' ')[0]}.</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 text-snow/60 hover:text-snow transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Mode toggle */}
          <div className="flex bg-white rounded-xl p-1 mb-5 shadow-sm">
            <button
              onClick={() => setMode('pick')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'pick'
                  ? 'bg-chestnut text-snow shadow-sm'
                  : 'text-charcoal hover:text-graphite'
              }`}
            >
              Existing Slot
            </button>
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'create'
                  ? 'bg-chestnut text-snow shadow-sm'
                  : 'text-charcoal hover:text-graphite'
              }`}
            >
              New Slot
            </button>
          </div>

          {/* Pick existing slot */}
          {mode === 'pick' && (
            <div className="mb-4">
              {slotsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-white rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <div className="bg-white rounded-xl p-4 text-center">
                  <p className="text-charcoal/60 text-sm mb-2">No open slots available.</p>
                  <button
                    onClick={() => setMode('create')}
                    className="text-chestnut text-sm font-bold hover:opacity-80 transition-opacity"
                  >
                    Create a new slot instead →
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {slots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                        selectedSlotId === slot.id
                          ? 'border-chestnut bg-chestnut/5'
                          : 'border-transparent bg-white hover:border-charcoal/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-graphite text-sm font-bold">{slot.dateLabel}</p>
                          <p className="text-charcoal text-xs mt-0.5">{slot.time}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-teal font-black text-sm">${slot.pay}</p>
                          {slot.genres.length > 0 && (
                            <p className="text-charcoal/50 text-[10px] truncate max-w-[90px]">{slot.genres.slice(0, 2).join(', ')}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create new slot */}
          {mode === 'create' && (
            <div className="space-y-4 mb-4">
              <div>
                <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Date</label>
                <StyledSelect
                  value={date}
                  onChange={setDate}
                  options={getDateOptions()}
                  placeholder="Pick a date"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Start Time</label>
                  <StyledSelect
                    value={startTime}
                    onChange={setStartTime}
                    options={TIME_OPTIONS}
                    placeholder="Start time"
                  />
                </div>
                <div>
                  <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">End Time</label>
                  <StyledSelect
                    value={endTime}
                    onChange={setEndTime}
                    options={TIME_OPTIONS}
                    placeholder="End time"
                  />
                </div>
              </div>
              <div>
                <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Pay Offered ($)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="e.g. 200"
                  value={pay}
                  onChange={e => setPay(e.target.value)}
                  className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm border border-charcoal/10 focus:outline-none focus:ring-2 focus:ring-chestnut/20"
                />
              </div>
            </div>
          )}

          {/* Note (both modes) */}
          <div className="mb-5">
            <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">
              Note <span className="font-normal normal-case text-charcoal/50">(optional)</span>
            </label>
            <textarea
              placeholder={`Leave a personal note for ${musicianName.split(' ')[0]}…`}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:shadow-md transition-shadow resize-none placeholder:text-charcoal/40"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>
          )}

          <p className="text-charcoal/50 text-xs text-center mb-4">
            This invite is private — only {musicianName.split(' ')[0]} can see it.
          </p>

          <button
            onClick={handleSubmit}
            disabled={submitting || (mode === 'pick' && !selectedSlotId && slots.length > 0)}
            className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-2"
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Sending…
                </span>
              : `Send Invite to ${musicianName.split(' ')[0]}`}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = (i % 2) * 30
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return {
    label: `${hour12}:${m.toString().padStart(2, '0')} ${period}`,
    value: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
  }
})

function getDateOptions() {
  const options: { value: string; label: string }[] = []
  const today = new Date()
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const value = d.toISOString().split('T')[0]
    const prefix = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' })
    options.push({ value, label: `${prefix} · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` })
  }
  return options
}

function StyledSelect({ value, onChange, options, placeholder, className = '' }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full appearance-none bg-white rounded-xl px-4 py-3 pr-10 shadow-sm border border-charcoal/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-chestnut/20 cursor-pointer ${value ? 'text-graphite' : 'text-charcoal/40'}`}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/40">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}
