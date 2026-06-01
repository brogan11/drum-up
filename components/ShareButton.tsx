'use client'

import { useToast } from '@/components/Toast'

/**
 * Share / copy-link control for public profile pages. Uses the native share sheet
 * on supporting devices (mobile), otherwise copies the canonical URL to the
 * clipboard. `className` lets each profile layout style it to match (dark vs light).
 */
export function ShareButton({
  url,
  title,
  text,
  label = 'Share',
  className = '',
}: {
  url: string
  title: string
  text?: string
  label?: string
  className?: string
}) {
  const { toast } = useToast()

  const handleShare = async () => {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    // Native share sheet (mobile) — best for dropping into Instagram/Messages.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
        return
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-1.5 font-bold transition-opacity hover:opacity-90 ${className}`}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      {label}
    </button>
  )
}
