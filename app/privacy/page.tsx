import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Drum Up',
  description: 'Read the Drum Up Privacy Policy.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-snow flex flex-col">

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-graphite/85 border-b border-charcoal/20">
        <div className="flex items-center justify-between px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-white rounded-lg p-1">
              <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
            </div>
            <span className="text-snow text-xl font-black tracking-tight">Drum Up</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="text-snow hover:text-chestnut transition-colors font-medium">Log In</Link>
            <Link href="/auth/signup" className="bg-chestnut text-snow px-5 py-2 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* HEADER */}
      <div className="bg-graphite pt-32 pb-12 px-6 md:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-chestnut text-[10px] font-bold uppercase tracking-[0.25em] mb-3">Legal</p>
          <h1 className="text-snow text-4xl md:text-5xl font-black tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-charcoal text-sm">Effective: May 26, 2026</p>
        </div>
      </div>

      {/* CONTENT */}
      <main className="flex-1 px-6 md:px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="prose-legal">

            <Section title="1. Overview">
              <p>Drum Up ("we," "us," or "our") operates the Drum Up platform, a marketplace connecting restaurants and venues with musicians and live performers. This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have.</p>
              <p>By using Drum Up, you agree to the collection and use of information as described in this Policy. If you do not agree, please do not use the Service.</p>
            </Section>

            <Section title="2. Information We Collect">
              <Subsection title="Information You Provide">
                <p>When you create an account or use the Service, you may provide:</p>
                <ul>
                  <li><strong>Account details:</strong> name, email address, password (hashed), and account type (restaurant, musician, or fan).</li>
                  <li><strong>Profile information:</strong> bio, profile photo, genre preferences, instruments played, venue capacity, cuisine type, and social media links (Instagram, TikTok, Spotify, YouTube).</li>
                  <li><strong>Location:</strong> your city, state, and geographic coordinates (latitude and longitude), provided either via your device's location services or by entering an address manually.</li>
                  <li><strong>Slot and booking data:</strong> dates, times, pay amounts, and descriptions for slots posted by restaurants and applications submitted by musicians.</li>
                  <li><strong>Messages:</strong> content you send and receive through the Drum Up messaging system.</li>
                  <li><strong>Payment information:</strong> processed through Stripe. Drum Up does not store full card numbers or bank account details; Stripe handles all sensitive payment data under their own privacy and security policies.</li>
                </ul>
              </Subsection>

              <Subsection title="Information We Collect Automatically">
                <p>When you use the Service, we automatically collect:</p>
                <ul>
                  <li><strong>Log data:</strong> IP address, browser type, pages visited, time and date of visits, and referring URLs.</li>
                  <li><strong>Device information:</strong> operating system, device type, and browser version.</li>
                  <li><strong>Usage data:</strong> features you use, searches you perform, and how you interact with the platform.</li>
                  <li><strong>Cookies and similar technologies:</strong> session tokens and preference data. See Section 8 for more detail.</li>
                </ul>
              </Subsection>

              <Subsection title="Information from Third Parties">
                <p>If you sign in with Google, we receive your name, email address, and profile photo from Google as permitted by your Google account settings. We do not receive your Google password.</p>
              </Subsection>
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul>
                <li>Create and maintain your account.</li>
                <li>Match restaurants with musicians based on location, genre, and availability.</li>
                <li>Process bookings and facilitate payments between parties.</li>
                <li>Send transactional communications (booking confirmations, application updates, payment receipts).</li>
                <li>Display your public profile to other users of the appropriate type.</li>
                <li>Provide customer support and resolve disputes.</li>
                <li>Detect and prevent fraud, abuse, and violations of our Terms of Service.</li>
                <li>Improve the platform through analysis of usage patterns and behavior.</li>
                <li>Comply with legal obligations.</li>
              </ul>
              <p>We do not sell your personal information to third parties. We do not use your data to serve third-party advertising.</p>
            </Section>

            <Section title="4. Location Data">
              <p>Location is central to how Drum Up works. We use your location to:</p>
              <ul>
                <li>Show musicians nearby open slots within a radius you select.</li>
                <li>Show restaurants musicians available in their area.</li>
                <li>Help fans discover live music near them.</li>
              </ul>
              <p>Your precise coordinates (latitude and longitude) are stored in our database and used for distance calculations. Your city and state are displayed publicly on your profile. Your precise coordinates are never displayed to other users.</p>
              <p>If you grant browser location access during onboarding, we capture a one-time reading. We do not continuously track your location in the background. You may update your location at any time from your profile settings.</p>
            </Section>

            <Section title="5. How We Share Your Information">
              <Subsection title="Other Users">
                <p>Your public profile (name, photo, bio, genre, location city, and social links) is visible to other users. Restaurants can see musician profiles; musicians can see restaurant slot listings; fans can see both. Your email address and precise coordinates are never shared with other users.</p>
              </Subsection>

              <Subsection title="Service Providers">
                <p>We share data with trusted third-party providers who help us operate the Service:</p>
                <ul>
                  <li><strong>Supabase:</strong> database, authentication, and file storage infrastructure.</li>
                  <li><strong>Stripe:</strong> payment processing and Stripe Connect for musician payouts.</li>
                  <li><strong>Google:</strong> OAuth authentication and location autocomplete (Places API).</li>
                  <li><strong>Vercel:</strong> hosting and edge network delivery.</li>
                  <li><strong>Resend:</strong> transactional email delivery for booking confirmations, notifications, and account alerts.</li>
                </ul>
                <p>These providers are contractually bound to use your data only to provide services to us, not for their own purposes.</p>
              </Subsection>

              <Subsection title="Legal Requirements">
                <p>We may disclose your information if required by law, subpoena, court order, or government request, or if we believe in good faith that disclosure is necessary to protect the rights, property, or safety of Drum Up, our users, or the public.</p>
              </Subsection>

              <Subsection title="Business Transfers">
                <p>If Drum Up is acquired by or merged with another company, your information may be transferred as part of that transaction. We will notify you before your information is subject to a materially different privacy policy.</p>
              </Subsection>
            </Section>

            <Section title="6. Data Retention">
              <p>We retain your account data for as long as your account is active. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal or regulatory purposes (such as tax records related to payments).</p>
              <p>Message content between users is retained until one or both parties deletes the conversation thread. Deleted messages are purged from our systems within 7 days of deletion.</p>
            </Section>

            <Section title="7. Your Rights and Choices">
              <Subsection title="Access and Correction">
                <p>You may view and update your profile information at any time from your account settings. If you believe we hold inaccurate data about you that you cannot correct through the app, contact us at support@drumup.app.</p>
              </Subsection>

              <Subsection title="Account Deletion">
                <p>You may delete your account from your account settings. Deleting your account removes your profile and personal data from the platform, subject to the retention periods described above.</p>
              </Subsection>

              <Subsection title="Location">
                <p>You can revoke browser location permission at any time in your browser or device settings. You can also update or remove your stored location from your profile settings.</p>
              </Subsection>

              <Subsection title="Communications">
                <p>Transactional messages (booking confirmations, payment receipts, account alerts) are necessary for the Service and cannot be opted out of while you have an active account. If we introduce marketing emails in the future, you will be able to opt out via an unsubscribe link.</p>
              </Subsection>

              <Subsection title="California Residents">
                <p>If you are a California resident, you have the right to request disclosure of the categories and specific pieces of personal information we have collected about you, to request deletion of your personal information, and to opt out of any sale of personal information. We do not sell personal information. To exercise your rights, contact support@drumup.app.</p>
              </Subsection>
            </Section>

            <Section title="8. Cookies and Tracking">
              <p>Drum Up uses cookies and similar technologies to:</p>
              <ul>
                <li>Maintain your logged-in session.</li>
                <li>Remember your preferences (such as your selected browse location and radius).</li>
                <li>Understand how users interact with the platform so we can improve it.</li>
              </ul>
              <p>We do not use third-party advertising cookies. You can configure your browser to block or delete cookies, but doing so may affect your ability to log in and use the Service.</p>
            </Section>

            <Section title="9. Security">
              <p>We implement industry-standard security measures including encrypted data transmission (TLS), hashed passwords, Row Level Security policies on our database, and access controls that limit which employees can access user data. No method of transmission or storage is 100% secure. If you discover a potential security vulnerability, please report it to security@drumup.app.</p>
            </Section>

            <Section title="10. Children's Privacy">
              <p>Drum Up is not intended for users under the age of 18. We do not knowingly collect personal information from anyone under 18. If we become aware that a minor has created an account, we will delete the account and associated data promptly. Contact us at support@drumup.app if you believe we have collected information from a minor.</p>
            </Section>

            <Section title="11. Changes to This Policy">
              <p>We may update this Privacy Policy as the Service evolves. When we make material changes, we will update the effective date at the top of this page and, where appropriate, notify you by email or via a notice in the app. Your continued use of the Service after changes take effect constitutes acceptance of the revised Policy.</p>
            </Section>

            <Section title="12. Contact Us">
              <p>If you have questions about this Privacy Policy or how we handle your data, please contact us:</p>
              <p className="font-semibold text-graphite">support@drumup.app</p>
            </Section>

          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-graphite border-t border-charcoal/30 py-12 px-6 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="bg-white rounded-lg p-1">
                  <img src="/orange-drum-up.png" alt="Drum Up" className="w-6 h-6 object-contain" />
                </div>
                <span className="text-snow text-lg font-black tracking-tight">Drum Up</span>
              </div>
              <p className="text-charcoal text-sm">Where restaurants meet live music.</p>
            </div>
            <div className="flex flex-wrap gap-x-12 gap-y-6">
              <div>
                <p className="text-snow/40 text-[10px] font-bold uppercase tracking-widest mb-3">Navigate</p>
                <ul className="text-charcoal text-sm space-y-2">
                  <li><Link href="/" className="hover:text-chestnut transition-colors">Home</Link></li>
                  <li><Link href="/auth/signup" className="hover:text-chestnut transition-colors">Sign Up</Link></li>
                  <li><Link href="/auth/login" className="hover:text-chestnut transition-colors">Log In</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-snow/40 text-[10px] font-bold uppercase tracking-widest mb-3">Legal</p>
                <ul className="text-charcoal text-sm space-y-2">
                  <li><Link href="/terms" className="hover:text-chestnut transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-chestnut transition-colors">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-charcoal/30 pt-8">
            <p className="text-charcoal/60 text-sm">© 2026 Drum Up. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-graphite text-xl font-black tracking-tight mb-4 pb-3 border-b border-charcoal/10">{title}</h2>
      <div className="space-y-3 text-charcoal text-[15px] leading-relaxed [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:marker:text-chestnut [&_strong]:text-graphite [&_strong]:font-bold">
        {children}
      </div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-graphite text-[15px] font-black mb-2">{title}</h3>
      <div className="space-y-2 [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:marker:text-chestnut [&_strong]:text-graphite [&_strong]:font-bold">
        {children}
      </div>
    </div>
  )
}
