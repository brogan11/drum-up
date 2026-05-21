import { Text, Section } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { brand } from './brand'

interface Props {
  recipientName: string
  senderName: string
  messagePreview: string
  dashboardUrl: string
}

export function NewMessageEmail({
  recipientName,
  senderName,
  messagePreview,
  dashboardUrl,
}: Props) {
  const truncated = messagePreview.length > 100
  const preview = messagePreview.slice(0, 100)

  return (
    <EmailLayout previewText={`${senderName}: ${preview}${truncated ? '...' : ''}`}>
      <Text
        style={{
          color: brand.dark,
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        💬 New Message
      </Text>
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '15px',
          margin: '0 0 24px 0',
        }}
      >
        {senderName} sent you a message on Drum Up
      </Text>

      {/* Message preview */}
      <Section
        style={{
          backgroundColor: '#F9F7F5',
          borderLeft: `4px solid ${brand.primary}`,
          padding: '14px 16px',
          borderRadius: '0 8px 8px 0',
          marginBottom: '24px',
        }}
      >
        <Text
          style={{
            color: brand.charcoal,
            fontSize: '15px',
            fontStyle: 'italic',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          &ldquo;{preview}{truncated ? '...' : ''}&rdquo;
        </Text>
      </Section>

      <EmailButton href={dashboardUrl}>Reply to {senderName} →</EmailButton>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '13px',
          marginTop: '16px',
        }}
      >
        You can manage message notifications in your account settings.
      </Text>
    </EmailLayout>
  )
}
