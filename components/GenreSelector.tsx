'use client'

import { useState } from 'react'
import { GENRE_GROUPS } from '@/lib/genres'

export function GenreSelector({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (genre: string) => void
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  function clearAll() {
    selected.forEach(g => onToggle(g))
  }

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3 items-center">
          {selected.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => onToggle(g)}
              className="flex items-center gap-1 bg-chestnut text-snow text-[11px] font-bold px-2.5 py-1 rounded-full hover:opacity-80 transition-opacity"
            >
              {g}
              <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-charcoal/50 text-[11px] font-medium hover:text-charcoal transition-colors ml-1"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        {GENRE_GROUPS.map(group => {
          const isOpen = openGroup === group.label
          const countInGroup = group.genres.filter(g => selected.includes(g)).length

          return (
            <div key={group.label} className="rounded-xl overflow-hidden border border-charcoal/10">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? null : group.label)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-snow transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-graphite text-sm font-bold">{group.label}</span>
                  {countInGroup > 0 && (
                    <span className="bg-chestnut text-snow text-[10px] font-black px-2 py-0.5 rounded-full leading-none">
                      {countInGroup}
                    </span>
                  )}
                </div>
                <svg
                  className={`w-4 h-4 text-charcoal/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-4 py-3 flex flex-wrap gap-2 bg-[#F5F2EF] border-t border-charcoal/10">
                  {group.genres.map(genre => {
                    const active = selected.includes(genre)
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => onToggle(genre)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          active
                            ? 'bg-chestnut text-snow shadow-sm'
                            : 'bg-white text-charcoal border border-charcoal/15 hover:border-chestnut/50 hover:shadow-sm'
                        }`}
                      >
                        {genre}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
