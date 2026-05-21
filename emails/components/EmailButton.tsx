import { Button } from 'react-email'
import { brand } from '../brand'
import type { ReactNode } from 'react'

export function EmailButton({
  href,
  children,
  secondary = false,
}: {
  href: string
  children: ReactNode
  secondary?: boolean
}) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: secondary ? brand.teal : brand.primary,
        color: brand.white,
        padding: '14px 28px',
        borderRadius: '12px',
        fontWeight: 'bold',
        fontSize: '15px',
        textDecoration: 'none',
        display: 'inline-block',
        marginTop: '8px',
      }}
    >
      {children}
    </Button>
  )
}
