'use client'

import { GENRE_GROUPS } from '@/lib/genres'

export function GenreSelector({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (genre: string) => void
}) {
  return (
    <div className="space-y-4">
      {GENRE_GROUPS.map(group => (
        <div key={group.label}>
          <p className="text-graphite text-[10px] font-bold uppercase tracking-[0.18em] mb-2">
            {group.label}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.genres.map(genre => {
              const active = selected.includes(genre)
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onToggle(genre)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                    active
                      ? 'bg-chestnut text-white shadow-sm'
                      : 'bg-white text-charcoal border border-charcoal/20 hover:border-chestnut/40 hover:shadow-sm'
                  }`}
                >
                  {genre}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
