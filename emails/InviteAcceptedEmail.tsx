import { Text } from 'react-email'
import { EmailLayout } from './components/EmailLayout'
import { EmailButton } from './components/EmailButton'
import { brand } from './brand'

interface Props {
  inviterName: string
  memberName: string
  profileUrl: string
}

export function InviteAcceptedEmail({ inviterName, memberName, profileUrl }: Props) {
  return (
    <EmailLayout previewText={`${memberName} joined Drum Up from your invite`}>
      <Text
        style={{
          color: brand.dark,
          fontSize: '26px',
          fontWeight: 'bold',
          margin: '0 0 4px 0',
          letterSpacing: '-0.5px',
        }}
      >
        🎉 {memberName} just joined
      </Text>
      <Text style={{ color: brand.charcoal, fontSize: '16px', margin: '0 0 24px 0' }}>
        Hey {inviterName.split(' ')[0]}, great news — {memberName} accepted your invite and
        created a Drum Up profile. You’re now connected, so you’ll see each other’s updates.
      </Text>

      <EmailButton href={profileUrl}>View their profile →</EmailButton>
    </EmailLayout>
  )
}
