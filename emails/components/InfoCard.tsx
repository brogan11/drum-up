import { Section, Text } from '@react-email/components'
import { brand } from '../brand'

export function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Section
      style={{
        backgroundColor: '#F5F5F5',
        borderRadius: '10px',
        padding: '12px 16px',
        marginBottom: '8px',
      }}
    >
      <Text
        style={{
          color: brand.charcoal,
          fontSize: '11px',
          textTransform: 'uppercase' as const,
          letterSpacing: '1px',
          margin: 0,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: brand.dark,
          fontSize: '16px',
          fontWeight: 'bold',
          margin: '4px 0 0 0',
        }}
      >
        {value}
      </Text>
    </Section>
  )
}
