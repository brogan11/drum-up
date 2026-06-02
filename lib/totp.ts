import crypto from 'crypto'

// Minimal RFC 6238 TOTP (time-based one-time password), dependency-free so it
// runs in the Node route handler with no extra packages. Compatible with Google
// Authenticator / Authy / 1Password (SHA-1, 30s step, 6 digits).

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of input.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()) {
    const idx = alphabet.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function generate(secretB32: string, atMs: number, step = 30, digits = 6): string {
  const key = base32Decode(secretB32)
  let counter = Math.floor(atMs / 1000 / step)
  const buf = Buffer.alloc(8)
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff
    counter = Math.floor(counter / 256)
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (code % 10 ** digits).toString().padStart(digits, '0')
}

// Verify a token, allowing ±1 time step (~30s) for clock skew. Constant-time.
export function verifyTotp(token: string, secretB32: string): boolean {
  if (!token || !secretB32) return false
  const clean = token.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return false
  const now = Date.now()
  for (const drift of [-1, 0, 1]) {
    const expected = generate(secretB32, now + drift * 30000)
    const a = Buffer.from(expected)
    const b = Buffer.from(clean)
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true
  }
  return false
}
