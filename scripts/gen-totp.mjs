// One-time setup: generate a TOTP secret for admin 2FA.
//
//   node scripts/gen-totp.mjs
//
// Then:
//   1. Add the printed ADMIN_TOTP_SECRET to .env.local (and your Vercel env vars).
//   2. In Google Authenticator / Authy / 1Password, add an account by MANUAL KEY
//      and paste the secret (or scan the otpauth URL below as a QR).
//   3. Redeploy. The admin login will now require the 6-digit code.
//
// Keep the secret private — anyone with it can generate your codes.

import crypto from 'crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function toBase32(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

const secret = toBase32(crypto.randomBytes(20)) // 160-bit secret
const label = encodeURIComponent('Drum Up Admin')
const issuer = encodeURIComponent('Drum Up')
const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`

console.log('\n=== Drum Up admin 2FA ===\n')
console.log('Add this to .env.local (and Vercel):\n')
console.log(`ADMIN_TOTP_SECRET=${secret}\n`)
console.log('Authenticator manual-entry key:  ' + secret)
console.log('Or scan this otpauth URL as a QR:\n')
console.log(uri + '\n')
