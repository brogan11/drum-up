import { Text, Section } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  restaurantName: string
  musicianName: string
  performerType: 'solo' | 'band'
  applicationNote: string
  gigDate: string
  gigTime: string
  payAmount: number
  dashboardUrl: string
}

export function NewApplicationEmail({
  restaurantName,
  musicianName,
  performerType,
  applicationNote,
  gigDate,
  gigTime,
  payAmount,
  dashboardUrl,
}: Props) {
  return (
    <EmailLayout previewText={`${musicianName} wants to play at your venue on ${gigDate}`}>
      <Text
        style={{
          color: brand.dark,
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        🎵 New Application Received
      </Text>
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '16px',
          margin: '0 0 24px 0',
        }}
      >
        {musicianName} wants to play at {restaurantName}
      </Text>

      {/* Performer type badge */}
      <Section style={{ marginBottom: '16px' }}>
        <span
          style={{
            backgroundColor: performerType === 'solo' ? 'rgba(108,154,139,0.12)' : 'rgba(220,127,65,0.12)',
            color: performerType === 'solo' ? brand.teal : brand.primary,
            fontSize: '12px',
            fontWeight: 'bold',
            padding: '4px 12px',
            borderRadius: '100px',
          }}
        >
          {performerType === 'solo' ? '🎤 Solo Artist' : '🎸 Band'}
        </span>
      </Section>

      <InfoCard label="Musician" value={musicianName} />
      <InfoCard label="Gig Date" value={`📅 ${gigDate}`} />
      <InfoCard label="Time" value={`🕐 ${gigTime}`} />
      <InfoCard label="Pay Offered" value={`💰 $${payAmount}`} />

      {applicationNote && (
        <Section style={{ marginTop: '20px', marginBottom: '24px' }}>
          <Text
            style={{
              color: brand.charcoal,
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: '0 0 8px 0',
            }}
          >
            Their note:
          </Text>
          <Section
            style={{
              backgroundColor: '#F9F7F5',
              borderLeft: `4px solid ${brand.primary}`,
              padding: '14px 16px',
              borderRadius: '0 8px 8px 0',
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
              &ldquo;{applicationNote}&rdquo;
            </Text>
          </Section>
        </Section>
      )}

      <EmailButton href={dashboardUrl}>Review Application →</EmailButton>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '13px',
          marginTop: '16px',
        }}
      >
        Log in to accept or decline this application.
      </Text>
    </EmailLayout>
  )
}
