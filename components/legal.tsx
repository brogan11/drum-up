// Single source of truth for the Terms of Service and Privacy Policy bodies.
// Rendered verbatim on /terms, /privacy AND inside onboarding, so the version a
// user agrees to at signup is always identical to the public pages. Update the
// text (and LEGAL_EFFECTIVE_DATE) here only — everything stays in sync.
//
// These are plain presentational components (no hooks / server APIs), so they
// import safely into both server components (the legal pages) and client
// components (onboarding).

export const LEGAL_EFFECTIVE_DATE = 'May 26, 2026'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-graphite text-xl font-black tracking-tight mb-4 pb-3 border-b border-charcoal/10">{title}</h2>
      <div className="space-y-3 text-charcoal text-[15px] leading-relaxed [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:marker:text-chestnut [&_strong]:text-graphite [&_strong]:font-bold">
        {children}
      </div>
    </section>
  )
}

export function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-graphite text-[15px] font-black mb-2">{title}</h3>
      <div className="space-y-2 [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:marker:text-chestnut [&_strong]:text-graphite [&_strong]:font-bold">
        {children}
      </div>
    </div>
  )
}

export function TermsContent() {
  return (
    <>
      <Section title="1. Acceptance of Terms">
        <p>By accessing or using Drum Up (the &ldquo;Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the Service. These Terms apply to all users, including restaurants, musicians, fans, and visitors.</p>
        <p>We may update these Terms from time to time. Continued use of the Service after changes are posted constitutes your acceptance of the revised Terms.</p>
      </Section>

      <Section title="2. Who We Are">
        <p>Drum Up is a two-sided marketplace platform that connects restaurants and venues seeking live musical entertainment with musicians and bands looking for performance opportunities. Fans can also use Drum Up to discover and follow live music in their area.</p>
        <p>Drum Up is not a talent agency, employer, or staffing firm. We provide the platform; the relationship formed through a booking is between the restaurant and the musician.</p>
      </Section>

      <Section title="3. Eligibility">
        <p>You must be at least 18 years old to create an account. By registering, you represent and warrant that:</p>
        <ul>
          <li>You are at least 18 years of age.</li>
          <li>You have the legal authority to enter into these Terms.</li>
          <li>All information you provide is accurate and current.</li>
          <li>You will maintain the accuracy of your information.</li>
        </ul>
        <p>Accounts may not be created or used by automated systems without our prior written consent.</p>
      </Section>

      <Section title="4. Account Registration">
        <p>To access most features you must create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at brogan.smith525@gmail.com if you suspect unauthorized access.</p>
        <p>You may not share your account, transfer it to another person, or create multiple accounts for the purpose of circumventing restrictions.</p>
      </Section>

      <Section title="5. User Types and Responsibilities">
        <Subsection title="Restaurants and Venues">
          <p>Restaurants post availability slots — specific dates and times when they are looking to book live music. By posting a slot, you agree that:</p>
          <ul>
            <li>The slot information is accurate (date, time, pay offered, location).</li>
            <li>You have the authority to book live entertainment at the listed venue.</li>
            <li>You will respond to musician applications in a timely manner.</li>
            <li>Confirmed bookings are a binding commitment between you and the musician.</li>
            <li>All payments to musicians must flow through Drum Up&apos;s payment system. Off-platform payments to avoid booking fees are a violation of these Terms.</li>
          </ul>
        </Subsection>
        <Subsection title="Musicians and Artists">
          <p>Musicians and artists apply for open slots posted by restaurants. By applying, you agree that:</p>
          <ul>
            <li>Your profile accurately represents your act (genre, format, experience).</li>
            <li>You will honor confirmed bookings and appear as scheduled.</li>
            <li>If you must cancel, you will notify the restaurant and Drum Up as early as possible.</li>
            <li>You have all rights to any media (audio, video, photos) you upload to your profile.</li>
          </ul>
          <p>Musicians and artists using Drum Up are independent contractors and not employees, agents, or partners of Drum Up or of any restaurant or venue. Nothing in these Terms creates an employment relationship. Musicians are solely responsible for their own equipment, transportation, and professional conduct at any engagement booked through the platform.</p>
        </Subsection>
        <Subsection title="Fans">
          <p>Fans use Drum Up to discover live music at local venues. Fan accounts are free. Fans may follow musicians and restaurants and receive notifications of upcoming events. Fans are not permitted to contact restaurants or musicians through the platform for the purpose of soliciting direct bookings that circumvent Drum Up.</p>
        </Subsection>
      </Section>

      <Section title="6. Bookings and Payments">
        <p>When a restaurant confirms a musician application, a booking is created. All payment for confirmed bookings must be processed through Drum Up&apos;s integrated payment system (powered by Stripe Connect).</p>
        <Subsection title="Platform Fee">
          <p>Drum Up charges a platform fee of 8% on each booking. This fee is deducted at the time of payment and covers payment processing, platform maintenance, and fraud protection.</p>
        </Subsection>
        <Subsection title="Payouts">
          <p>Musicians receive payouts after the performance date, subject to any hold periods required by our payment processor. Drum Up is not responsible for delays caused by banking institutions or payment processors outside our control.</p>
        </Subsection>
        <Subsection title="Off-Platform Payments">
          <p>Facilitating payment outside of Drum Up (including via Venmo, cash, or other direct methods) to avoid the platform fee is strictly prohibited and may result in permanent account suspension.</p>
        </Subsection>
      </Section>

      <Section title="7. Cancellations and Refunds">
        <Subsection title="Cancellation by Restaurant">
          <p>If a restaurant cancels a confirmed booking at any time, the restaurant will be refunded the gig pay amount minus the 8% platform fee, which is retained by Drum Up. The musician will be notified promptly. The platform fee is non-refundable regardless of when the cancellation occurs.</p>
        </Subsection>
        <Subsection title="Cancellation by Musician">
          <p>If a musician cancels a confirmed booking with more than 48 hours&apos; notice before the performance, the booking is voided and the restaurant receives a full refund of the gig pay with no platform fee retained. If a musician cancels within 48 hours of the scheduled performance, their account will be automatically suspended pending review. Repeated late cancellations may result in permanent removal from the platform.</p>
        </Subsection>
        <Subsection title="Disputes">
          <p>If a dispute arises between a restaurant and a musician regarding a booking, both parties should contact brogan.smith525@gmail.com. Drum Up will make good-faith efforts to mediate but is not obligated to do so. All payment decisions made by Drum Up in connection with a dispute are final.</p>
        </Subsection>
      </Section>

      <Section title="8. Music Licensing and Performance Rights">
        <p>Drum Up is a booking marketplace only and is not responsible for ensuring compliance with music performance licensing requirements, including but not limited to licenses issued by ASCAP, BMI, and SESAC.</p>
        <p>Restaurants and venues are solely responsible for obtaining any required performance licenses for their establishment prior to hosting live music. This includes blanket licenses for publicly performed musical compositions where required by applicable law.</p>
        <p>Musicians are solely responsible for ensuring they have the rights to perform any material included in their sets. Drum Up makes no representations and accepts no liability regarding the licensing status of any music performed at a booked engagement.</p>
      </Section>

      <Section title="9. Taxes and Reporting">
        <p>Musicians are responsible for reporting and paying all applicable federal, state, and local taxes on income earned through the Drum Up platform. Drum Up does not withhold taxes on behalf of musicians.</p>
        <p>Drum Up and its payment processor Stripe may be required to issue IRS Form 1099-K to musicians who exceed applicable reporting thresholds under federal tax law. By using the platform, musicians agree to provide accurate tax identification information as required and acknowledge that Drum Up may report payment information to the IRS and other applicable tax authorities.</p>
        <p>Musicians should consult a qualified tax professional regarding their individual tax obligations. Drum Up is not a tax advisor and nothing in these Terms constitutes tax advice.</p>
      </Section>

      <Section title="10. Prohibited Conduct">
        <p>You agree not to:</p>
        <ul>
          <li>Post false, misleading, or fraudulent information on your profile or in slot listings.</li>
          <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
          <li>Harass, threaten, or abuse other users.</li>
          <li>Circumvent or attempt to circumvent the platform fee through any means.</li>
          <li>Scrape, crawl, or otherwise extract data from the Service in bulk without written permission.</li>
          <li>Upload malware, viruses, or any harmful code.</li>
          <li>Impersonate another person or entity.</li>
          <li>Use the messaging system to solicit direct bookings or share payment information.</li>
        </ul>
        <p>Violations may result in account suspension or permanent termination.</p>
      </Section>

      <Section title="11. Intellectual Property">
        <p>The Drum Up name, logo, and all platform content created by Drum Up are protected by copyright and trademark law. You may not use our branding without express written permission.</p>
        <p>Content you upload (profile photos, performance videos, bio text) remains yours. By uploading it, you grant Drum Up a non-exclusive, royalty-free, worldwide license to display and distribute that content as part of operating the Service, including for marketing and promotional purposes. You may revoke this license by deleting the content from your account.</p>
      </Section>

      <Section title="12. Third-Party Services">
        <p>Drum Up integrates with third-party services including Stripe (payments), Google (authentication and location), and Supabase (infrastructure). Your use of those services is subject to their respective terms and privacy policies. Drum Up is not responsible for the acts or omissions of any third-party provider.</p>
      </Section>

      <Section title="13. Disclaimers">
        <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied. Drum Up does not warrant that the Service will be uninterrupted, error-free, or free of harmful components. We do not endorse any musician, restaurant, or other user, and we make no representations about the quality, safety, or legality of any listing or performance.</p>
      </Section>

      <Section title="14. Limitation of Liability">
        <p>To the fullest extent permitted by applicable law, Drum Up and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service, even if Drum Up has been advised of the possibility of such damages.</p>
        <p>Drum Up&apos;s total liability to you for any claim arising out of these Terms or the Service shall not exceed the greater of: (a) the amount you paid to Drum Up in the 12 months preceding the claim, or (b) one hundred dollars ($100 USD).</p>
      </Section>

      <Section title="15. Indemnification">
        <p>You agree to indemnify, defend, and hold harmless Drum Up and its affiliates from any claims, losses, liabilities, damages, costs, or expenses (including reasonable attorneys&apos; fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content you submit to the Service.</p>
      </Section>

      <Section title="16. Governing Law">
        <p>These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to its conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in Philadelphia, Pennsylvania, and you consent to personal jurisdiction in those courts.</p>
      </Section>

      <Section title="17. Termination">
        <p>We reserve the right to suspend or terminate your account at any time, with or without notice, for violations of these Terms or for any other reason at our sole discretion. You may delete your account at any time from your account settings. Upon termination, your right to use the Service ceases immediately, though these Terms will otherwise survive termination to the extent applicable.</p>
      </Section>

      <Section title="18. Contact Us">
        <p>Questions about these Terms? Reach us at:</p>
        <p className="font-semibold text-graphite">brogan.smith525@gmail.com</p>
      </Section>
    </>
  )
}

export function PrivacyContent() {
  return (
    <>
      <Section title="1. Overview">
        <p>Drum Up (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the Drum Up platform, a marketplace connecting restaurants and venues with musicians and live performers. This Privacy Policy explains what information we collect, how we use it, who we share it with, and the choices you have.</p>
        <p>By using Drum Up, you agree to the collection and use of information as described in this Policy. If you do not agree, please do not use the Service.</p>
      </Section>

      <Section title="2. Information We Collect">
        <Subsection title="Information You Provide">
          <p>When you create an account or use the Service, you may provide:</p>
          <ul>
            <li><strong>Account details:</strong> name, email address, password (hashed), and account type (restaurant, musician, or fan).</li>
            <li><strong>Profile information:</strong> bio, profile photo, genre preferences, instruments played, venue capacity, cuisine type, and social media links (Instagram, TikTok, Spotify, YouTube).</li>
            <li><strong>Location:</strong> your city, state, and geographic coordinates (latitude and longitude), provided either via your device&apos;s location services or by entering an address manually.</li>
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
          <p>You may view and update your profile information at any time from your account settings. If you believe we hold inaccurate data about you that you cannot correct through the app, contact us at brogan.smith525@gmail.com.</p>
        </Subsection>
        <Subsection title="Account Deletion">
          <p>You may delete your account at any time from your account settings. Deleting your account immediately removes your public profile and personal data (including your profile details, messages, follows, saved items, and reviews you have written) from the platform. Records we are legally required to keep — such as booking and payment records used for tax and accounting — are retained in anonymized form for up to seven years, then deleted. All other personal data is deleted or anonymized within 30 days.</p>
        </Subsection>
        <Subsection title="Location">
          <p>You can revoke browser location permission at any time in your browser or device settings. You can also update or remove your stored location from your profile settings.</p>
        </Subsection>
        <Subsection title="Communications">
          <p>Transactional messages (booking confirmations, payment receipts, account alerts) are necessary for the Service and cannot be opted out of while you have an active account. If we introduce marketing emails in the future, you will be able to opt out via an unsubscribe link.</p>
        </Subsection>
        <Subsection title="California Residents">
          <p>If you are a California resident, you have the right to request disclosure of the categories and specific pieces of personal information we have collected about you, to request deletion of your personal information, and to opt out of any sale of personal information. We do not sell personal information. To exercise your rights, contact brogan.smith525@gmail.com.</p>
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
        <p>We implement industry-standard security measures including encrypted data transmission (TLS), hashed passwords, Row Level Security policies on our database, and access controls that limit which employees can access user data. No method of transmission or storage is 100% secure. If you discover a potential security vulnerability, please report it to brogan.smith525@gmail.com.</p>
      </Section>

      <Section title="10. Children&apos;s Privacy">
        <p>Drum Up is not intended for users under the age of 18. We do not knowingly collect personal information from anyone under 18. If we become aware that a minor has created an account, we will delete the account and associated data promptly. Contact us at brogan.smith525@gmail.com if you believe we have collected information from a minor.</p>
      </Section>

      <Section title="11. Changes to This Policy">
        <p>We may update this Privacy Policy as the Service evolves. When we make material changes, we will update the effective date at the top of this page and, where appropriate, notify you by email or via a notice in the app. Your continued use of the Service after changes take effect constitutes acceptance of the revised Policy.</p>
      </Section>

      <Section title="12. Contact Us">
        <p>If you have questions about this Privacy Policy or how we handle your data, please contact us:</p>
        <p className="font-semibold text-graphite">brogan.smith525@gmail.com</p>
      </Section>
    </>
  )
}
