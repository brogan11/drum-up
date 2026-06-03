'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import Modal from '@/components/Modal'

interface Props {
  // The role the invitee will join as. A musician invites venues; a venue invites musicians.
  invitedRole: 'restaurant' | 'musician'
  onClose: () => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InvitePeopleModal({ invitedRole, onClose }: Props) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const noun = invitedRole === 'restaurant' ? 'venue' : 'musician'

  const handleSubmit = async () => {
    setError('')
    if (!EMAIL_RE.test(email.trim())) { setError('Please enter a valid email address.'); return }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch('/api/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          invitee_name: name.trim() || undefined,
          invitee_email: email.trim(),
          invited_role: invitedRole,
        }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send invite')

      toast.success(`Invite sent to ${email.trim()}!`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="invite-people-title">
        {/* Header */}
        <div className="bg-graphite rounded-t-3xl px-6 py-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-chestnut opacity-20 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <p className="text-chestnut text-[10px] font-semibold uppercase tracking-[0.3em]">Grow your network</p>
            <h3 id="invite-people-title" className="text-snow text-xl font-black tracking-tight">
              Invite a <span className="text-chestnut italic">{noun}.</span>
            </h3>
          </div>
          <button onClick={onClose} className="relative z-10 text-snow/60 hover:text-snow transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <p className="text-charcoal text-sm mb-5 leading-relaxed">
            Already work with a {noun}? Invite them by email. When they join, you’ll be connected
            automatically — no off-platform back-and-forth.
          </p>

          <div className="space-y-4 mb-4">
            <div>
              <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Their name <span className="font-normal normal-case text-charcoal/50">(optional)</span>
              </label>
              <input
                type="text"
                placeholder={`e.g. ${invitedRole === 'restaurant' ? 'The Blue Note' : 'Sarah Rivers'}`}
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm border border-charcoal/10 focus:outline-none focus:ring-2 focus:ring-chestnut/20"
              />
            </div>
            <div>
              <label className="text-charcoal text-xs font-semibold uppercase tracking-wide block mb-1.5">Their email</label>
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white rounded-xl px-4 py-3 text-sm shadow-sm border border-charcoal/10 focus:outline-none focus:ring-2 focus:ring-chestnut/20"
              />
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-chestnut text-snow py-3.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mb-2"
          >
            {submitting
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending…
                </span>
              : 'Send invite'}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full bg-white text-charcoal py-3 rounded-xl text-sm font-medium hover:bg-[#E8E4E0] transition-colors border border-charcoal/10 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
    </Modal>
  )
}
