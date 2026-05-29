'use client'

import { useState } from 'react'
import { toggleSaved, type SavedItemType } from '@/lib/saved'

export default function SaveButton({
  userId,
  type,
  id,
  saved,
  onChange,
  size = 'md',
  className = '',
}: {
  userId: string
  type: SavedItemType
  id: string
  saved: boolean
  onChange: (next: boolean) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (busy || !userId) return
    setBusy(true)
    const next = !saved
    onChange(next) // optimistic
    try {
      await toggleSaved(userId, type, id, saved)
    } catch {
      onChange(saved) // revert
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      aria-label={saved ? 'Remove from saved' : 'Save'}
      aria-pressed={saved}
      className={`shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        saved ? 'text-chestnut' : 'text-charcoal/40 hover:text-chestnut'
      } ${className}`}
    >
      <svg
        className={dim}
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
