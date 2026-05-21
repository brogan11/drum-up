import { Text, Section } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  musicianName: string
  restaurantName: string
  gigDate: string
  gigTime: string
  payAmount: number
  platformFee: number
  musicianReceives: number
  restaurantAddress: string
  dashboardUrl: string
}

export function ApplicationAcceptedEmail({
  musicianName,
  restaurantName,
  gigDate,
  gigTime,
  payAmount,
  platformFee,
  musicianReceives,
  restaurantAddress,
  dashboardUrl,
}: Props) {
  return (
    <EmailLayout previewText={`${restaurantName} accepted your application! You're booked for ${gigDate}`}>
      <Text
        style={{
          color: brand.primary,
          fontSize: '30px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        You got the gig! 🎉
      </Text>
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '16px',
          margin: '0 0 24px 0',
        }}
      >
        {restaurantName} has confirmed your booking
      </Text>

      {/* Success banner */}
      <Section
        style={{
          backgroundColor: 'rgba(108,154,139,0.12)',
          border: `1px solid rgba(108,154,139,0.3)`,
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '24px',
        }}
      >
        <Text
          style={{
            color: brand.teal,
            fontSize: '14px',
            fontWeight: 'bold',
            margin: 0,
            lineHeight: '1.5',
          }}
        >
          💳 Payment of ${payAmount} has been authorized and will be released to
          your account after the gig.
        </Text>
      </Section>

      <InfoCard label="Date" value={`📅 ${gigDate}`} />
      <InfoCard label="Time" value={`🕐 ${gigTime}`} />
      <InfoCard label="Location" value={`📍 ${restaurantAddress}`} />
      <InfoCard label="You Receive" value={`💰 $${musicianReceives.toFixed(2)}`} />

      {/* Payment breakdown */}
      <Section
        style={{
          backgroundColor: '#F9F9F9',
          borderRadius: '10px',
          padding: '14px 16px',
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
          Payment Breakdown
        </Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Gig pay</Text>
          <Text style={{ color: brand.dark, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>${payAmount}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <Text style={{ color: '#999', fontSize: '12px', margin: 0 }}>Platform fee (8%)</Text>
          <Text style={{ color: '#999', fontSize: '12px', margin: 0 }}>-${platformFee.toFixed(2)}</Text>
        </div>
        <div
          style={{
            borderTop: '1px solid #E8E8E8',
            paddingTop: '8px',
            marginTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: brand.dark, fontSize: '14px', fontWeight: 'bold', margin: 0 }}>You receive</Text>
          <Text style={{ color: brand.teal, fontSize: '14px', fontWeight: 'bold', margin: 0 }}>${musicianReceives.toFixed(2)}</Text>
        </div>
      </Section>

      <EmailButton href={dashboardUrl}>View Booking Details →</EmailButton>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '13px',
          marginTop: '16px',
        }}
      >
        Questions? Reply to this email or message {restaurantName} directly in
        the app.
      </Text>
    </EmailLayout>
  )
}
