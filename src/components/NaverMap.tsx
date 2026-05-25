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
        <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}28;"></div>
        <div style="width:1.5px;height:14px;background:${color};opacity:0.45;margin-top:1px;"></div>
      </div>`,
    className: '',
    iconSize: [10, 26],
    iconAnchor: [5, 26],
  })
}

// 임시 핀: 펄스 애니메이션 + 큰 원
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
  spots: Spot[]
  center?: [number, number]
  zoom?: number
  onMarkerClick?: (spot: Spot) => void
  tempPin?: { lat: number; lng: number } | null
  onMapClick?: (lat: number, lng: number) => void
}

export default function NaverMap({ spots, center, zoom, onMarkerClick, tempPin, onMapClick }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const tempMarkerRef = useRef<L.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)

  // 클릭 핸들러 ref 최신화 (클로저 문제 방지)
  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])

  // 지도 초기화
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

    // 지도 클릭 → onMapClick 호출
    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng)
    })

    mapInstanceRef.current = map
    return () => { map.remove(); mapInstanceRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // center/zoom 변경 시 지도 이동
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !center) return
    map.flyTo(center, zoom ?? 13, { duration: 1.2 })
  }, [center, zoom])

  // 스팟 마커 동기화
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
      if (onMarkerClick) marker.on('click', () => onMarkerClick(spot))
      markersRef.current.push(marker)
    })
  }, [spots, onMarkerClick])

  // 임시 핀 동기화
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // 기존 임시 핀 제거
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
      // 부드럽게 해당 좌표로 이동 (현재 줌이 낮으면 올려줌)
      map.flyTo([tempPin.lat, tempPin.lng], Math.max(map.getZoom(), 15), { duration: 0.8 })
    }
  }, [tempPin])

  // 픽 모드일 때 커서 변경
  useEffect(() => {
    const container = mapRef.current
    if (!container) return
    container.style.cursor = onMapClick ? 'crosshair' : ''
  }, [onMapClick])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
