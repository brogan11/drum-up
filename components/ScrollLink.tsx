'use client'

import { useCallback } from 'react'

interface ScrollLinkProps {
  href: `#${string}`
  className?: string
  children: React.ReactNode
}

/**
 * In-page anchor link that always scrolls to its target on click — even when
 * the URL hash already points there. A plain <a href="#id"> (or next/link) is a
 * no-op when you click it a second time, because the hash doesn't change. Here
 * we scroll manually and keep the hash in sync via history.replaceState so we
 * don't push duplicate entries onto the back stack. Smooth-scroll + nav offset
 * still come from the `html { scroll-behavior; scroll-padding-top }` CSS, which
 * scrollIntoView respects.
 */
export function ScrollLink({ href, className, children }: ScrollLinkProps) {
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const id = href.slice(1)
      const target = document.getElementById(id)
      if (!target) return // let the browser handle it if the section isn't found
      e.preventDefault()
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      history.replaceState(null, '', href)
    },
    [href],
  )

  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  )
}
