'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import RestaurantDashboard from './RestaurantDashboard'
import MusicianDashboard from './MusicianDashboard'
import FanDashboard from './FanDashboard'

export default function DashboardPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr) {
          if (authErr.name === 'AuthSessionMissingError') {
            router.push('/auth/login')
            return
          }
          throw authErr
        }

        if (!user) {
          router.push('/auth/login')
          return
        }

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, user_type')
          .eq('id', user.id)
          .maybeSingle()

        if (profileErr) throw profileErr

        if (!profile) {
          router.push('/onboarding')
          return
        }

        setUserType(profile.user_type || user.user_metadata?.user_type || 'fan')
      } catch (err) {
        console.error('Dashboard auth check failed:', err)
        setError('Failed to load your dashboard. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }
    checkUser()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-snow flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-chestnut border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-snow flex flex-col items-center justify-center px-6 text-center">
        <div className="w-14 h-14 bg-chestnut/10 rounded-2xl flex items-center justify-center text-2xl mb-4">🎵</div>
        <p className="text-graphite font-bold text-lg mb-1">Something went wrong</p>
        <p className="text-charcoal text-sm mb-6">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-chestnut text-snow px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
      </div>
    )
  }

  if (userType === 'restaurant') return <RestaurantDashboard />
  if (userType === 'musician') return <MusicianDashboard />
  return <FanDashboard />
}
