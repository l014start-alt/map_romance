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

// 기존 마커(제보된 장소) 클릭 InfoWindow
function makeSpotInfoWindowHTML(placeName: string, address?: string) {
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(placeName)}`
  const addrLine = address
    ? `<p style="font-size:11px;color:#B5B0AB;margin:3px 0 10px;line-height:1.4;">${address}</p>`
    : '<div style="margin-bottom:10px;"></div>'
  return `<div style="padding:14px 16px 12px;min-width:180px;max-width:240px;font-family:Pretendard,sans-serif;">
    <p style="font-size:15px;font-weight:600;color:#111;margin:0 0 2px;line-height:1.3;word-break:keep-all;">${placeName}</p>
    ${addrLine}
    <a href="${naverUrl}" target="_blank" rel="noopener noreferrer"
      style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:#03C75A;color:#fff;font-size:11px;font-weight:600;border-radius:4px;text-decoration:none;">
      네이버 지도로 보기
    </a>
  </div>`
}

// 지도 클릭/POI 클릭 InfoWindow (주소 로딩 중)
function makeClickInfoWindowHTML(cbKey: string, loadingAddress: string, isPickingMode: boolean) {
  const action = isPickingMode ? 'confirm' : 'record'
  const btnLabel = isPickingMode ? '이 위치로 기록하기' : '여기에 낭만 기록하기'
  return `<div id="ciw-${cbKey}" style="padding:14px 16px 12px;min-width:180px;max-width:240px;font-family:Pretendard,sans-serif;">
    <p style="font-size:12px;color:#B5B0AB;margin:0 0 10px;line-height:1.5;">${loadingAddress}</p>
    <button
      onclick="window.__naverMapCallback&&window.__naverMapCallback['${cbKey}']('${action}')"
      style="width:100%;padding:8px 0;background:#800020;color:#FAF8F5;font-size:12px;font-family:Pretendard,sans-serif;font-weight:600;border-radius:4px;cursor:pointer;letter-spacing:0.04em;">
      ${btnLabel}
    </button>
  </div>`
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
  isPickingMode?: boolean
  onRecordAtLocation?: (lat: number, lng: number, address: string) => void
}

export default function NaverMap({
  groups, center, zoom,
  onGroupClick, tempPin, onMapClick,
  focusGroupKey, isPickingMode, onRecordAtLocation,
}: MapProps) {
  const mapRef            = useRef<HTMLDivElement>(null)
  const mapInstanceRef    = useRef<naver.maps.Map | null>(null)
  const markerEntriesRef  = useRef<MarkerEntry[]>([])
  const tempMarkerRef     = useRef<naver.maps.Marker | null>(null)
  const spotInfoWinRef    = useRef<naver.maps.InfoWindow | null>(null)
  const clickInfoWinRef   = useRef<naver.maps.InfoWindow | null>(null)
  const cbKeyRef          = useRef<string>('')
  const onMapClickRef     = useRef(onMapClick)
  const onGroupClickRef   = useRef(onGroupClick)
  const onRecordRef       = useRef(onRecordAtLocation)
  const isPickingRef      = useRef(isPickingMode)

  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onGroupClickRef.current = onGroupClick }, [onGroupClick])
  useEffect(() => { onRecordRef.current = onRecordAtLocation }, [onRecordAtLocation])
  useEffect(() => { isPickingRef.current = isPickingMode }, [isPickingMode])

  // 지도 클릭 InfoWindow 열기 (POI 클릭 포함)
  const openClickInfoWindow = (lat: number, lng: number) => {
    const map = mapInstanceRef.current
    if (!map) return

    // 기존 클릭 InfoWindow 닫기
    clickInfoWinRef.current?.close()

    const key = `${Date.now()}`
    cbKeyRef.current = key

    // 콜백 등록
    if (!window.__naverMapCallback) window.__naverMapCallback = {}
    window.__naverMapCallback[key] = (action: string) => {
      clickInfoWinRef.current?.close()
      onRecordRef.current?.(lat, lng, currentAddress)
      delete window.__naverMapCallback![key]
    }

    let currentAddress = '주소 확인 중…'

    clickInfoWinRef.current = new naver.maps.InfoWindow({
      content: makeClickInfoWindowHTML(key, currentAddress, isPickingRef.current ?? false),
      borderWidth: 1,
      backgroundColor: '#FAF8F5',
      borderColor: '#EDE9E4',
      pixelOffset: new naver.maps.Point(0, -6),
      maxWidth: 260,
    })
    clickInfoWinRef.current.open(map, new naver.maps.LatLng(lat, lng))

    // 역지오코딩으로 주소 업데이트
    if (window.naver?.maps?.Service?.reverseGeocode) {
      window.naver.maps.Service.reverseGeocode(
        { coords: new naver.maps.LatLng(lat, lng), orders: 'roadaddr,addr' },
        (status, response) => {
          if (status !== window.naver.maps.Service.Status.OK) return
          const roadAddr = response.v2?.address?.roadAddress
          const jibunAddr = response.v2?.address?.jibunAddress
          currentAddress = roadAddr || jibunAddr || '주소 없음'

          // InfoWindow 내용 업데이트
          if (clickInfoWinRef.current?.getMap()) {
            const el = document.getElementById(`ciw-${key}`)
            if (el) {
              const p = el.querySelector('p')
              if (p) p.textContent = currentAddress
            }
          }
        }
      )
    } else {
      // 서버 API 폴백
      fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
        .then(r => r.json())
        .then((data: { address?: string }) => {
          currentAddress = data.address || '주소 없음'
          if (clickInfoWinRef.current?.getMap()) {
            const el = document.getElementById(`ciw-${key}`)
            if (el) {
              const p = el.querySelector('p')
              if (p) p.textContent = currentAddress
            }
          }
        })
        .catch(() => {})
    }
  }

  // 기존 마커(스팟) InfoWindow 열기
  const openSpotInfoWindow = (marker: naver.maps.Marker, group: LocationGroup) => {
    const map = mapInstanceRef.current
    if (!map) return

    clickInfoWinRef.current?.close()

    if (!spotInfoWinRef.current) {
      spotInfoWinRef.current = new naver.maps.InfoWindow({
        content: '',
        borderWidth: 1,
        backgroundColor: '#FAF8F5',
        borderColor: '#EDE9E4',
        pixelOffset: new naver.maps.Point(0, -8),
        maxWidth: 260,
      })
    }

    spotInfoWinRef.current.setContent(makeSpotInfoWindowHTML(group.placeName, group.address))
    spotInfoWinRef.current.open(map, marker)
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

      naver.maps.Event.addListener(map, 'click', (e: unknown) => {
        const coord = (e as { coord: naver.maps.LatLng }).coord
        const lat = coord.lat()
        const lng = coord.lng()

        // 기존 스팟 InfoWindow 닫기
        spotInfoWinRef.current?.close()

        if (isPickingRef.current) {
          // picking 모드: 기존 onMapClick 콜백 + InfoWindow
          onMapClickRef.current?.(lat, lng)
          openClickInfoWindow(lat, lng)
        } else {
          // 일반 모드: POI/지명 클릭 감지용 InfoWindow
          openClickInfoWindow(lat, lng)
        }
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
    map.panTo(new naver.maps.LatLng(center[0], center[1]), { duration: 400 })
    if (zoom) map.setZoom(zoom, true)
  }, [center, zoom])

  // 그룹 마커 동기화
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    markerEntriesRef.current.forEach(({ marker }) => marker.setMap(null))
    markerEntriesRef.current = []
    spotInfoWinRef.current?.close()
    clickInfoWinRef.current?.close()

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
        clickInfoWinRef.current?.close()
        openSpotInfoWindow(marker, group)
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
      map.panTo(new naver.maps.LatLng(group.lat, group.lng), { duration: 400 })
      map.setZoom(16, true)
    }
    openSpotInfoWindow(marker, group)
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
      map.panTo(new naver.maps.LatLng(tempPin.lat, tempPin.lng), { duration: 300 })
      map.setZoom(Math.max(map.getZoom(), 15), true)
    }
  }, [tempPin])

  // picking 모드 해제 시 click InfoWindow 닫기
  useEffect(() => {
    if (!isPickingMode) {
      clickInfoWinRef.current?.close()
    }
  }, [isPickingMode])

  // 커서 변경
  useEffect(() => {
    const container = mapRef.current
    if (!container) return
    container.style.cursor = isPickingMode ? 'crosshair' : ''
  }, [isPickingMode])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
