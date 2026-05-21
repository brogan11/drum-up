import { resend } from './resend'
import { render } from 'react-email'
import type { ReactElement } from 'react'

export async function sendEmail({
  to,
  subject,
  emailComponent,
}: {
  to: string
  subject: string
  emailComponent: ReactElement
}) {
  try {
    const html = await render(emailComponent)
    const { data, error } = await resend.emails.send({
      from: process.env.FROM_EMAIL ?? 'notifications@drum-up.app',
      to,
      subject,
      html,
    })
    if (error) {
      console.error('[Email] Failed to send:', error)
      return { success: false, error }
    }
    console.log('[Email] Sent successfully:', data?.id)
    return { success: true, data }
  } catch (err) {
    console.error('[Email] Unexpected error:', err)
    return { success: false, error: err }
  }
}
