// Renders an <img> if `src` is an http(s) URL, else renders the value as text
// (so emoji placeholders like '♪' / '🍽' / '★' still work as fallbacks).
export function Avatar({
  src,
  className,
  textSize,
  bg = 'bg-teal/10',
}: {
  src: string
  className: string
  textSize: string
  bg?: string
}) {
  const isUrl = src?.startsWith('http://') || src?.startsWith('https://')
  if (isUrl) {
    return <img src={src} alt="" className={`${className} object-cover shrink-0`} />
  }
  return (
    <div className={`${className} ${bg} flex items-center justify-center ${textSize} shrink-0`}>
      {src || '👤'}
    </div>
  )
}
