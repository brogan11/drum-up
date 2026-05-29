import { Text } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  recipientName: string
  venueName: string
  gigDate: string
  gigTime: string
  payAmount: number
  genres: string[]
  location: string
  dashboardUrl: string
  audience: 'musician' | 'fan'
}

export function NewGigEmail({
  recipientName,
  venueName,
  gigDate,
  gigTime,
  payAmount,
  genres,
  location,
  dashboardUrl,
  audience,
}: Props) {
  const isMusician = audience === 'musician'
  return (
    <EmailLayout previewText={`${venueName} just posted a gig on ${gigDate}`}>
      <Text
        style={{
          color: brand.dark,
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        🎶 {isMusician ? 'New gig near you' : 'New show announced'}
      </Text>
      <Text style={{ color: brand.charcoal, fontSize: '16px', margin: '0 0 24px 0' }}>
        {isMusician
          ? `Hey ${recipientName}, ${venueName} just posted a slot that matches you.`
          : `Hey ${recipientName}, ${venueName} just posted a new live music slot.`}
      </Text>

      <InfoCard label="Venue" value={venueName} />
      <InfoCard label="Date" value={`📅 ${gigDate}`} />
      <InfoCard label="Time" value={`🕐 ${gigTime}`} />
      {location && <InfoCard label="Location" value={`📍 ${location}`} />}
      {isMusician && payAmount > 0 && <InfoCard label="Pay" value={`💰 $${payAmount}`} />}
      {genres.length > 0 && <InfoCard label="Genres" value={genres.join(', ')} />}

      <EmailButton href={dashboardUrl}>
        {isMusician ? 'View & Apply →' : 'See Details →'}
      </EmailButton>

      <Text style={{ color: brand.charcoal, fontSize: '13px', marginTop: '16px' }}>
        You can turn off gig alerts anytime in your settings.
      </Text>
    </EmailLayout>
  )
}
