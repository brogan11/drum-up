import { createClient } from '@supabase/supabase-js'

// Fire-and-forget audit logger for the admin panel. Writes one row to
// `admin_actions` (see migration 2026_06_05_admin_audit.sql). Self-contained:
// it makes its own service-role client so callers don't have to thread one in.
//
// NEVER throws — auditing must not break the action it's recording. Await it if
// you want the row written before responding, or leave it dangling; either is safe.

export interface AdminActionEntry {
  action: string
  target_type?: 'user' | 'booking' | 'review' | 'report' | 'email' | string
  target_id?: string | null
  summary?: string
  metadata?: Record<string, unknown>
}

export async function logAdminAction(entry: AdminActionEntry): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    await supabase.from('admin_actions').insert({
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      summary: entry.summary ?? null,
      metadata: entry.metadata ?? null,
    })
  } catch (err) {
    console.error('[admin-audit] failed to log action:', entry.action, err)
  }
}
