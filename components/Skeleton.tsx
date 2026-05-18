'use client'

// ---- Base Skeleton ----

interface SkeletonProps {
  className?: string
  dark?: boolean
}

export function Skeleton({ className = '', dark = false }: SkeletonProps) {
  const base = dark
    ? 'bg-[length:200%_100%] rounded-lg animate-shimmer'
    : 'bg-[length:200%_100%] rounded-lg animate-shimmer'

  const gradient = dark
    ? 'bg-gradient-to-r from-[#3D3D3D] via-[#4A4A4A] to-[#3D3D3D]'
    : 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200'

  return <div className={`${base} ${gradient} ${className}`} />
}

// ---- Stat Card Skeleton ----

export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm overflow-hidden">
      <Skeleton className="h-7 w-12 mb-2" />
      <Skeleton className="h-2.5 w-16" />
    </div>
  )
}

// ---- Booking Card Skeleton ----

export function SkeletonBookingCard() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="text-right space-y-2 shrink-0">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-8 w-24 rounded-xl" />
        <Skeleton className="h-8 flex-1 rounded-xl" />
      </div>
    </div>
  )
}

// ---- Availability Card Skeleton ----

export function SkeletonAvailabilityCard() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-12 rounded-xl" />
      </div>
      <div className="flex gap-1 flex-wrap">
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ---- Musician Card Skeleton (for browse tab) ----

export function SkeletonMusicianCard() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-l-gray-200">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="w-11 h-11 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-6 w-14 rounded-xl" />
      </div>
      <div className="flex gap-1 flex-wrap mb-3">
        <Skeleton className="h-5 w-10 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-10 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
        <Skeleton className="h-9 flex-1 rounded-xl" />
      </div>
    </div>
  )
}

// ---- Message Row Skeleton (conversation list) ----

export function SkeletonMessageRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  )
}

// ---- Message Bubble Skeletons ----

export function SkeletonMessageBubble() {
  return (
    <div className="space-y-4 px-4 py-3">
      {/* Received */}
      <div className="flex items-end gap-2">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-10 w-48 rounded-2xl rounded-bl-sm" />
      </div>
      {/* Sent */}
      <div className="flex items-end gap-2 justify-end">
        <Skeleton className="h-10 w-40 rounded-2xl rounded-br-sm" />
      </div>
      {/* Received */}
      <div className="flex items-end gap-2">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-14 w-56 rounded-2xl rounded-bl-sm" />
      </div>
      {/* Sent */}
      <div className="flex items-end gap-2 justify-end">
        <Skeleton className="h-10 w-32 rounded-2xl rounded-br-sm" />
      </div>
    </div>
  )
}

// ---- Review Card Skeleton ----

export function SkeletonReviewCard() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-3.5 h-3.5 rounded-sm" />
            ))}
          </div>
        </div>
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  )
}

// ---- Profile Header Skeleton (light background — restaurant/fan) ----

export function SkeletonProfileHeaderLight() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton className="w-20 h-20 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-1 flex-wrap">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    </div>
  )
}

// ---- Profile Header Skeleton (dark background — musician) ----

export function SkeletonProfileHeaderDark() {
  return (
    <div className="bg-graphite rounded-3xl p-8 mb-6 shadow-xl">
      <div className="flex flex-col items-center text-center space-y-3">
        <Skeleton dark className="w-24 h-24 rounded-2xl" />
        <Skeleton dark className="h-7 w-40 rounded-lg" />
        <Skeleton dark className="h-4 w-28 rounded-lg" />
        <div className="flex gap-2">
          <Skeleton dark className="h-6 w-16 rounded-full" />
          <Skeleton dark className="h-6 w-20 rounded-full" />
          <Skeleton dark className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ---- Full Profile Page Skeleton (musician — dark theme) ----

export function SkeletonProfilePageMusician() {
  return (
    <div className="min-h-screen pb-12" style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(108,154,139,0.12), transparent 60%), #1C1C1E' }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Hero */}
        <div className="relative bg-[#2A2A2C] rounded-3xl overflow-hidden mb-6 shadow-xl p-8">
          <div className="flex flex-col items-center text-center space-y-3">
            <Skeleton dark className="w-24 h-24 rounded-2xl" />
            <Skeleton dark className="h-7 w-44 rounded-lg" />
            <Skeleton dark className="h-4 w-32 rounded-lg" />
            <div className="flex gap-2">
              <Skeleton dark className="h-6 w-16 rounded-full" />
              <Skeleton dark className="h-6 w-20 rounded-full" />
            </div>
          </div>
        </div>
        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#2A2A2C] rounded-2xl p-3 text-center">
              <Skeleton dark className="h-6 w-10 mx-auto mb-1.5" />
              <Skeleton dark className="h-2.5 w-14 mx-auto" />
            </div>
          ))}
        </div>
        {/* Sections */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-[#2A2A2C] rounded-2xl p-5 mb-4">
            <Skeleton dark className="h-5 w-24 mb-4" />
            <div className="space-y-2">
              <Skeleton dark className="h-3 w-full" />
              <Skeleton dark className="h-3 w-5/6" />
              <Skeleton dark className="h-3 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Full Profile Page Skeleton (restaurant/fan — light theme) ----

export function SkeletonProfilePageLight() {
  return (
    <div className="min-h-screen bg-snow pb-12">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <SkeletonProfileHeaderLight />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
