'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global Error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#333333', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '24px', maxWidth: '320px' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(220,127,65,0.15)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC7F41" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <h1 style={{ color: '#FCFAF9', fontSize: '1.5rem', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.02em' }}>
            We hit a sour note.
          </h1>
          <p style={{ color: 'rgba(252,250,249,0.6)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Something went wrong at the app level. Please refresh the page or try again.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{ background: '#DC7F41', color: '#FCFAF9', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Try Again
            </button>
            <a
              href="/"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#FCFAF9', padding: '10px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}
            >
              Go Home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
