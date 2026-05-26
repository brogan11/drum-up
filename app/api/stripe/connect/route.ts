import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
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
      .select('stripe_account_id, full_name, legal_name, performer_type')
      .eq('id', user.id)
      .maybeSingle()

    let accountId = profile?.stripe_account_id as string | null

    // Verify the saved account actually exists on this Stripe platform
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId)
      } catch (e: any) {
        if (e?.code === 'account_invalid' || e?.statusCode === 404) {
          console.warn('[Stripe Connect] Stored account ID is invalid, clearing:', accountId)
          accountId = null
          await supabaseAdmin
            .from('profiles')
            .update({ stripe_account_id: null })
            .eq('id', user.id)
        } else {
          throw e
        }
      }
    }

    if (!accountId) {
      const nameForStripe = (profile?.legal_name?.trim() || profile?.full_name?.trim()) ?? ''
      const nameParts = nameForStripe.split(' ').filter((p: string) => p.length > 0)
      const firstName = nameParts[0] ?? ''
      const lastName = nameParts.slice(1).join(' ')

      console.log('[Stripe Connect] Pre-filling legal name:', {
        performerType: profile?.performer_type,
        stageName: profile?.full_name,
        legalName: profile?.legal_name,
        firstName,
        lastName,
      })

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        business_type: 'individual',
        individual: {
          email: user.email,
          first_name: firstName,
          last_name: lastName,
        },
        capabilities: {
          transfers: { requested: true },
        },
        business_profile: {
          mcc: '7929',
          url: 'https://drum-up.app',
          product_description: 'Live music performance services',
        },
        settings: {
          payouts: {
            schedule: {
              interval: 'manual',
            },
          },
        },
      })
      accountId = account.id

      await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id)
    }

    const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://drum-up.app'

    console.log('[Stripe Connect] Creating account link with:', {
      appUrl,
      returnUrl: `${appUrl}/dashboard?stripe=success`,
      refreshUrl: `${appUrl}/dashboard?stripe=refresh`,
    })

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard?stripe=refresh`,
      return_url: `${appUrl}/dashboard?stripe=success`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err) {
    console.error('Stripe connect error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}