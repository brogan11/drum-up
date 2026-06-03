'use client'

import { useState } from 'react'
import Link from 'next/link'
import { IconCalendar, IconUsers, IconCheck, IconSearch, IconSend, IconZap } from './HomeIcons'

const RESTAURANT_STEPS = [
  { num: '01', icon: <IconCalendar />, title: 'Post a slot', desc: 'Pick a date, set your hours, name your pay rate, describe the vibe. Your listing is live in under two minutes.' },
  { num: '02', icon: <IconUsers />, title: 'Review applicants', desc: 'Browse musician profiles, watch their videos, read their pitch. You decide who steps on your stage.' },
  { num: '03', icon: <IconCheck />, title: 'Show night sorted', desc: 'Confirm the booking and Drum Up handles payment after the gig. You focus on your guests.' },
]

const MUSICIAN_STEPS = [
  { num: '01', icon: <IconSearch />, title: 'Browse open gigs', desc: 'Every open slot near you, filtered by date, distance, genre, and pay. No cold emails, no middlemen.' },
  { num: '02', icon: <IconSend />, title: 'Send your pitch', desc: 'Your profile is your resume. Link your best clips and reach out directly to the booker.' },
  { num: '03', icon: <IconZap />, title: 'Get paid automatically', desc: 'After the gig, funds land in your account through Stripe. No invoices, no chasing, no cash-app awkwardness.' },
]

const cta =
  'inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-snow transition-colors group ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut'

export function HowItWorksTabs() {
  const [tab, setTab] = useState<'restaurant' | 'musician'>('restaurant')
  const isRestaurant = tab === 'restaurant'
  const steps = isRestaurant ? RESTAURANT_STEPS : MUSICIAN_STEPS

  return (
    <>
      {/* Pill switcher */}
      <div className="inline-flex bg-graphite/10 rounded-full p-1.5 gap-1" role="tablist" aria-label="How it works for">
        <button
          role="tab" aria-selected={isRestaurant} id="tab-restaurant" aria-controls="howpanel"
          onClick={() => setTab('restaurant')}
          className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-graphite ${
            isRestaurant ? 'bg-graphite text-snow shadow-md' : 'text-charcoal hover:text-graphite'
          }`}
        >
          For Restaurants
        </button>
        <button
          role="tab" aria-selected={!isRestaurant} id="tab-musician" aria-controls="howpanel"
          onClick={() => setTab('musician')}
          className={`px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chestnut ${
            !isRestaurant ? 'bg-chestnut text-snow shadow-md' : 'text-charcoal hover:text-graphite'
          }`}
        >
          For Musicians
        </button>
      </div>

      {/* Single panel that swaps content — only the active steps are in the DOM,
          so keyboard users never tab into a hidden link. */}
      <div id="howpanel" role="tabpanel" aria-labelledby={isRestaurant ? 'tab-restaurant' : 'tab-musician'} className="mt-14">
        <div key={tab} className="animate-fade-in">
          <div className="grid md:grid-cols-3 gap-10 md:gap-14 text-left">
            {steps.map((step) => (
              <div key={step.num} className="flex flex-col gap-4">
                <div className="flex items-center gap-4 mb-1">
                  <span className="text-graphite/15 font-black text-6xl leading-none tabular-nums">{step.num}</span>
                  <div className="text-chestnut">{step.icon}</div>
                </div>
                <h3 className="text-graphite text-xl font-black">{step.title}</h3>
                <p className="text-charcoal text-base leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex justify-center">
            {isRestaurant ? (
              <Link href="/auth/signup?type=restaurant" className={`${cta} bg-graphite hover:bg-graphite/80`}>
                Post your first slot
                <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            ) : (
              <Link href="/auth/signup?type=musician" className={`${cta} bg-chestnut hover:opacity-90`}>
                Find gigs near you
                <span aria-hidden="true" className="group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
