import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from 'react-email'
import { brand } from '../brand'

export function EmailLayout({
  children,
  previewText,
}: {
  children: React.ReactNode
  previewText: string
}) {
  return (
    <Html>
      <Head />
      <Body
        style={{
          backgroundColor: brand.background,
          margin: 0,
          padding: '40px 0',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* Preview text (hidden, shows in inbox) */}
        <div style={{ display: 'none', maxHeight: 0, overflow: 'hidden' }}>
          {previewText}
        </div>

        <Container
          style={{
            maxWidth: '560px',
            margin: '0 auto',
            backgroundColor: brand.white,
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <Section
            style={{
              backgroundColor: brand.dark,
              padding: '24px 32px',
            }}
          >
            <Text
              style={{
                color: brand.primary,
                fontSize: '28px',
                fontWeight: 'bold',
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              Drum Up
            </Text>
            <Text
              style={{
                color: brand.teal,
                fontSize: '11px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                margin: '4px 0 0 0',
              }}
            >
              Live Music Platform
            </Text>
          </Section>

          {/* Content */}
          <Section style={{ padding: '32px' }}>{children}</Section>

          {/* Footer */}
          <Hr style={{ borderColor: '#EEEEEE', margin: 0 }} />
          <Section
            style={{
              padding: '24px 32px',
              backgroundColor: '#FAFAFA',
            }}
          >
            <Text
              style={{
                color: brand.charcoal,
                fontSize: '12px',
                margin: 0,
                textAlign: 'center' as const,
              }}
            >
              {brand.tagline}
            </Text>
            <Text
              style={{
                color: '#AAAAAA',
                fontSize: '11px',
                textAlign: 'center' as const,
                margin: '8px 0 0 0',
              }}
            >
              <a href={brand.url} style={{ color: '#AAAAAA' }}>
                drum-up.app
              </a>
              {' · '}
              <a
                href={`mailto:${brand.supportEmail}`}
                style={{ color: '#AAAAAA' }}
              >
                support@drum-up.app
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
