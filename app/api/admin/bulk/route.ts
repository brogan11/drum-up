import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { logAdminAction } from '@/lib/admin-audit'

// Admin-only bulk operations across the moderation tables. Guarded by middleware.
// One endpoint, dispatched on { entity, action, ids }. Returns per-row results so
// the UI can report partial success (e.g. some payouts captured, some skipped).
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

type Body = {
  entity: 'users' | 'reports' | 'reviews' | 'bookings'
  action: string
  ids: string[]
}

const MAX_IDS = 500

export async function POST(request: Request) {
  const supabase = adminClient()
  try {
    const { entity, action, ids } = await request.json() as Body
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 })
    }
    if (ids.length > MAX_IDS) {
      return NextResponse.json({ error: `Too many ids (max ${MAX_IDS})` }, { status: 400 })
    }

    // ---- USERS: ban / unban ----
    if (entity === 'users' && (action === 'ban' || action === 'unban')) {
      const ban = action === 'ban'
      const { error } = await supabase.from('profiles').update({ is_banned: ban }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAdminAction({
        action: `bulk_${action}_users`, target_type: 'user',
        summary: `${ban ? 'Banned' : 'Unbanned'} ${ids.length} user(s) in bulk`, metadata: { count: ids.length, ids },
      })
      return NextResponse.json({ success: true, processed: ids.length, failed: 0 })
    }

    // ---- REPORTS: resolve ----
    if (entity === 'reports' && action === 'resolve') {
      const { error } = await supabase.from('reports').update({ resolved: true }).in('id', ids)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      await logAdminAction({
        action: 'bulk_resolve_reports', target_type: 'report',
        summary: `Resolved ${ids.length} report(s) in bulk`, metadata: { count: ids.length, ids },
      })
      return NextResponse.json({ success: true, processed: ids.length, failed: 0 })
    }

    // ---- REVIEWS: verify / unverify / remove ----
    if (entity === 'reviews' && ['verify', 'unverify', 'remove'].includes(action)) {
      if (action === 'remove') {
        const { error } = await supabase.from('reviews').delete().in('id', ids)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      } else {
        const { error } = await supabase.from('reviews').update({ verified: action === 'verify' }).in('id', ids)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
      await logAdminAction({
        action: `bulk_${action}_reviews`, target_type: 'review',
        summary: `${action === 'remove' ? 'Removed' : action === 'verify' ? 'Verified' : 'Unverified'} ${ids.length} review(s) in bulk`,
        metadata: { count: ids.length, ids },
      })
      return NextResponse.json({ success: true, processed: ids.length, failed: 0 })
    }

    // ---- BOOKINGS: release_payout (per-row Stripe capture) ----
    if (entity === 'bookings' && action === 'release_payout') {
      const { data: rows } = await supabase
        .from('bookings')
        .select('id, payment_status, stripe_payment_intent_id')
        .in('id', ids)

      let processed = 0
      const skipped: string[] = []
      for (const b of rows ?? []) {
        const pi = b.stripe_payment_intent_id as string | null
        if (b.payment_status !== 'authorized' || !pi) { skipped.push(b.id); continue }
        try {
          await stripe.paymentIntents.capture(pi, undefined, { idempotencyKey: `admin_bulk_capture_${b.id}` })
          await supabase.from('bookings')
            .update({ payment_status: 'paid', payout_released: true, payout_released_at: new Date().toISOString() })
            .eq('id', b.id)
          processed++
        } catch (err) {
          console.error('[Admin bulk release] failed for', b.id, err)
          skipped.push(b.id)
        }
      }
      await logAdminAction({
        action: 'bulk_release_payout', target_type: 'booking',
        summary: `Released ${processed} payout(s) in bulk${skipped.length ? `, skipped ${skipped.length}` : ''}`,
        metadata: { processed, skipped },
      })
      return NextResponse.json({ success: true, processed, failed: skipped.length, skipped })
    }

    return NextResponse.json({ error: 'Unsupported entity/action combination' }, { status: 400 })
  } catch (err) {
    console.error('[Admin bulk] error:', err)
    return NextResponse.json({ error: 'Bulk action failed' }, { status: 500 })
  }
}
