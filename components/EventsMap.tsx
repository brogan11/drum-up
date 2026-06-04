'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker } from 'leaflet'

export interface MapPin {
  id: string
  lat: number
  lon: number
  musicianName: string
  venueName: string
  date: string
}

/**
 * Lazy-loaded Leaflet map of nearby events. Vanilla Leaflet (not react-leaflet)
 * dynamically imported so it stays out of the main bundle and avoids any
 * React-version coupling. Free OpenStreetMap tiles — no API key required.
 *
 * Load this via next/dynamic with `{ ssr: false }` so Leaflet never runs on the
 * server (it touches `window`).
 */
export default function EventsMap({
  pins,
  fanLat,
  fanLon,
  onSelect,
}: {
  pins: MapPin[]
  fanLat: number | null
  fanLon: number | null
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      const center: [number, number] =
        fanLat != null && fanLon != null
          ? [fanLat, fanLon]
          : pins.length > 0
            ? [pins[0].lat, pins[0].lon]
            : [39.9526, -75.1652] // Philadelphia fallback
      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(center, 11)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = []
    }
    // Mount-only: initial center is a best-effort starting point; the marker
    // effect re-fits bounds whenever pins/fan location change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // (Re)draw markers when pins change.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      const map = mapRef.current
      if (cancelled || !map) return

      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      const chestnut = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:50%;background:#DC7F41;border:2.5px solid #FCFAF9;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      })

      const bounds: [number, number][] = []
      pins.forEach(p => {
        const marker = L.marker([p.lat, p.lon], { icon: chestnut })
          .addTo(map)
          .bindPopup(
            `<strong>${escapeHtml(p.musicianName)}</strong><br/>${escapeHtml(p.venueName)}<br/><span style="color:#5E5E5E">${escapeHtml(p.date)}</span>`,
          )
        marker.on('click', () => onSelectRef.current(p.id))
        markersRef.current.push(marker)
        bounds.push([p.lat, p.lon])
      })

      if (fanLat != null && fanLon != null) {
        const me = L.divIcon({
          className: '',
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#6C9A8B;border:2.5px solid #FCFAF9;box-shadow:0 0 0 4px rgba(108,154,139,0.25)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        })
        L.marker([fanLat, fanLon], { icon: me, interactive: false }).addTo(map)
        bounds.push([fanLat, fanLon])
      }

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 12)
      }
    })()
    return () => { cancelled = true }
  }, [pins, fanLat, fanLon])

  return <div ref={containerRef} className="w-full h-[420px] rounded-2xl overflow-hidden shadow-sm z-0" />
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
