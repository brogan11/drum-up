export const GENRE_GROUPS: { label: string; genres: string[] }[] = [
  {
    label: 'Popular',
    genres: ['Rock', 'Pop', 'Top 40', 'Cover Band', 'Hip Hop', 'R&B', 'Indie', 'Alternative'],
  },
  {
    label: 'Jazz & Soul',
    genres: ['Jazz', 'Blues', 'Soul', 'Funk', 'Motown', 'Swing', 'Big Band', 'Gospel', 'Neo-Soul'],
  },
  {
    label: 'Country & Folk',
    genres: ['Country', 'Folk', 'Acoustic', 'Americana', 'Bluegrass', 'Singer-Songwriter', 'Celtic', 'Appalachian'],
  },
  {
    label: 'Classic & Nostalgic',
    genres: ['Classic Rock', 'Oldies', 'Disco', 'Punk', 'Ska', 'Yacht Rock', 'Surf Rock', 'Rockabilly'],
  },
  {
    label: 'World & Latin',
    genres: ['Latin', 'Reggae', 'Bossa Nova', 'Flamenco', 'Afrobeat', 'Caribbean', 'Cumbia', 'Salsa'],
  },
  {
    label: 'Electronic & Modern',
    genres: ['Electronic', 'EDM', 'Lo-Fi', 'Ambient', 'Experimental'],
  },
  {
    label: 'Other',
    genres: ['Classical', 'Musical Theatre', 'Holiday', 'Worship', 'Metal', 'Hardcore'],
  },
]

// Flat deduplicated list for filter bars and search
export const ALL_GENRES = Array.from(new Set(GENRE_GROUPS.flatMap(g => g.genres)))
