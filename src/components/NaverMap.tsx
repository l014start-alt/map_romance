'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { Spot } from '@/types'

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

function makePinIcon(category: string) {
  const color = CATEGORY_COLOR[category] ?? '#800020'
  return L.divIcon({
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="
          width:10px;height:10px;border-radius:50%;
          background:${color};
          box-shadow:0 0 0 4px ${color}28;
        "></div>
        <div style="width:1.5px;height:14px;background:${color};opacity:0.45;margin-top:1px;"></div>
      </div>`,
    className: '',
    iconSize: [10, 26],
    iconAnchor: [5, 26],
  })
}

interface MapProps {
  spots: Spot[]
  center?: [number, number]
  zoom?: number
  onMarkerClick?: (spot: Spot) => void
}

export default function NaverMap({ spots, center, zoom, onMarkerClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      center: center ?? [37.5665, 126.978],
      zoom: zoom ?? 13,
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    L.control.attribution({ prefix: false, position: 'bottomright' })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:#B5B0AB">OpenStreetMap</a>')
      .addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // center/zoom 변경 시 지도 이동
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !center) return
    map.flyTo(center, zoom ?? 13, { duration: 1.2 })
  }, [center, zoom])

  // spots 변경 시 마커 동기화
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    spots.forEach((spot) => {
      if (spot.lat == null || spot.lng == null) return

      const marker = L.marker([spot.lat, spot.lng], {
        icon: makePinIcon(spot.category),
        title: spot.placeName,
      }).addTo(map)

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(spot))
      }

      markersRef.current.push(marker)
    })
  }, [spots, onMarkerClick])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
