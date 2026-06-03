'use client'
import { useEffect, useRef } from 'react'

export default function Modal({
  onClose, children, size = 'md', sheetOnMobile = true, closeOnBackdrop = true, labelledBy,
}: {
  onClose: () => void
  children: React.ReactNode
  size?: 'sm' | 'md'
  sheetOnMobile?: boolean
  closeOnBackdrop?: boolean
  labelledBy?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])')
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('button,a[href],textarea,input,select')?.focus())
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; prevFocus?.focus() }
  }, [onClose])
  return (
    <div
      className={`fixed inset-0 bg-graphite/60 backdrop-blur-sm z-50 flex justify-center p-4 ${sheetOnMobile ? 'items-end sm:items-center' : 'items-center'}`}
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
        className={`bg-snow w-full ${size === 'sm' ? 'max-w-sm' : 'max-w-md'} rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  )
}
