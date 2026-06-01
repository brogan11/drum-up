'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Avatar } from '@/components/Avatar'
import { useToast } from '@/components/Toast'

const DASHBOARD_BG =
  'radial-gradient(ellipse 50% 40% at 12% 8%, rgba(108,154,139,0.10), transparent 70%), radial-gradient(ellipse 50% 40% at 88% 92%, rgba(220,127,65,0.12), transparent 70%), #E8E4E0'

interface InviteInfo {
  inviter_name: string
  inviter_avatar: string | null
  invitee_name: string | null
  invited_role: 'restaurant' | 'musician'
  status: 'pending' | 'accepted'
}

export default function JoinPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [token, setToken] = useState<string | null>(null)
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(false)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        const t = new URLSearchParams(window.location.search).get('invite')
        if (!t) { setError('This invite link is missing its code.'); setLoading(false); return }
        setToken(t)

        const res = await fetch(`/api/invitations/lookup?token=${encodeURIComponent(t)}`)
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'This invite could not be found.'); setLoading(false); return }
        setInvite(data as InviteInfo)

        const { data: { session } } = await supabase.auth.getSession()
        setLoggedIn(!!session)
        setLoading(false)
      } catch {
        setError('Something went wrong loading this invite.')
        setLoading(false)
      }
    }
    void run()
  }, [])

  const roleLabel = invite?.invited_role === 'restaurant' ? 'a venue' : 'a musician'

  const handleCreateAccount = () => {
    if (!token || !invite) return
    sessionStorage.setItem('drumup_invite_token', token)
    sessionStorage.setItem('drumup_invite_role', invite.invited_role)
    router.push('/auth/signup')
  }

  const handleLogin = () => {
    if (!token || !invite) return
    sessionStorage.setItem('drumup_invite_token', token)
    sessionStorage.setItem('drumup_invite_role', invite.invited_role)
    router.push('/auth/login')
  }

  const handleAccept = async () => {
    if (!token) return
    setAccepting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { handleCreateAccount(); return }
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Could not accept invite')
      }
      sessionStorage.removeItem('drumup_invite_token')
      sessionStorage.removeItem('drumup_invite_role')
      toast.success(`You're connected with ${invite?.inviter_name ?? 'your inviter'}!`)
      router.push('/dashboard')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not accept invite')
      setAccepting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: DASHBOARD_BG }}>
      <div className="bg-white rounded-3xl p-8 shadow-xl text-center max-w-sm w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
          <span className="text-graphite font-black text-lg tracking-tight">Drum Up</span>
        </div>

        {loading ? (
          <div className="py-8">
            <div className="w-10 h-10 border-3 border-chestnut/30 border-t-chestnut rounded-full animate-spin mx-auto" />
          </div>
        ) : error ? (
          <>
            <h1 className="text-graphite text-xl font-black mb-2">Invite unavailable</h1>
            <p className="text-charcoal text-sm mb-6">{error}</p>
            <button onClick={() => router.push('/')} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
              Go to Drum Up
            </button>
          </>
        ) : invite?.status === 'accepted' ? (
          <>
            <h1 className="text-graphite text-xl font-black mb-2">Invite already used</h1>
            <p className="text-charcoal text-sm mb-6">This invitation has already been accepted.</p>
            <button onClick={() => router.push(loggedIn ? '/dashboard' : '/auth/login')} className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
              {loggedIn ? 'Go to dashboard' : 'Log in'}
            </button>
          </>
        ) : (
          <>
            <Avatar src={invite?.inviter_avatar ?? ''} className="w-16 h-16 rounded-2xl mx-auto mb-4" textSize="text-2xl" bg="bg-chestnut/10" />
            <h1 className="text-graphite text-2xl font-black mb-1.5 leading-tight">
              {invite?.inviter_name} invited you to Drum Up
            </h1>
            <p className="text-charcoal text-sm mb-6 leading-relaxed">
              Join free as {roleLabel} to connect, book live music, and get paid — all in one place.
            </p>

            {loggedIn ? (
              <button onClick={handleAccept} disabled={accepting}
                className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                {accepting ? 'Connecting…' : `Connect with ${invite?.inviter_name?.split(' ')[0]}`}
              </button>
            ) : (
              <>
                <button onClick={handleCreateAccount}
                  className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity mb-2">
                  Create your free account
                </button>
                <button onClick={handleLogin}
                  className="w-full bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10">
                  Already a member? Log in
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
