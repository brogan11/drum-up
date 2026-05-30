// Derives the admin session-cookie value from the admin password. We store this hash in
// the cookie instead of the raw password, so a leaked cookie never exposes the actual
// ADMIN_PASSWORD. Uses Web Crypto so it runs in both the edge middleware and route
// handlers. Knowing the hash is still sufficient to act as admin (it IS the bearer),
// but it can no longer be replayed as the password elsewhere.
export async function adminCookieValue(password: string): Promise<string> {
  const data = new TextEncoder().encode(`drumup-admin-session:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
