import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Drum Up',
  description: 'Read the Drum Up Terms of Service.',
}

export default function TermsPage() {
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
          <h1 className="text-snow text-4xl md:text-5xl font-black tracking-tight mb-4">Terms of Service</h1>
          <p className="text-charcoal text-sm">Effective: May 26, 2026</p>
        </div>
      </div>

      {/* CONTENT */}
      <main className="flex-1 px-6 md:px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="prose-legal">

            <Section title="1. Acceptance of Terms">
              <p>By accessing or using Drum Up (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service. These Terms apply to all users, including restaurants, musicians, fans, and visitors.</p>
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
              <p>To access most features you must create an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at support@drumup.app if you suspect unauthorized access.</p>
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
                  <li>All payments to musicians must flow through Drum Up's payment system. Off-platform payments to avoid booking fees are a violation of these Terms.</li>
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
              <p>When a restaurant confirms a musician application, a booking is created. All payment for confirmed bookings must be processed through Drum Up's integrated payment system (powered by Stripe Connect).</p>

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
                <p>If a musician cancels a confirmed booking with more than 48 hours' notice before the performance, the booking is voided and the restaurant receives a full refund of the gig pay with no platform fee retained. If a musician cancels within 48 hours of the scheduled performance, their account will be automatically suspended pending review. Repeated late cancellations may result in permanent removal from the platform.</p>
              </Subsection>

              <Subsection title="Disputes">
                <p>If a dispute arises between a restaurant and a musician regarding a booking, both parties should contact support@drumup.app. Drum Up will make good-faith efforts to mediate but is not obligated to do so. All payment decisions made by Drum Up in connection with a dispute are final.</p>
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
              <p>The Service is provided "as is" and "as available" without warranties of any kind, express or implied. Drum Up does not warrant that the Service will be uninterrupted, error-free, or free of harmful components. We do not endorse any musician, restaurant, or other user, and we make no representations about the quality, safety, or legality of any listing or performance.</p>
            </Section>

            <Section title="14. Limitation of Liability">
              <p>To the fullest extent permitted by applicable law, Drum Up and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service, even if Drum Up has been advised of the possibility of such damages.</p>
              <p>Drum Up's total liability to you for any claim arising out of these Terms or the Service shall not exceed the greater of: (a) the amount you paid to Drum Up in the 12 months preceding the claim, or (b) one hundred dollars ($100 USD).</p>
            </Section>

            <Section title="15. Indemnification">
              <p>You agree to indemnify, defend, and hold harmless Drum Up and its affiliates from any claims, losses, liabilities, damages, costs, or expenses (including reasonable attorneys' fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights; or (d) any content you submit to the Service.</p>
            </Section>

            <Section title="16. Governing Law">
              <p>These Terms are governed by the laws of the Commonwealth of Pennsylvania, without regard to its conflict of law principles. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in Philadelphia, Pennsylvania, and you consent to personal jurisdiction in those courts.</p>
            </Section>

            <Section title="17. Termination">
              <p>We reserve the right to suspend or terminate your account at any time, with or without notice, for violations of these Terms or for any other reason at our sole discretion. You may delete your account at any time from your account settings. Upon termination, your right to use the Service ceases immediately, though these Terms will otherwise survive termination to the extent applicable.</p>
            </Section>

            <Section title="18. Contact Us">
              <p>Questions about these Terms? Reach us at:</p>
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
      <div className="space-y-3 text-charcoal text-[15px] leading-relaxed [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:marker:text-chestnut [&_p]:text-charcoal">
        {children}
      </div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-graphite text-[15px] font-black mb-2">{title}</h3>
      <div className="space-y-2 [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:marker:text-chestnut">
        {children}
      </div>
    </div>
  )
}
