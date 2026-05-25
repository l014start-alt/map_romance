'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { LocationGroup } from '@/types'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CATEGORY_COLOR: Record<string, string> = {
  낭만: '#800020',
  젊음: '#2A6040',
  사랑: '#C0392B',
}

function makePinIcon(category: string, count: number) {
  const color = CATEGORY_COLOR[category] ?? '#800020'
  const badge = count > 1
    ? `<div class="pin-badge" style="position:absolute;top:-10px;left:6px;min-width:18px;height:18px;border-radius:10px;background:${color};border:2px solid #FAF8F5;color:#FAF8F5;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 2px 6px rgba(0,0,0,0.22);line-height:1;">${count}</div>`
    : ''
  return L.divIcon({
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        ${badge}
        <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}28;"></div>
        <div style="width:1.5px;height:14px;background:${color};opacity:0.45;margin-top:1px;"></div>
      </div>`,
    className: '',
    iconSize: [10, 26],
    iconAnchor: [5, 26],
  })
}

function makeTempPinIcon() {
  return L.divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div class="temp-pin-ring" style="position:absolute;width:24px;height:24px;border-radius:50%;background:#800020;"></div>
        <div style="position:relative;width:12px;height:12px;border-radius:50%;background:#800020;border:2px solid #FAF8F5;box-shadow:0 2px 8px rgba(128,0,32,0.5);"></div>
      </div>`,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

interface MapProps {
  groups: LocationGroup[]
  center?: [number, number]
  zoom?: number
  onGroupClick?: (group: LocationGroup) => void
  tempPin?: { lat: number; lng: number } | null
  onMapClick?: (lat: number, lng: number) => void
}

export default function NaverMap({ groups, center, zoom, onGroupClick, tempPin, onMapClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const tempMarkerRef = useRef<L.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)

  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: center ?? [37.5665, 126.978],
      zoom: zoom ?? 13,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:#B5B0AB">OpenStreetMap</a>')
      .addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng)
    })

    mapInstanceRef.current = map
    return () => { map.remove(); mapInstanceRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !center) return
    map.flyTo(center, zoom ?? 13, { duration: 1.2 })
  }, [center, zoom])

  // 그룹 마커 동기화
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    groups.forEach((group) => {
      if (group.lat == null || group.lng == null) return
      const primaryCategory = group.spots[0]?.category ?? '낭만'
      const marker = L.marker([group.lat, group.lng], {
        icon: makePinIcon(primaryCategory, group.spots.length),
        title: group.placeName,
      }).addTo(map)
      if (onGroupClick) marker.on('click', () => onGroupClick(group))
      markersRef.current.push(marker)
    })
  }, [groups, onGroupClick])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove()
      tempMarkerRef.current = null
    }

    if (tempPin) {
      const marker = L.marker([tempPin.lat, tempPin.lng], {
        icon: makeTempPinIcon(),
        zIndexOffset: 1000,
      }).addTo(map)
      tempMarkerRef.current = marker
      map.flyTo([tempPin.lat, tempPin.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
    }
  }, [tempPin])

  useEffect(() => {
    const container = mapRef.current
    if (!container) return
    container.style.cursor = onMapClick ? 'crosshair' : ''
  }, [onMapClick])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
