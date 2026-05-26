import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) {
    return NextResponse.json({ confirmed: false })
  }

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
    return NextResponse.json({ confirmed: !!user?.email_confirmed_at })
  } catch {
    return NextResponse.json({ confirmed: false })
  }
}
