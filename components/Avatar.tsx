// Renders an <img> if `src` is an http(s) URL, otherwise shows a user silhouette.
export function Avatar({
  src,
  className,
  bg = 'bg-teal/10',
}: {
  src: string
  className: string
  textSize?: string  // kept for call-site compat, no longer used
  bg?: string
}) {
  const isUrl = src?.startsWith('http://') || src?.startsWith('https://')
  if (isUrl) {
    return <img src={src} alt="" className={`${className} object-cover shrink-0`} />
  }
  return (
    <div className={`${className} ${bg} flex items-center justify-center shrink-0`}>
      <svg
        className="w-[45%] h-[45%] text-teal/60"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  )
}
