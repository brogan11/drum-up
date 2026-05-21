import { Text, Section } from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  recipientName: string
  recipientType: 'restaurant' | 'musician'
  musicianName: string
  restaurantName: string
  gigDate: string
  gigTime: string
  restaurantAddress: string
  payAmount: number
  platformFee: number
  musicianReceives: number
  stripePaymentIntentId: string
  dashboardUrl: string
}

export function BookingConfirmedEmail({
  recipientName,
  recipientType,
  musicianName,
  restaurantName,
  gigDate,
  gigTime,
  restaurantAddress,
  payAmount,
  platformFee,
  musicianReceives,
  stripePaymentIntentId,
  dashboardUrl,
}: Props) {
  const isRestaurant = recipientType === 'restaurant'

  return (
    <EmailLayout
      previewText={
        isRestaurant
          ? `Booking confirmed with ${musicianName} for ${gigDate}`
          : `Your gig at ${restaurantName} on ${gigDate} is confirmed!`
      }
    >
      <Text
        style={{
          color: brand.teal,
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        Booking Confirmed ✓
      </Text>
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '16px',
          margin: '0 0 24px 0',
        }}
      >
        {isRestaurant
          ? `Your booking with ${musicianName} is confirmed`
          : `Your gig at ${restaurantName} is confirmed`}
      </Text>

      {/* Payment summary */}
      <Section
        style={{
          backgroundColor: '#F9F9F9',
          borderRadius: '10px',
          padding: '16px',
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
            margin: '0 0 12px 0',
          }}
        >
          Payment Summary
        </Text>

        {isRestaurant ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Amount authorized</Text>
              <Text style={{ color: brand.dark, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>${payAmount}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <Text style={{ color: '#999', fontSize: '12px', margin: 0 }}>Platform fee (absorbed)</Text>
              <Text style={{ color: '#999', fontSize: '12px', margin: 0 }}>${platformFee.toFixed(2)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Payment status</Text>
              <Text style={{ color: brand.teal, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>Authorized — releases after gig</Text>
            </div>
          </>
        ) : (
          <>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Payment status</Text>
              <Text style={{ color: brand.primary, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>
                Releases after {gigDate}
              </Text>
            </div>
          </>
        )}
      </Section>

      {/* Booking details */}
      <InfoCard label="Date" value={`📅 ${gigDate}`} />
      <InfoCard label="Time" value={`🕐 ${gigTime}`} />
      <InfoCard label="Location" value={`📍 ${restaurantAddress}`} />

      <EmailButton href={dashboardUrl}>View Booking →</EmailButton>

      {/* Payment reference */}
      <Text
        style={{
          color: '#BBBBBB',
          fontSize: '11px',
          marginTop: '20px',
        }}
      >
        Payment ref: {stripePaymentIntentId}
      </Text>
    </EmailLayout>
  )
}
