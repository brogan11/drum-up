import { Text } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { InfoCard } from './components/InfoCard'
import { brand } from './brand'

interface Props {
  inviterName: string
  inviteeName?: string
  invitedRole: 'restaurant' | 'musician'
  joinUrl: string
}

export function InviteEmail({ inviterName, inviteeName, invitedRole, joinUrl }: Props) {
  const greeting = inviteeName ? `Hey ${inviteeName.split(' ')[0]},` : 'Hey there,'
  const rolePitch = invitedRole === 'restaurant'
    ? 'post open music slots, discover local talent, and handle booking & payment in one place.'
    : 'find paid gigs nearby, get booked, and get paid — all on one platform.'

  return (
    <EmailLayout previewText={`${inviterName} invited you to join Drum Up`}>
      <Text
        style={{
          color: brand.dark,
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        🎶 {inviterName} invited you to Drum Up
      </Text>
      <Text style={{ color: brand.charcoal, fontSize: '16px', margin: '0 0 24px 0' }}>
        {greeting} {inviterName} uses Drum Up — the platform for live music booking — and
        wants to connect with you on it. Join free to {rolePitch}
      </Text>

      <InfoCard label="Invited by" value={inviterName} />
      <InfoCard label="Join as" value={invitedRole === 'restaurant' ? 'Venue / Restaurant' : 'Musician'} />

      <EmailButton href={joinUrl}>Accept invite & join →</EmailButton>

      <Text style={{ color: brand.charcoal, fontSize: '13px', marginTop: '16px' }}>
        Creating a profile is free and takes about a minute. Once you’re in, you and{' '}
        {inviterName.split(' ')[0]} will be connected automatically.
      </Text>
    </EmailLayout>
  )
}
