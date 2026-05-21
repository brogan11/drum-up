import { Text } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  recipientName: string
  recipientType: 'restaurant' | 'musician'
  otherPartyName: string
  gigDate: string
  gigTime: string
  restaurantAddress: string
  dashboardUrl: string
}

export function GigReminderEmail({
  recipientName,
  recipientType,
  otherPartyName,
  gigDate,
  gigTime,
  restaurantAddress,
  dashboardUrl,
}: Props) {
  const isMusician = recipientType === 'musician'
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurantAddress)}`

  return (
    <EmailLayout
      previewText={
        isMusician
          ? `Reminder: you're performing at ${otherPartyName} tomorrow`
          : `Reminder: ${otherPartyName} is performing at your venue tomorrow`
      }
    >
      <Text
        style={{
          color: brand.primary,
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        🎵 Your Gig is Tomorrow!
      </Text>
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '16px',
          margin: '0 0 24px 0',
        }}
      >
        {isMusician
          ? `You're performing at ${otherPartyName} tomorrow`
          : `${otherPartyName} is performing at your venue tomorrow`}
      </Text>

      <InfoCard label="Date" value={`📅 ${gigDate}`} />
      <InfoCard label="Time" value={`🕐 ${gigTime}`} />
      <InfoCard label="Location" value={`📍 ${restaurantAddress}`} />

      {isMusician && (
        <Text style={{ marginTop: '12px', marginBottom: '8px' }}>
          <a
            href={googleMapsUrl}
            style={{
              color: brand.primary,
              fontSize: '14px',
              fontWeight: 'bold',
              textDecoration: 'none',
            }}
          >
            📍 Get Directions →
          </a>
        </Text>
      )}

      <EmailButton href={dashboardUrl}>View Booking Details →</EmailButton>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '13px',
          marginTop: '16px',
        }}
      >
        Have questions? Message {otherPartyName} directly in the app.
      </Text>
    </EmailLayout>
  )
}
