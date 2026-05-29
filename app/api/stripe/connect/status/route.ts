import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    const authHeader = request.headers.get('authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .maybeSingle()

    const accountId = profile?.stripe_account_id as string | null
    if (!accountId) {
      // No Stripe account on file (never connected, or it was deleted). Make sure
      // the cached flag reflects that so the UI prompts re-onboarding.
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_onboarded: false })
        .eq('id', user.id)
      return NextResponse.json({ onboarded: false })
    }

    let account: Awaited<ReturnType<typeof stripe.accounts.retrieve>>
    try {
      account = await stripe.accounts.retrieve(accountId)
    } catch (e: unknown) {
      // The stored account ID no longer exists on Stripe — clear it and reset the
      // flag so the musician is sent back through onboarding.
      const code = (e as { code?: string; statusCode?: number }).code
      const statusCode = (e as { code?: string; statusCode?: number }).statusCode
      if (code === 'account_invalid' || statusCode === 404) {
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_account_id: null, stripe_onboarded: false })
          .eq('id', user.id)
        return NextResponse.json({ onboarded: false })
      }
      throw e
    }
    const onboarded =
      account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true

    console.log('[Stripe Connect] Account status:', {
      accountId: account.id,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      onboarded,
    })

    await supabaseAdmin
      .from('profiles')
      .update({ stripe_onboarded: onboarded })
      .eq('id', user.id)

    return NextResponse.json({ onboarded })
  } catch (err) {
    console.error('Stripe connect status error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
