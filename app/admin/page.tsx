import { redirect } from 'next/navigation'

// Bare /admin has no content of its own — send it to the dashboard, which the
// middleware will bounce to /admin/login if there's no valid admin session.
export default function AdminIndex() {
  redirect('/admin/dashboard')
}
