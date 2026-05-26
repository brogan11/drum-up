import { Text, Section } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  recipientName: string
  cancelledBy: 'musician' | 'restaurant'
  musicianName: string
  restaurantName: string
  gigDate: string
  amount: number
  dashboardUrl: string
}

export function CancellationEmail({
  recipientName,
  cancelledBy,
  musicianName,
  restaurantName,
  gigDate,
  amount,
  dashboardUrl,
}: Props) {
  const restaurantIsRecipient = cancelledBy === 'musician'

  return (
    <EmailLayout
      previewText={
        restaurantIsRecipient
          ? `${musicianName} has cancelled their booking for ${gigDate}`
          : `${restaurantName} has cancelled your booking for ${gigDate}`
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
        Booking Cancelled
      </Text>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '16px',
          margin: '0 0 24px 0',
          lineHeight: '1.5',
        }}
      >
        {restaurantIsRecipient
          ? `Hi ${recipientName}, unfortunately ${musicianName} has cancelled their booking for your gig on ${gigDate}.`
          : `Hi ${recipientName}, ${restaurantName} has cancelled your booking for ${gigDate}. You are not at fault — no payment has been taken from you.`}
      </Text>

      <InfoCard label="Gig Date" value={gigDate} />
      {restaurantIsRecipient
        ? <InfoCard label="Musician" value={musicianName} />
        : <InfoCard label="Venue" value={restaurantName} />}
      <InfoCard label="Booking Amount" value={`$${amount.toFixed(2)}`} />

      {restaurantIsRecipient ? (
        <Section
          style={{
            backgroundColor: 'rgba(108,154,139,0.08)',
            border: '1px solid rgba(108,154,139,0.25)',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '16px',
            marginBottom: '24px',
          }}
        >
          <Text
            style={{
              color: brand.charcoal,
              fontSize: '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: '0 0 10px 0',
            }}
          >
            Refund Summary
          </Text>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Amount Authorized</Text>
            <Text style={{ color: brand.dark, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>${amount.toFixed(2)}</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Refund to Your Card</Text>
            <Text style={{ color: brand.teal, fontSize: '18px', fontWeight: 'bold', margin: 0 }}>${amount.toFixed(2)}</Text>
          </div>
          <Text
            style={{
              color: brand.charcoal,
              fontSize: '12px',
              margin: '12px 0 0 0',
              lineHeight: '1.5',
            }}
          >
            Your full authorized amount will be released back to your card within 5–10 business days.
            Your slot has been reopened so you can find a new musician.
          </Text>
        </Section>
      ) : (
        <Section
          style={{
            backgroundColor: 'rgba(108,154,139,0.08)',
            border: '1px solid rgba(108,154,139,0.25)',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '16px',
            marginBottom: '24px',
          }}
        >
          <Text
            style={{
              color: brand.teal,
              fontSize: '14px',
              fontWeight: 'bold',
              margin: '0 0 6px 0',
            }}
          >
            You are not at fault
          </Text>
          <Text
            style={{
              color: brand.charcoal,
              fontSize: '13px',
              margin: 0,
              lineHeight: '1.5',
            }}
          >
            No payment has been charged to you. Your Drum Up account remains in good standing.
            We are sorry for the inconvenience — new gig opportunities are posted every day.
          </Text>
        </Section>
      )}

      <EmailButton href={dashboardUrl}>
        {restaurantIsRecipient ? 'Find a New Musician →' : 'Browse Open Gigs →'}
      </EmailButton>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '13px',
          marginTop: '16px',
        }}
      >
        Questions? Contact{' '}
        <a href="mailto:support@drum-up.app" style={{ color: brand.primary, textDecoration: 'none' }}>
          support@drum-up.app
        </a>
      </Text>
    </EmailLayout>
  )
}
