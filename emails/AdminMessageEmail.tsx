import { Text } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { brand } from './brand'

interface Props {
  recipientName: string
  heading: string
  // Plain-text body; newlines are rendered as paragraph breaks.
  body: string
  ctaUrl?: string
  ctaLabel?: string
}

export function AdminMessageEmail({
  recipientName,
  heading,
  body,
  ctaUrl,
  ctaLabel,
}: Props) {
  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)

  return (
    <EmailLayout previewText={heading}>
      <Text style={{ color: brand.dark, fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
        {heading}
      </Text>
      <Text style={{ color: brand.charcoal, fontSize: '15px', margin: '0 0 20px 0' }}>
        Hi {recipientName},
      </Text>

      {paragraphs.map((p, i) => (
        <Text key={i} style={{ color: brand.charcoal, fontSize: '15px', lineHeight: '1.6', margin: '0 0 16px 0', whiteSpace: 'pre-line' }}>
          {p}
        </Text>
      ))}

      {ctaUrl && (
        <EmailButton href={ctaUrl}>{ctaLabel || 'Open Drum Up →'}</EmailButton>
      )}

      <Text style={{ color: brand.charcoal, fontSize: '13px', marginTop: '24px' }}>
        — The Drum Up team
      </Text>
    </EmailLayout>
  )
}
