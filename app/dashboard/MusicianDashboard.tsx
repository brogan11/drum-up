'use client'

import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function MusicianDashboard() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-snow">
      
      {/* Navbar */}
      <nav className="bg-graphite px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="bg-white rounded-lg p-1">
            <img src="/orange-drum-up.png" alt="Drum Up" className="w-7 h-7 object-contain" />
          </div>
          <h1 className="text-snow text-xl font-black tracking-tight">Drum Up</h1>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-snow opacity-70 text-sm hidden md:inline">Musician Dashboard</span>
          <button onClick={handleLogout} className="text-snow hover:text-chestnut transition-colors text-sm font-medium">
            Log Out
          </button>
        </div>
      </nav>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h2 className="text-graphite text-3xl font-bold mb-2">Welcome back ♪</h2>
          <p className="text-charcoal">Find your next gig and grow your audience.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-charcoal text-sm mb-1">Applications</p>
            <p className="text-chestnut text-3xl font-bold">0</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-charcoal text-sm mb-1">Confirmed Gigs</p>
            <p className="text-teal text-3xl font-bold">0</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-charcoal text-sm mb-1">Profile Views</p>
            <p className="text-graphite text-3xl font-bold">0</p>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <p className="text-charcoal text-sm mb-1">Followers</p>
            <p className="text-graphite text-3xl font-bold">0</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="bg-graphite rounded-2xl p-8 shadow-md">
            <h3 className="text-chestnut text-xl font-bold mb-2">Browse Open Gigs</h3>
            <p className="text-snow opacity-70 text-sm mb-6">Find restaurants looking for live music near you.</p>
            <button className="bg-chestnut text-snow px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">
              Browse Gigs
            </button>
          </div>
          <div className="bg-white rounded-2xl p-8 shadow-sm">
            <h3 className="text-graphite text-xl font-bold mb-2">Edit Your Profile</h3>
            <p className="text-charcoal text-sm mb-6">Add videos, bio, and links to attract venues.</p>
            <button className="bg-teal text-snow px-6 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-md">
              Edit Profile
            </button>
          </div>
        </div>

        {/* Upcoming Gigs */}
        <div className="bg-white rounded-2xl p-8 shadow-sm">
          <h3 className="text-graphite text-xl font-bold mb-4">Upcoming Gigs</h3>
          <p className="text-charcoal text-sm">No gigs booked yet. Browse open availability to apply!</p>
        </div>
      </div>
    </div>
  )
}