import { Text, Section } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { brand } from './brand'

interface Props {
  musicianName: string
  restaurantName: string
  gigDate: string
  amount: number
  dashboardUrl: string
}

export function PayoutReleasedEmail({
  musicianName,
  restaurantName,
  gigDate,
  amount,
  dashboardUrl,
}: Props) {
  return (
    <EmailLayout previewText={`$${amount} is being transferred to your bank account`}>
      <Text
        style={{
          color: brand.primary,
          fontSize: '28px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        💸 Your Payment is on the Way!
      </Text>
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '16px',
          margin: '0 0 24px 0',
        }}
      >
        ${amount.toFixed(2)} is being transferred to your bank account
      </Text>

      {/* Timeline */}
      <Section
        style={{
          backgroundColor: '#F9F7F5',
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
          Payment Timeline
        </Text>
        <div style={{ marginBottom: '8px' }}>
          <Text style={{ color: brand.teal, fontSize: '14px', margin: 0, fontWeight: 'bold' }}>
            ✅ Gig completed ({gigDate})
          </Text>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <Text style={{ color: brand.teal, fontSize: '14px', margin: 0, fontWeight: 'bold' }}>
            ✅ Payment released
          </Text>
        </div>
        <div>
          <Text style={{ color: brand.charcoal, fontSize: '14px', margin: 0 }}>
            ⏳ Arrives in 1–2 business days
          </Text>
        </div>
      </Section>

      {/* Earnings card */}
      <Section
        style={{
          backgroundColor: 'rgba(108,154,139,0.08)',
          border: `1px solid rgba(108,154,139,0.25)`,
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
            margin: '0 0 10px 0',
          }}
        >
          Earnings Detail
        </Text>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Amount</Text>
          <Text style={{ color: brand.teal, fontSize: '18px', fontWeight: 'bold', margin: 0 }}>${amount.toFixed(2)}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>From</Text>
          <Text style={{ color: brand.dark, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>{restaurantName}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text style={{ color: brand.charcoal, fontSize: '13px', margin: 0 }}>Gig date</Text>
          <Text style={{ color: brand.dark, fontSize: '13px', fontWeight: 'bold', margin: 0 }}>{gigDate}</Text>
        </div>
      </Section>

      <EmailButton href={dashboardUrl}>View Earnings →</EmailButton>

      <Text
        style={{
          color: brand.charcoal,
          fontSize: '13px',
          marginTop: '16px',
        }}
      >
        Questions about your payment? Contact{' '}
        <a
          href="mailto:support@drum-up.app"
          style={{ color: brand.primary, textDecoration: 'none' }}
        >
          support@drum-up.app
        </a>
      </Text>
    </EmailLayout>
  )
}
