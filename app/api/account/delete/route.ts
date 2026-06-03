import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Self-service account deletion (right to erasure). The signed-in user deletes
// their OWN account — identity is proven by their Supabase access token, never
// by a userId in the body (which would let anyone delete anyone).
//
// Compliance (see Privacy Policy §6/§7):
//  • Personal data + personal content (profile fields, messages, follows, saved
//    items, reviews they wrote, notifications, availability, profile views) are
//    erased immediately.
//  • Booking & payment rows must be retained for up to 7 years for tax/accounting.
//    If the user has any, we keep those rows and ANONYMIZE the profile in place
//    (it is FK-referenced by bookings) and permanently ban the login.
//  • If the user has NO financial history, nothing must be retained, so we hard
//    delete the profile and the auth user outright.

// Best-effort delete: never let one table's failure abort the whole erasure.
async function tryDelete(label: string, run: () => PromiseLike<{ error: unknown }>) {
  try {
    const { error } = await run()
    if (error) console.error(`[account/delete] ${label} failed:`, error)
  } catch (err) {
    console.error(`[account/delete] ${label} threw:`, err)
  }
}

export async function POST(request: Request) {
  // 1. Authenticate from the bearer token.
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  const uid = userData?.user?.id
  if (userErr || !uid) return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })

  const db = supabaseAdmin

  try {
    // 2. Does the user have booking/payment history we must retain?
    const { data: bookingRows } = await db
      .from('bookings')
      .select('id')
      .or(`restaurant_id.eq.${uid},musician_id.eq.${uid}`)
      .limit(1)
    const hasFinancialHistory = (bookingRows?.length ?? 0) > 0

    // 3. Erase personal content shared by both paths.
    await tryDelete('message_reactions', () => db.from('message_reactions').delete().eq('user_id', uid))
    await tryDelete('messages', () => db.from('messages').delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`))
    await tryDelete('follows', () => db.from('follows').delete().or(`follower_id.eq.${uid},following_id.eq.${uid}`))
    await tryDelete('notifications', () => db.from('notifications').delete().eq('user_id', uid))
    await tryDelete('profile_views', () => db.from('profile_views').delete().or(`profile_id.eq.${uid},viewer_id.eq.${uid}`))
    await tryDelete('saved_items', () => db.from('saved_items').delete().eq('user_id', uid))
    await tryDelete('musician_availability', () => db.from('musician_availability').delete().eq('musician_id', uid))
    await tryDelete('invitations', () => db.from('invitations').delete().eq('inviter_id', uid))
    // Reviews the user authored are their personal content → always removed.
    await tryDelete('reviews(authored)', () => db.from('reviews').delete().eq('reviewer_id', uid))

    // Remove uploaded avatar/banner files (stored under `${uid}/...`).
    try {
      const { data: files } = await db.storage.from('avatars').list(uid)
      if (files?.length) {
        await db.storage.from('avatars').remove(files.map(f => `${uid}/${f.name}`))
      }
    } catch (err) {
      console.error('[account/delete] storage cleanup failed:', err)
    }

    if (hasFinancialHistory) {
      // ---- Retain path: keep bookings, anonymize everything personal. ----
      // Delete only availability slots NOT referenced by a retained booking.
      const { data: keptAvail } = await db.from('bookings')
        .select('availability_id')
        .or(`restaurant_id.eq.${uid},musician_id.eq.${uid}`)
      const keepIds = [...new Set((keptAvail ?? []).map(b => b.availability_id).filter(Boolean))] as string[]
      await tryDelete('availability(open)', () => {
        let q = db.from('availability').delete().eq('restaurant_id', uid)
        if (keepIds.length) q = q.not('id', 'in', `(${keepIds.join(',')})`)
        return q
      })

      // Scrub all personal fields from the profile and flag it deleted.
      await tryDelete('profiles(anonymize)', () => db.from('profiles').update({
        username: null,
        full_name: 'Deleted user',
        avatar_url: null,
        bio: null,
        location_text: null,
        latitude: null,
        longitude: null,
        instagram_url: null,
        tiktok_url: null,
        spotify_url: null,
        youtube_url: null,
        website: null,
        legal_name: null,
        role_metadata: {},
        notify_gig_alerts: false,
        is_banned: true,
        deleted_at: new Date().toISOString(),
      }).eq('id', uid))

      // Permanently disable the login but keep the auth row (bookings FK the
      // profile, which FKs auth.users). Also strip the email (PII) where possible.
      try {
        await supabaseAdmin.auth.admin.updateUserById(uid, {
          ban_duration: '876600h', // ~100 years
          email: `deleted+${uid}@deleted.invalid`,
          user_metadata: {},
        })
      } catch (err) {
        console.error('[account/delete] auth ban/scrub failed:', err)
      }

      return NextResponse.json({ success: true, mode: 'anonymized' })
    }

    // ---- Hard-delete path: no financial history, erase everything. ----
    await tryDelete('reviews(about)', () => db.from('reviews').delete().eq('reviewee_id', uid))
    await tryDelete('availability(all)', () => db.from('availability').delete().eq('restaurant_id', uid))
    await tryDelete('profiles(delete)', () => db.from('profiles').delete().eq('id', uid))

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (delErr) {
      // Could not remove the auth user — fall back to anonymize so the account
      // is still unusable and personal data is gone.
      console.error('[account/delete] auth.deleteUser failed, anonymizing instead:', delErr)
      await tryDelete('profiles(anonymize-fallback)', () => db.from('profiles').upsert({
        id: uid, username: null, full_name: 'Deleted user', is_banned: true, deleted_at: new Date().toISOString(),
      }))
      try {
        await supabaseAdmin.auth.admin.updateUserById(uid, { ban_duration: '876600h', user_metadata: {} })
      } catch { /* noop */ }
      return NextResponse.json({ success: true, mode: 'anonymized' })
    }

    return NextResponse.json({ success: true, mode: 'deleted' })
  } catch (err) {
    console.error('[account/delete] fatal error:', err)
    return NextResponse.json({ error: 'Failed to delete account. Please contact support.' }, { status: 500 })
  }
}
