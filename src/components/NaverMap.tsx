'use client'

import { useEffect, useRef } from 'react'
import { LocationGroup } from '@/types'

/* ── 카테고리 색상 ── */
const CATEGORY_COLOR: Record<string, string> = {
  낭만: '#800020',
  젊음: '#2A6040',
  사랑: '#C0392B',
}

/* ── 기존 제보 핀 HTML ── */
function makePinHTML(category: string, count: number) {
  const color = CATEGORY_COLOR[category] ?? '#800020'
  const badge =
    count > 1
      ? `<div style="position:absolute;top:-10px;left:6px;min-width:18px;height:18px;border-radius:10px;background:${color};border:2px solid #FAF8F5;color:#FAF8F5;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-shadow:0 2px 6px rgba(0,0,0,0.22);line-height:1;">${count}</div>`
      : ''
  return `<div style="position:relative;display:flex;flex-direction:column;align-items:center;">
    ${badge}
    <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 4px ${color}28;"></div>
    <div style="width:1.5px;height:14px;background:${color};opacity:0.45;margin-top:1px;"></div>
  </div>`
}

/* ── 선택된 위치 임시 핀 HTML (pulse 애니메이션) ── */
function makeTempPinHTML() {
  return `<div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
    <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:#80002033;animation:ping 1.1s cubic-bezier(0,0,0.2,1) infinite;"></div>
    <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:#80002018;animation:ping 1.1s cubic-bezier(0,0,0.2,1) 0.35s infinite;"></div>
    <div style="position:relative;width:14px;height:14px;border-radius:50%;background:#800020;border:2.5px solid #FAF8F5;box-shadow:0 2px 10px rgba(128,0,32,0.55);"></div>
  </div>`
}

/* ── 기존 제보 마커 InfoWindow ── */
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

/* ── 역지오코딩 결과에서 짧은 장소명 추출 ──
   "대구광역시 북구 중앙대로 484" → "중앙대로 484"
   "대구광역시 중구 동성로2가 1-2" → "동성로2가 1-2"           */
function parseShortName(fullAddress: string): string {
  const parts = fullAddress.trim().split(' ')
  if (parts.length < 2) return fullAddress
  // 도로명: '로', '길', '대로'로 끝나는 단어 이후
  const roadIdx = parts.findIndex(p => /[로길]$/.test(p) || p.endsWith('대로'))
  if (roadIdx >= 0) return parts.slice(roadIdx).join(' ')
  // 지번: '동', '가', '리'로 끝나는 단어 이후
  const areaIdx = parts.findIndex(p => /[동가리읍면]$/.test(p))
  if (areaIdx >= 0) return parts.slice(areaIdx).join(' ')
  return parts.slice(-2).join(' ')
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
  /** 선택된 위치 임시 핀 */
  tempPin?: { lat: number; lng: number } | null
  /** 지도 클릭 즉시 호출 (주소 확인 전 → pin 설정 + preview 전환용) */
  onMapClick?: (lat: number, lng: number) => void
  /** 역지오코딩 + 장소명 조회 완료 후 호출 */
  onAddressResolved?: (lat: number, lng: number, address: string, shortName: string, placeName?: string) => void
  focusGroupKey?: string | null
  isPickingMode?: boolean
}

export default function NaverMap({
  groups,
  center,
  zoom,
  onGroupClick,
  tempPin,
  onMapClick,
  onAddressResolved,
  focusGroupKey,
  isPickingMode,
}: MapProps) {
  const mapRef               = useRef<HTMLDivElement>(null)
  const mapInstanceRef       = useRef<naver.maps.Map | null>(null)
  const markerEntriesRef     = useRef<MarkerEntry[]>([])
  const tempMarkerRef        = useRef<naver.maps.Marker | null>(null)
  const spotInfoWinRef       = useRef<naver.maps.InfoWindow | null>(null)

  /* ── 콜백 refs (stale closure 방지) ── */
  const onMapClickRef        = useRef(onMapClick)
  const onGroupClickRef      = useRef(onGroupClick)
  const onAddressResolvedRef = useRef(onAddressResolved)
  const isPickingRef         = useRef(isPickingMode)

  useEffect(() => { onMapClickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { onGroupClickRef.current = onGroupClick }, [onGroupClick])
  useEffect(() => { onAddressResolvedRef.current = onAddressResolved }, [onAddressResolved])
  useEffect(() => { isPickingRef.current = isPickingMode }, [isPickingMode])

  /* ── 역지오코딩 + 장소명 조회 → onAddressResolved 호출 ──
     /api/place-lookup 한 번으로 주소 + 상호명을 함께 받아옴           */
  const resolveAddress = (lat: number, lng: number) => {
    fetch(`/api/place-lookup?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then((data: { address?: string; shortName?: string; placeName?: string | null }) => {
        const address   = data.address   || '주소 없음'
        const shortName = data.shortName || parseShortName(address)
        const placeName = data.placeName ?? undefined
        onAddressResolvedRef.current?.(lat, lng, address, shortName, placeName)
      })
      .catch(() => {
        onAddressResolvedRef.current?.(lat, lng, '주소 없음', '선택한 위치', undefined)
      })
  }

  /* ── 기존 제보 마커 InfoWindow 열기 ── */
  const openSpotInfoWindow = (marker: naver.maps.Marker, group: LocationGroup) => {
    const map = mapInstanceRef.current
    if (!map) return
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

  /* ════════ 지도 초기화 (한 번만 실행) ════════ */
  useEffect(() => {
    if (!mapRef.current) return

    const init = () => {
      if (mapInstanceRef.current) return

      const [initLat, initLng] = center ?? [35.8714, 128.6014]
      const map = new naver.maps.Map(mapRef.current!, {
        center: new naver.maps.LatLng(initLat, initLng),
        zoom: zoom ?? 13,
        mapDataControl: false,
        logoControl: false,
        scaleControl: false,
        zoomControl: false,
      })

      /* ── 지도 클릭: 말풍선 없이 즉시 하단 카드로 ── */
      naver.maps.Event.addListener(map, 'click', (e: unknown) => {
        const coord    = (e as { coord: naver.maps.LatLng }).coord
        const clickLat = coord.lat()
        const clickLng = coord.lng()

        // 기존 스팟 InfoWindow 닫기
        spotInfoWinRef.current?.close()

        // onMapClick이 없으면 (form 단계 등) 처리 안 함
        if (!onMapClickRef.current) return

        // ① 즉시 콜백 → page.tsx: pin 설정 + preview 단계 전환
        onMapClickRef.current(clickLat, clickLng)

        // ② 비동기 역지오코딩 → 주소 확정 후 pin.address / shortName 업데이트
        resolveAddress(clickLat, clickLng)
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

  /* ════════ 중심·줌 이동 ════════ */
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !center) return
    map.panTo(new naver.maps.LatLng(center[0], center[1]), { duration: 400 })
    if (zoom) map.setZoom(zoom, true)
  }, [center, zoom])

  /* ════════ 그룹 마커 동기화 ════════ */
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    markerEntriesRef.current.forEach(({ marker }) => marker.setMap(null))
    markerEntriesRef.current = []
    spotInfoWinRef.current?.close()

    groups.forEach(group => {
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

      // 마커 클릭은 지도 click 이벤트를 전파하지 않음
      naver.maps.Event.addListener(marker, 'click', () => {
        openSpotInfoWindow(marker, group)
        onGroupClickRef.current?.(group)
      })

      markerEntriesRef.current.push({ marker, group })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups])

  /* ════════ 피드 → 지도 포커스 ════════ */
  useEffect(() => {
    if (!focusGroupKey) return
    const map = mapInstanceRef.current
    if (!map) return

    const entry = markerEntriesRef.current.find(e => e.group.key === focusGroupKey)
    if (!entry) return

    const { marker, group } = entry
    if (group.lat != null && group.lng != null) {
      map.panTo(new naver.maps.LatLng(group.lat, group.lng), { duration: 400 })
      map.setZoom(16, true)
    }
    openSpotInfoWindow(marker, group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusGroupKey])

  /* ════════ 임시 핀 렌더링 ════════ */
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
          anchor: new naver.maps.Point(16, 16),
        },
      })
      tempMarkerRef.current = marker
      map.panTo(new naver.maps.LatLng(tempPin.lat, tempPin.lng), { duration: 300 })
      map.setZoom(Math.max(map.getZoom(), 16), true)
    }
  }, [tempPin])

  /* ════════ 커서 스타일 ════════ */
  useEffect(() => {
    const container = mapRef.current
    if (!container) return
    container.style.cursor = isPickingMode ? 'crosshair' : ''
  }, [isPickingMode])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
