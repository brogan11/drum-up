import { Button } from '@react-email/components'
import { brand } from '../brand'

export function EmailButton({
  href,
  children,
  secondary = false,
}: {
  href: string
  children: string
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
