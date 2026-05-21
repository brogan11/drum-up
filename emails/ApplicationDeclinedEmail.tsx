import { Text, Section } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { brand } from './brand'

interface Props {
  musicianName: string
  restaurantName: string
  gigDate: string
  dashboardUrl: string
}

export function ApplicationDeclinedEmail({
  musicianName,
  restaurantName,
  gigDate,
  dashboardUrl,
}: Props) {
  return (
    <EmailLayout previewText={`Update on your application to ${restaurantName} for ${gigDate}`}>
      <Text
        style={{
          color: brand.dark,
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        Application Update
      </Text>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '15px',
          margin: '0 0 24px 0',
          lineHeight: '1.6',
        }}
      >
        Hi {musicianName}, thanks for applying to {restaurantName}. Unfortunately
        they&apos;ve decided to go with another musician for {gigDate}.
      </Text>

      {/* Encouragement section */}
      <Section
        style={{
          backgroundColor: 'rgba(108,154,139,0.08)',
          border: `1px solid rgba(108,154,139,0.2)`,
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '24px',
        }}
      >
        <Text
          style={{
            color: brand.teal,
            fontSize: '15px',
            fontWeight: 'bold',
            margin: '0 0 6px 0',
          }}
        >
          Don&apos;t be discouraged!
        </Text>
        <Text
          style={{
            color: brand.charcoal,
            fontSize: '14px',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          There are plenty of venues looking for talent like yours. Keep
          applying — the right gig is out there.
        </Text>
      </Section>

      <EmailButton href={dashboardUrl}>Browse Open Gigs →</EmailButton>

      {/* Tip box */}
      <Section
        style={{
          borderLeft: `4px solid ${brand.primary}`,
          padding: '14px 16px',
          backgroundColor: '#FFF8F4',
          borderRadius: '0 8px 8px 0',
          marginTop: '24px',
        }}
      >
        <Text
          style={{
            color: brand.dark,
            fontSize: '13px',
            margin: 0,
            lineHeight: '1.6',
          }}
        >
          💡 <strong>Tip:</strong> Musicians with complete profiles including videos
          get 3x more bookings. Make sure your profile is complete!
        </Text>
      </Section>
    </EmailLayout>
  )
}
