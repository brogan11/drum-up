import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function GET() {
  const supabase = adminClient()

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('id, reviewer_id, reviewee_id, rating, review_text, verified, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!reviews?.length) return NextResponse.json({ reviews: [] })

  const ids = [...new Set(reviews.flatMap(r => [r.reviewer_id, r.reviewee_id]).filter(Boolean))]
  const { data: profiles } = await supabase.from('profiles').select('id, username, full_name').in('id', ids)
  const pMap = new Map((profiles ?? []).map(p => [p.id, p]))

  const enriched = reviews.map(r => ({
    id: r.id,
    rating: r.rating,
    review_text: r.review_text,
    verified: r.verified ?? false,
    created_at: r.created_at,
    reviewer_name: pMap.get(r.reviewer_id)?.full_name ?? '—',
    reviewer_username: pMap.get(r.reviewer_id)?.username ?? '',
    reviewee_name: pMap.get(r.reviewee_id)?.full_name ?? '—',
    reviewee_username: pMap.get(r.reviewee_id)?.username ?? '',
  }))

  return NextResponse.json({ reviews: enriched })
}

export async function POST(request: Request) {
  const supabase = adminClient()
  try {
    const { reviewId, action } = await request.json() as {
      reviewId: string
      action: 'remove' | 'verify' | 'unverify'
    }
    if (!reviewId || !['remove', 'verify', 'unverify'].includes(action)) {
      return NextResponse.json({ error: 'reviewId and a valid action are required' }, { status: 400 })
    }

    if (action === 'remove') {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('reviews').update({ verified: action === 'verify' }).eq('id', reviewId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
