// Platform fee logic. The default take rate is 8%, but an admin can set a
// per-user override (with an optional expiry) — see migration 2026_06_04.

export const DEFAULT_FEE_PCT = 8

export interface FeeProfile {
  platform_fee_pct: number | null
  fee_waiver_until: string | null
}

// A single user's active fee percent (0–100), honoring expiry.
export function activeFeePct(p: FeeProfile | null | undefined): number {
  if (!p || p.platform_fee_pct == null) return DEFAULT_FEE_PCT
  if (p.fee_waiver_until && new Date(p.fee_waiver_until).getTime() < Date.now()) {
    return DEFAULT_FEE_PCT // override expired
  }
  return p.platform_fee_pct
}

// Effective fee for a booking = the lower of the two parties' active rates, so a
// waiver granted to EITHER the musician or the restaurant takes effect.
export function effectiveFeePct(
  musician: FeeProfile | null | undefined,
  restaurant: FeeProfile | null | undefined,
): number {
  return Math.min(activeFeePct(musician), activeFeePct(restaurant))
}

// Fee in cents for a given total (cents) and the two parties.
export function feeCents(
  totalCents: number,
  musician: FeeProfile | null | undefined,
  restaurant: FeeProfile | null | undefined,
): number {
  const pct = effectiveFeePct(musician, restaurant)
  return Math.round(totalCents * (pct / 100))
}

// ── Per-booking helpers (use the fee actually persisted on the booking) ──────
// For a confirmed/paid booking the real fee is stored in bookings.platform_fee
// (0 when waived). Fall back to the default 8% for legacy rows where it's null.

export function bookingFee(grossPay: number, platformFee: number | null | undefined): number {
  if (platformFee != null) return Number(platformFee)
  return Math.round(grossPay * (DEFAULT_FEE_PCT / 100) * 100) / 100
}

// What the musician nets after the platform fee.
export function musicianNet(grossPay: number, platformFee: number | null | undefined): number {
  return Math.round((grossPay - bookingFee(grossPay, platformFee)) * 100) / 100
}

// ── Stripe processing-fee estimate (US standard: 2.9% + $0.30 per charge) ────
// We run destination charges, so Stripe's fee comes out of the PLATFORM balance,
// not the musician's. This estimates it so reporting can show net-of-Stripe.
export const STRIPE_PCT = 0.029
export const STRIPE_FIXED = 0.30

export function estimateStripeFee(grossPay: number): number {
  if (grossPay <= 0) return 0
  return Math.round((grossPay * STRIPE_PCT + STRIPE_FIXED) * 100) / 100
}
