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

function makeInfoWindowHTML(placeName: string, address?: string) {
  const naverSearchUrl = `https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`
  const addressLine = address
    ? `<p style="font-size:11px;color:#B5B0AB;margin:3px 0 10px;font-family:Pretendard,sans-serif;line-height:1.4;">${address}</p>`
    : '<div style="margin-bottom:10px;"></div>'
  return `
    <div style="padding:14px 16px 12px;min-width:180px;max-width:240px;font-family:Pretendard,sans-serif;">
      <p style="font-size:15px;font-weight:600;color:#111;margin:0 0 2px;line-height:1.3;word-break:keep-all;">${placeName}</p>
      ${addressLine}
      <a
        href="${naverSearchUrl}"
        target="_blank"
        rel="noopener noreferrer"
        style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:#03C75A;color:#fff;font-size:11px;font-weight:600;border-radius:4px;text-decoration:none;letter-spacing:0.02em;"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 0L10.5 8.5H0l8 5.5-3 8.5 8-5.5 8 5.5-3-8.5 8-5.5H13.5z" style="display:none"/><path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727z"/></svg>
        네이버 지도로 보기
      </a>
    </div>
  `
}

interface MarkerEntry {
  marker: naver.maps.Marker
  group: LocationGroup
}

interface MapProps {
  groups: LocationGroup[]
  center?: [number, number]
  zoom?: number
  onGroupClick?: (group: LocationGroup) => void
  tempPin?: { lat: number; lng: number } | null
  onMapClick?: (lat: number, lng: number) => void
  focusGroupKey?: string | null
}

export default function NaverMap({ groups, center, zoom, onGroupClick, tempPin, onMapClick, focusGroupKey }: MapProps) {
  const mapRef           = useRef<HTMLDivElement>(null)
  const mapInstanceRef   = useRef<naver.maps.Map | null>(null)
  const markerEntriesRef = useRef<MarkerEntry[]>([])
  const tempMarkerRef    = useRef<naver.maps.Marker | null>(null)
  const infoWindowRef    = useRef<naver.maps.InfoWindow | null>(null)
  const onMapClickRef    = useRef(onMapClick)
  const onGroupClickRef  = useRef(onGroupClick)

  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onGroupClickRef.current = onGroupClick }, [onGroupClick])

  const openInfoWindow = (marker: naver.maps.Marker, group: LocationGroup) => {
    const map = mapInstanceRef.current
    if (!map) return

    if (!infoWindowRef.current) {
      infoWindowRef.current = new naver.maps.InfoWindow({
        content: '',
        borderWidth: 0,
        disableAnchor: false,
        backgroundColor: '#FAF8F5',
        borderColor: '#EDE9E4',
        pixelOffset: new naver.maps.Point(0, -8),
      })
    }

    infoWindowRef.current.close()
    infoWindowRef.current = new naver.maps.InfoWindow({
      content: makeInfoWindowHTML(group.placeName, group.address),
      borderWidth: 1,
      disableAnchor: false,
      backgroundColor: '#FAF8F5',
      borderColor: '#EDE9E4',
      pixelOffset: new naver.maps.Point(0, -8),
    })
    infoWindowRef.current.open(map, marker)
  }

  // 지도 초기화
  useEffect(() => {
    if (!mapRef.current) return

    const init = () => {
      if (mapInstanceRef.current) return
      const [lat, lng] = center ?? [35.8714, 128.6014]
      const map = new naver.maps.Map(mapRef.current!, {
        center: new naver.maps.LatLng(lat, lng),
        zoom: zoom ?? 13,
        mapDataControl: false,
        logoControl: false,
        scaleControl: false,
        zoomControl: false,
      })

      // 지도 빈 곳 클릭 시 InfoWindow 닫기
      naver.maps.Event.addListener(map, 'click', (e: unknown) => {
        infoWindowRef.current?.close()
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

    markerEntriesRef.current.forEach(({ marker }) => marker.setMap(null))
    markerEntriesRef.current = []
    infoWindowRef.current?.close()

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

      naver.maps.Event.addListener(marker, 'click', () => {
        openInfoWindow(marker, group)
        onGroupClickRef.current?.(group)
      })

      markerEntriesRef.current.push({ marker, group })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  // 외부에서 특정 그룹 포커스 (피드 → 지도 연동)
  useEffect(() => {
    if (!focusGroupKey) return
    const map = mapInstanceRef.current
    if (!map) return

    const entry = markerEntriesRef.current.find((e) => e.group.key === focusGroupKey)
    if (!entry) return

    const { marker, group } = entry
    if (group.lat != null && group.lng != null) {
      map.setCenter(new naver.maps.LatLng(group.lat, group.lng))
      map.setZoom(16, true)
    }
    openInfoWindow(marker, group)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGroupKey])

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
