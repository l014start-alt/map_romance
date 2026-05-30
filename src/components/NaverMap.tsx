'use client'

import { useEffect, useRef } from 'react'
import { LocationGroup } from '@/types'

const CATEGORY_COLOR: Record<string, string> = {
  낭만: '#800020',
  젊음: '#2A6040',
  사랑: '#C0392B',
}

function makePinHTML(category: string, count: number) {
  const color = CATEGORY_COLOR[category] ?? '#800020'
  const badge = count > 1
    ? `<div style="position:absolute;top:-10px;left:6px;min-width:18px;height:18px;border-radius:10px;background:${color};border:2px solid #FAF8F5;color:#FAF8F5;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 2px 6px rgba(0,0,0,0.22);line-height:1;">${count}</div>`
    : ''
  return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
    ${badge}
    <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}28;"></div>
    <div style="width:1.5px;height:14px;background:${color};opacity:0.45;margin-top:1px;"></div>
  </div>`
}

function makeTempPinHTML() {
  return `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:#80002033;animation:ping 1s cubic-bezier(0,0,0.2,1) infinite;"></div>
    <div style="position:relative;width:12px;height:12px;border-radius:50%;background:#800020;border:2px solid #FAF8F5;box-shadow:0 2px 8px rgba(128,0,32,0.5);"></div>
  </div>`
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
  const mapInstanceRef = useRef<naver.maps.Map | null>(null)
  const markersRef = useRef<naver.maps.Marker[]>([])
  const tempMarkerRef = useRef<naver.maps.Marker | null>(null)
  const clickListenerRef = useRef<unknown>(null)
  const onMapClickRef = useRef(onMapClick)
  const onGroupClickRef = useRef(onGroupClick)

  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onGroupClickRef.current = onGroupClick }, [onGroupClick])

  // 지도 초기화
  useEffect(() => {
    if (!mapRef.current) return

    const init = () => {
      if (mapInstanceRef.current) return
      const [lat, lng] = center ?? [35.8714, 128.6014] // 대구 중심
      const map = new naver.maps.Map(mapRef.current!, {
        center: new naver.maps.LatLng(lat, lng),
        zoom: zoom ?? 13,
        mapDataControl: false,
        logoControl: false,
        scaleControl: false,
        zoomControl: false,
      })

      clickListenerRef.current = naver.maps.Event.addListener(map, 'click', (e: unknown) => {
        const coord = (e as { coord: naver.maps.LatLng }).coord
        onMapClickRef.current?.(coord.lat(), coord.lng())
      })

      mapInstanceRef.current = map
    }

    if (typeof window !== 'undefined' && window.naver?.maps) {
      init()
    } else {
      const interval = setInterval(() => {
        if (window.naver?.maps) { clearInterval(interval); init() }
      }, 100)
      return () => clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 중심 이동
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !center) return
    map.setCenter(new naver.maps.LatLng(center[0], center[1]))
    if (zoom) map.setZoom(zoom, true)
  }, [center, zoom])

  // 그룹 마커 동기화
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    groups.forEach((group) => {
      if (group.lat == null || group.lng == null) return
      const primaryCategory = group.spots[0]?.category ?? '낭만'
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(group.lat, group.lng),
        map,
        icon: {
          content: makePinHTML(primaryCategory, group.spots.length),
          anchor: new naver.maps.Point(5, 26),
        },
        title: group.placeName,
      })
      naver.maps.Event.addListener(marker, 'click', () => onGroupClickRef.current?.(group))
      markersRef.current.push(marker)
    })
  }, [groups])

  // 임시 핀
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (tempMarkerRef.current) {
      tempMarkerRef.current.setMap(null)
      tempMarkerRef.current = null
    }

    if (tempPin) {
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(tempPin.lat, tempPin.lng),
        map,
        icon: {
          content: makeTempPinHTML(),
          anchor: new naver.maps.Point(12, 12),
        },
      })
      tempMarkerRef.current = marker
      map.setCenter(new naver.maps.LatLng(tempPin.lat, tempPin.lng))
      map.setZoom(Math.max(map.getZoom(), 15), true)
    }
  }, [tempPin])

  // 커서 변경
  useEffect(() => {
    const container = mapRef.current
    if (!container) return
    container.style.cursor = onMapClick ? 'crosshair' : ''
  }, [onMapClick])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
