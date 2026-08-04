'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import RecordModal from '@/components/RecordModal'
import LocationPicker, { type PinData } from '@/components/LocationPicker'
import PlacePreviewCard from '@/components/PlacePreviewCard'
import SpotSheet from '@/components/SpotSheet'
import FeedView from '@/components/FeedView'
import DaeguMap from '@/components/DaeguMap'
import Footer from '@/components/Footer'
import { Spot, Category, LocationGroup } from '@/types'
import { MOCK_SPOTS } from '@/lib/mockData'

const LeafletMap = dynamic(() => import('@/components/NaverMap'), { ssr: false })

type View = 'landing' | 'daegu-districts' | 'map'
type Tab  = 'map' | 'feed'
type RecordPhase = 'idle' | 'picking' | 'preview' | 'form'
type Filter = 'all' | Category

interface Region {
  id: string; name: string; emoji: string
  lat: number; lng: number; zoom: number; mood: string
}

/* 낭만여지도는 대구 전용 — 단일 지역 */
const DAEGU: Region = { id: 'daegu', name: '대구', emoji: '🍎', lat: 35.8714, lng: 128.6014, zoom: 13, mood: '뜨겁고 달콤한 여름' }

const FONT_BRAND = 'var(--font-brand)'
const FONT_UI    = 'var(--font-sans)'
const DESKTOP_BP = 1024

/* ── 데스크탑(≥1024px) 여부 감지 ── */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${DESKTOP_BP}px)`)
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isDesktop
}
const FILTER_LABELS: Filter[] = ['all', '낭만', '젊음', '사랑']
const FILTER_KR: Record<Filter, string> = { all: '전체', 낭만: '낭만', 젊음: '젊음', 사랑: '사랑' }
const LS_KEY = 'map_romance_local_spots'

function groupSpots(spots: Spot[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>()
  for (const spot of spots) {
    const key = spot.placeName.trim().toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { key, placeName: spot.placeName, address: spot.address, lat: spot.lat, lng: spot.lng, spots: [spot] })
    } else {
      existing.spots.push(spot)
      if (existing.lat == null && spot.lat != null) {
        existing.lat = spot.lat; existing.lng = spot.lng
        existing.address = existing.address ?? spot.address
      }
    }
  }
  return Array.from(map.values())
}

export default function App() {
  const [view, setView]                     = useState<View>('landing')
  const [tab, setTab]                       = useState<Tab>('map')
  const [fading, setFading]                 = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [spots, setSpots]                   = useState<Spot[]>([])
  const [filter, setFilter]                 = useState<Filter>('all')
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const [mapFlyTarget, setMapFlyTarget]     = useState<{ center: [number, number]; zoom: number } | null>(null)

  const [phase, setPhase]         = useState<RecordPhase>('idle')
  const [pin, setPin]             = useState<PinData | null>(null)
  const [focusGroupKey, setFocusGroupKey] = useState<string | null>(null)
  const [locating, setLocating]   = useState(false)

  const isDesktop = useIsDesktop()

  const filteredSpots  = filter === 'all' ? spots : spots.filter(s => s.category === filter)
  const filteredGroups = groupSpots(filteredSpots)
  const activeGroup    = activeGroupKey ? filteredGroups.find(g => g.key === activeGroupKey) ?? null : null

  /* ── 초기 로딩: mockData + localStorage + Supabase 병합 ── */
  useEffect(() => {
    let localSpots: Spot[] = []
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        // 구버전 imageBase64 필드 마이그레이션
        localSpots = (JSON.parse(raw) as Array<Spot & { imageBase64?: string }>).map(s => ({
          ...s,
          imageUrl: s.imageUrl ?? s.imageBase64,
        }))
      }
    } catch { /* ignore */ }

    // mock 데이터 + localStorage 병합 (로컬이 항상 우선)
    const localIds = new Set(localSpots.map(s => s.id))
    const mockOnly = MOCK_SPOTS.filter(s => !localIds.has(s.id))
    setSpots([...localSpots, ...mockOnly])

    // Supabase API 추가 (mock·local에 없는 것만)
    fetch('/api/spots?approved=true')
      .then(r => r.json())
      .then((apiSpots: Spot[]) => {
        const allKnownIds = new Set([...localSpots, ...MOCK_SPOTS].map(s => s.id))
        const apiOnly = apiSpots.filter(s => !allKnownIds.has(s.id))
        setSpots(prev => [...prev, ...apiOnly])
      })
      .catch(() => {})
  }, [])

  /* ── 뷰 전환 ── */
  const transition = (fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 260)
  }
  const goMap = (region: Region) => transition(() => {
    setSelectedRegion(region)
    setMapFlyTarget(null)
    setTab('map')
    if (region.id === 'daegu') {
      setView('daegu-districts')
    } else {
      setView('map')
    }
  })
  const goBack = () => transition(() => {
    setView('landing'); setActiveGroupKey(null)
    setPhase('idle'); setPin(null)
  })

  /* ── 탭 전환 (picking/form 중에는 map 탭으로만 전환) ── */
  const switchTab = (newTab: Tab) => {
    if (newTab === 'feed') {
      setPhase('idle'); setPin(null); setActiveGroupKey(null)
    }
    if (newTab === 'map' && (phase === 'preview' || phase === 'form')) {
      setPhase('idle'); setPin(null)
    }
    setTab(newTab)
  }

  /* ── 지도 클릭 즉시 처리 → preview 단계로 전환 ── */
  const handleMapClick = useCallback((lat: number, lng: number) => {
    setPin({ lat, lng, address: '' })   // 빈 address = 로딩 중
    setPhase('preview')
    setActiveGroupKey(null)
  }, [])

  /* ── 역지오코딩 + 장소명 완료 → pin 업데이트 ── */
  const handleAddressResolved = useCallback((lat: number, lng: number, address: string, shortName: string, placeName?: string) => {
    setPin(prev => {
      if (!prev || prev.lat !== lat || prev.lng !== lng) return prev
      return {
        ...prev,
        address,
        shortName,
        // placeName이 있으면 상호명 우선, 없으면 기존 유지
        placeName: placeName ?? prev.placeName,
      }
    })
  }, [])

  /* ── 검색 결과 선택 → pin 업데이트 + 지도 이동 ── */
  const handlePinUpdate = useCallback((newPin: PinData) => {
    setPin(newPin)
    setMapFlyTarget({ center: [newPin.lat, newPin.lng], zoom: 17 })
  }, [])


  /* ── 지도 이동 콜백 (LocationPicker 검색 결과 선택 시) ── */
  const handleMapFlyTo = useCallback((lat: number, lng: number, zoom?: number) => {
    setMapFlyTarget({ center: [lat, lng], zoom: zoom ?? 17 })
  }, [])

  /* ── 현재 위치로 이동 ── */
  const goToCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapFlyTarget({ center: [pos.coords.latitude, pos.coords.longitude], zoom: 16 })
        setLocating(false)
      },
      () => { setLocating(false) },
      { timeout: 8000, maximumAge: 30000 }
    )
  }

  const startPicking    = () => { setPin(null); setPhase('picking'); setActiveGroupKey(null) }
  const confirmPin      = useCallback((overridePin?: PinData) => {
    const p = overridePin ?? pin
    if (p) { setPin(p); setPhase('preview') }
  }, [pin])
  const confirmPreview  = () => setPhase('form')
  const reselectPin     = () => { setPhase('picking') }
  const closeRecord     = () => { setPhase('idle'); setPin(null) }

  /* ── 폼 제출 ── */
  const handleSubmit = useCallback(async (data: {
    placeName: string; address?: string; lat?: number; lng?: number
    category: Category; moment: string; nickname: string
    title?: string; imageUrl?: string; password?: string
  }) => {
    const newSpot: Spot = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      placeName: data.placeName, address: data.address,
      lat: data.lat, lng: data.lng,
      category: data.category, moment: data.moment,
      nickname: data.nickname, title: data.title,
      imageUrl: data.imageUrl, password: data.password,
      approved: true, createdAt: new Date().toISOString(),
    }

    setSpots(prev => [newSpot, ...prev])

    try {
      const raw = localStorage.getItem(LS_KEY)
      const existing: Spot[] = raw ? JSON.parse(raw) : []
      localStorage.setItem(LS_KEY, JSON.stringify([newSpot, ...existing]))
    } catch { /* ignore */ }

    // API: imageUrl(base64)·password 제외
    fetch('/api/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeName: data.placeName, address: data.address,
        lat: data.lat, lng: data.lng,
        category: data.category, moment: data.moment,
        nickname: data.nickname, title: data.title,
      }),
    }).catch(() => {})
  }, [])

  /* ── 사연 삭제 ── */
  const handleDeleteStory = useCallback((id: string) => {
    setSpots(prev => prev.filter(s => s.id !== id))
    try {
      const raw = localStorage.getItem(LS_KEY)
      const existing: Spot[] = raw ? JSON.parse(raw) : []
      localStorage.setItem(LS_KEY, JSON.stringify(existing.filter(s => s.id !== id)))
    } catch { /* ignore */ }
  }, [])

  /* ── 사연 수정 ── */
  const handleUpdateStory = useCallback((id: string, data: Partial<Pick<Spot, 'title' | 'moment' | 'category'>>) => {
    setSpots(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
    try {
      const raw = localStorage.getItem(LS_KEY)
      const existing: Spot[] = raw ? JSON.parse(raw) : []
      localStorage.setItem(LS_KEY, JSON.stringify(existing.map(s => s.id === id ? { ...s, ...data } : s)))
    } catch { /* ignore */ }
  }, [])

  /* ── 비밀번호 검증 ── */
  const verifyPassword = useCallback((spotId: string, pw: string): boolean => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      const existing: Spot[] = raw ? JSON.parse(raw) : []
      const spot = existing.find(s => s.id === spotId)
      if (spot === undefined) return false
      if (!spot.password) return true
      return spot.password === pw
    } catch { return false }
  }, [])

  /* ── 피드에서 지도로 이동 ── */
  const handleGoToPlace = useCallback((spot: Spot) => {
    if (spot.lat == null || spot.lng == null) return
    const key = spot.placeName.trim().toLowerCase()
    setMapFlyTarget({ center: [spot.lat, spot.lng], zoom: 16 })
    setActiveGroupKey(key)
    setFocusGroupKey(null)           // 리셋 후 재설정으로 useEffect 재발동
    setTimeout(() => setFocusGroupKey(key), 0)
    setTab('map')
  }, [])

  const pageStyle: React.CSSProperties = {
    opacity: fading ? 0 : 1,
    transition: 'opacity 0.26s ease',
    width: '100%', height: '100%',
  }

  /* ════════ LANDING VIEW — 데스크탑 (좌우 분할) ════════ */
  if (view === 'landing' && isDesktop) {
    return (
      <div style={{ ...pageStyle, background: '#FAF8F5', display: 'flex', overflow: 'hidden' }}>

        {/* 좌측 — 히어로 일러스트 */}
        <div style={{ width: '46%', minWidth: '420px', maxWidth: '760px', height: '100%', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', borderRight: '1px solid #EDE9E4' }}>
          <Image
            src="/hero-map.png"
            alt="낭만여지도"
            width={773}
            height={1100}
            priority
            style={{ width: 'auto', height: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* 우측 — 지역 선택 + 푸터 */}
        <div style={{ flex: 1, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 56px' }}>
            <DaeguStart onStart={() => goMap(DAEGU)} desktop />
          </div>
          <Footer />
        </div>
      </div>
    )
  }

  /* ════════ LANDING VIEW ════════ */
  if (view === 'landing') {
    return (
      <div style={{ ...pageStyle, background: '#FAF8F5', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* 히어로 섹션 — 전체 일러스트 이미지 */}
        <div style={{ width: '100%' }}>
          <Image
            src="/hero-map.png"
            alt="낭만여지도"
            width={773}
            height={1100}
            priority
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* 대구 시작 섹션 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '36px 20px 56px' }}>
          <DaeguStart onStart={() => goMap(DAEGU)} />
        </div>
        <Footer />
      </div>
    )
  }

  /* ════════ DAEGU DISTRICTS VIEW ════════ */
  if (view === 'daegu-districts') {
    return (
      <div style={{ ...pageStyle, background: '#FAF8F5', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #EDE9E4', background: 'rgba(250,248,245,0.97)', position: 'sticky', top: 0, zIndex: 10 }}>
          <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560', cursor: 'pointer', minWidth: '44px', minHeight: '44px', padding: '0 6px' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="13,4 7,10 13,16" />
            </svg>
            지역 선택
          </button>
          <p style={{ fontFamily: FONT_BRAND, fontSize: '17px', color: '#800020', lineHeight: 1.1 }}>낭만여지도</p>
          <div style={{ width: '44px' }} />
        </header>

        {/* 안내 문구 */}
        <div style={{ padding: '20px 20px 8px', textAlign: 'center' }}>
          <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#A09890', letterSpacing: '0.04em' }}>구역을 눌러 지도로 이동하세요</p>
        </div>

        {/* 대구 인터랙티브 지도 */}
        <div style={{ flex: 1, padding: '0 12px 40px', width: '100%', maxWidth: isDesktop ? '720px' : undefined, margin: '0 auto', display: 'flex', alignItems: 'center' }}>
          <DaeguMap
            onRegionClick={() => {
              transition(() => {
                setTab('map')
                setView('map')
              })
            }}
          />
        </div>
      </div>
    )
  }

  /* ════════ MAP VIEW ════════ */
  const mapCenter = mapFlyTarget?.center ?? (selectedRegion ? [selectedRegion.lat, selectedRegion.lng] as [number, number] : undefined)
  const mapZoom   = mapFlyTarget?.zoom   ?? selectedRegion?.zoom

  /* ════════ MAP VIEW — 데스크탑 (사연 갤러리, 지도 없음) ════════ */
  if (isDesktop) {
    const gallerySpots = [...filteredSpots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return (
      <div style={{ ...pageStyle, position: 'relative', background: '#FAF8F5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 헤더 바 */}
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '18px 40px', borderBottom: '1px solid #EDE9E4', background: '#FAF8F5', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: 0 }}>
            <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
              지역 선택
            </button>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontFamily: FONT_BRAND, fontSize: '28px', color: '#800020', lineHeight: 1 }}>낭만여지도</span>
              <span style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB', letterSpacing: '0.04em' }}>· 대구</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '2px' }}>
              {FILTER_LABELS.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ fontFamily: FONT_UI, fontSize: '13px', cursor: 'pointer', padding: '7px 16px', borderRadius: '99px', background: filter === f ? '#800020' : 'transparent', color: filter === f ? '#FAF8F5' : '#8A8480', fontWeight: filter === f ? 500 : 400, transition: 'all 0.18s' }}>
                  {FILTER_KR[f]}
                </button>
              ))}
            </div>
            <button onClick={startPicking} style={{ fontFamily: FONT_BRAND, fontSize: '18px', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', padding: '11px 24px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(128,0,32,0.24)', cursor: 'pointer', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
              낭만 기록하기
            </button>
          </div>
        </header>

        {/* 갤러리 */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          {gallerySpots.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <p style={{ fontFamily: FONT_BRAND, fontSize: '26px', color: '#C0BEBB' }}>아직 사연이 없어요</p>
              <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#DED9D3' }}>‘낭만 기록하기’로 첫 사연을 남겨보세요</p>
            </div>
          ) : (
            <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 40px 64px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0 0 22px 2px' }}>
                <span style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#8A8480', letterSpacing: '0.1em' }}>낭만 사연</span>
                <span style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#C0BEBB' }}>{gallerySpots.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', alignItems: 'start' }}>
                {gallerySpots.map(spot => <GalleryCard key={spot.id} spot={spot} />)}
              </div>
            </div>
          )}
        </div>

        {/* 기록 오버레이 — 지도 없이 검색으로 위치 지정 */}
        {phase === 'picking' && (
          <LocationPicker
            desktop
            pin={pin}
            onPinUpdate={handlePinUpdate}
            onMapFlyTo={handleMapFlyTo}
            onConfirm={confirmPin}
            onCancel={closeRecord}
          />
        )}
        {phase === 'preview' && pin && (
          <PlacePreviewCard desktop pin={pin} onConfirm={confirmPreview} onReselect={reselectPin} />
        )}
        {phase === 'form' && (
          <RecordModal pin={pin} desktop onClose={closeRecord} onSubmit={handleSubmit} />
        )}
      </div>
    )
  }

  return (
    <main style={{ ...pageStyle, position: 'relative' }}>

      {/* 지도 — 항상 마운트 유지 (피드 탭에서도 숨기지 않음) */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <LeafletMap
          groups={filteredGroups}
          onGroupClick={tab === 'map' && phase === 'idle' ? (g) => setActiveGroupKey(g.key) : undefined}
          center={mapCenter}
          zoom={mapZoom}
          tempPin={pin}
          onMapClick={tab === 'map' && phase !== 'form' ? handleMapClick : undefined}
          onAddressResolved={handleAddressResolved}
          focusGroupKey={focusGroupKey}
          isPickingMode={tab === 'map' && phase === 'picking'}
        />
      </div>

      {/* 지도 탭 전용 UI */}
      {tab === 'map' && (
        <>
          {/* 헤더 */}
          <header style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'linear-gradient(to bottom, rgba(250,248,245,0.96) 55%, transparent)' }}>
            <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560', cursor: 'pointer', minWidth: '44px', minHeight: '44px', padding: '0 6px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13,4 7,10 13,16" />
              </svg>
              지역 선택
            </button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: FONT_BRAND, fontSize: '17px', color: '#800020', lineHeight: 1.1 }}>낭만여지도</p>
              {selectedRegion && (
                <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.06em', marginTop: '2px' }}>
                  {selectedRegion.emoji} {selectedRegion.name}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {FILTER_LABELS.map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{ fontFamily: FONT_UI, fontSize: '11px', cursor: 'pointer', color: filter === f ? '#111' : '#C0BEBB', fontWeight: filter === f ? 500 : 400, borderBottom: filter === f ? '1px solid #111' : '1px solid transparent', paddingBottom: '2px', transition: 'all 0.2s' }}>
                  {FILTER_KR[f]}
                </button>
              ))}
            </div>
          </header>

          {/* FAB */}
          {phase === 'idle' && !activeGroup && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', paddingBottom: 'calc(56px + 28px)', background: 'linear-gradient(to top, rgba(250,248,245,0.96) 40%, transparent)' }}>
              <button onClick={startPicking} style={{ fontFamily: FONT_BRAND, fontSize: '15px', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', padding: '13px 30px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(128,0,32,0.28)', cursor: 'pointer', transition: 'opacity 0.2s' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
                </svg>
                낭만 기록하기
              </button>
            </div>
          )}

          {/* 현재 위치 버튼 */}
          {phase === 'idle' && (
            <button
              onClick={goToCurrentLocation}
              disabled={locating}
              style={{
                position: 'absolute',
                right: '16px',
                bottom: 'calc(56px + 16px)',
                zIndex: 1000,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#FAF8F5',
                boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: locating ? 'default' : 'pointer',
                transition: 'opacity 0.2s',
                opacity: locating ? 0.5 : 1,
              }}
            >
              {locating ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800020" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                  </path>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#800020" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeOpacity="0.2"/>
                </svg>
              )}
            </button>
          )}

          {/* 스팟 카운트 */}
          {phase === 'idle' && !activeGroup && filteredGroups.length > 0 && (
            <p style={{ position: 'absolute', right: '20px', bottom: 'calc(56px + 14px)', zIndex: 1000, fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.1em' }}>
              {filteredGroups.length}개의 장소
            </p>
          )}

          {/* SpotSheet */}
          {phase === 'idle' && activeGroup && (
            <SpotSheet
              group={activeGroup}
              onClose={() => setActiveGroupKey(null)}
              onDelete={handleDeleteStory}
              onUpdate={handleUpdateStory}
              verifyPassword={verifyPassword}
            />
          )}

          {/* LocationPicker */}
          {phase === 'picking' && (
            <LocationPicker
              pin={pin}
              onPinUpdate={handlePinUpdate}
              onMapFlyTo={handleMapFlyTo}
              onConfirm={confirmPin}
              onCancel={closeRecord}
            />
          )}

          {/* PlacePreviewCard */}
          {phase === 'preview' && pin && (
            <PlacePreviewCard
              pin={pin}
              onConfirm={confirmPreview}
              onReselect={reselectPin}
            />
          )}

          {/* RecordModal */}
          {phase === 'form' && (
            <RecordModal pin={pin} onClose={closeRecord} onSubmit={handleSubmit} />
          )}
        </>
      )}

      {/* 피드 탭 */}
      {tab === 'feed' && (
        <>
          {/* 피드 헤더 */}
          <header style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(250,248,245,0.97)', borderBottom: '1px solid #EDE9E4' }}>
            <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560', cursor: 'pointer', minWidth: '44px', minHeight: '44px', padding: '0 6px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="13,4 7,10 13,16" />
              </svg>
              지역 선택
            </button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: FONT_BRAND, fontSize: '17px', color: '#800020', lineHeight: 1.1 }}>낭만여지도</p>
              <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.06em', marginTop: '2px' }}>사연보기</p>
            </div>
            <div style={{ width: '44px' }} />
          </header>
          {/* FeedView는 헤더(~56px) 아래에서 시작 */}
          <div style={{ position: 'absolute', top: '56px', left: 0, right: 0, bottom: '56px', zIndex: 900 }}>
            <FeedView spots={spots} onGoToPlace={handleGoToPlace} />
          </div>
        </>
      )}

      {/* 하단 탭 바 — picking/preview/form 중에는 숨김 */}
      {phase === 'idle' && (
        <nav style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '56px', background: '#FAF8F5', borderTop: '1px solid #EDE9E4', display: 'flex', zIndex: 1500 }}>
          <button type="button" onClick={() => switchTab('map')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', fontFamily: FONT_UI, fontSize: '10px', letterSpacing: '0.06em', color: tab === 'map' ? '#800020' : '#C0BEBB', cursor: 'pointer', transition: 'color 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="3,6 9,3 15,6 21,3 21,18 15,21 9,18 3,21" />
              <line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" />
            </svg>
            지도보기
          </button>
          <div style={{ width: '1px', background: '#EDE9E4', margin: '12px 0' }} />
          <button type="button" onClick={() => switchTab('feed')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', fontFamily: FONT_UI, fontSize: '10px', letterSpacing: '0.06em', color: tab === 'feed' ? '#800020' : '#C0BEBB', cursor: 'pointer', transition: 'color 0.2s' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            사연보기
          </button>
        </nav>
      )}
    </main>
  )
}

/* ── 입장 포토부스 (카메라) ── */
function CameraBooth({ desktop = false }: { desktop?: boolean }) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [photo, setPhoto]   = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'on' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('on')
      } catch {
        setStatus('error')
      }
    }
    start()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.translate(canvas.width, 0); ctx.scale(-1, 1)   // 거울 반전 보정
    ctx.drawImage(v, 0, 0)
    setPhoto(canvas.toDataURL('image/jpeg', 0.9))
  }
  const save = () => {
    if (!photo) return
    const a = document.createElement('a')
    a.href = photo
    a.download = `낭만여지도_${Date.now()}.jpg`
    a.click()
  }

  const btnBase: React.CSSProperties = { fontFamily: FONT_UI, fontSize: '13px', letterSpacing: '0.04em', padding: '11px 24px', borderRadius: '99px', cursor: 'pointer', transition: 'all 0.18s' }

  return (
    <div style={{ width: desktop ? '440px' : '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
      <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: '18px', overflow: 'hidden', background: '#2A2520', position: 'relative', border: '3px solid #800020', boxShadow: '0 8px 30px rgba(128,0,32,0.14)' }}>
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photo} alt="촬영한 사진" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }} />
        )}
        {status !== 'on' && !photo && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#FAF8F5', textAlign: 'center', padding: '20px' }}>
            <span style={{ fontSize: '30px' }}>📷</span>
            <span style={{ fontFamily: FONT_UI, fontSize: '12px', lineHeight: 1.6, opacity: 0.85, whiteSpace: 'pre-line' }}>
              {status === 'loading' ? '카메라를 켜는 중…' : '카메라를 사용할 수 없어요.\n권한을 허용했는지 확인해주세요.'}
            </span>
          </div>
        )}
        <span style={{ position: 'absolute', left: '14px', bottom: '12px', fontFamily: FONT_BRAND, fontSize: '20px', color: 'rgba(250,248,245,0.92)', textShadow: '0 1px 6px rgba(0,0,0,0.5)', pointerEvents: 'none' }}>낭만여지도</span>
      </div>

      {photo ? (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setPhoto(null)} style={{ ...btnBase, background: 'transparent', border: '1px solid #DED9D3', color: '#8A8480' }}>다시 찍기</button>
          <button onClick={save} style={{ ...btnBase, background: '#800020', color: '#FAF8F5', border: '1px solid #800020' }}>사진 저장</button>
        </div>
      ) : (
        <button onClick={capture} disabled={status !== 'on'} style={{ ...btnBase, background: status === 'on' ? '#2A2520' : '#EDE9E4', color: status === 'on' ? '#FAF8F5' : '#C0BEBB', border: 'none', cursor: status === 'on' ? 'pointer' : 'default' }}>
          📸 사진 찍기
        </button>
      )}
    </div>
  )
}

/* ── 입장 CTA (포토부스 + 입장 버튼) ── */
function DaeguStart({ onStart, desktop = false }: { onStart: () => void; desktop?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: desktop ? '28px' : '22px' }}>
      <CameraBooth desktop={desktop} />
      <button onClick={onStart} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: FONT_BRAND, fontSize: desktop ? '24px' : '20px', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', padding: desktop ? '16px 48px' : '15px 40px', cursor: 'pointer', transform: hovered ? 'translateY(-2px)' : 'translateY(0)', boxShadow: hovered ? '0 10px 30px rgba(128,0,32,0.32)' : '0 4px 18px rgba(128,0,32,0.22)', transition: 'all 0.2s ease' }}>
        낭만여지도 입장하기
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="10" x2="15" y2="10" /><polyline points="10,5 15,10 10,15" />
        </svg>
      </button>
    </div>
  )
}

/* ── 사연 갤러리 카드 (데스크탑) ── */
const CATEGORY_COLOR: Record<string, string> = { 낭만: '#800020', 젊음: '#2A6040', 사랑: '#B0402B' }

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function GalleryCard({ spot }: { spot: Spot }) {
  const [hovered, setHovered] = useState(false)
  const color = CATEGORY_COLOR[spot.category] ?? '#800020'
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(spot.placeName)}`
  return (
    <article
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ background: '#FFFFFF', border: `1px solid ${hovered ? '#E4D5D5' : '#EDEAE5'}`, borderRadius: '14px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: hovered ? '0 12px 30px rgba(0,0,0,0.10)' : '0 2px 10px rgba(0,0,0,0.04)', transform: hovered ? 'translateY(-3px)' : 'translateY(0)', transition: 'all 0.22s ease' }}
    >
      {/* 사진 */}
      {spot.imageUrl && (
        <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#F0EDE8' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={spot.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      <div style={{ padding: '20px 22px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* 카테고리 + 날짜 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontFamily: FONT_UI, fontSize: '9px', color, letterSpacing: '0.16em', fontWeight: 600 }}>{spot.category}</span>
          <span style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.06em' }}>{formatDate(spot.createdAt)}</span>
        </div>

        {/* 제목 */}
        {spot.title && (
          <p style={{ fontFamily: FONT_BRAND, fontSize: '22px', color: '#111', lineHeight: 1.3, marginBottom: '4px', wordBreak: 'keep-all' }}>{spot.title}</p>
        )}
        {/* 글쓴이 */}
        <p style={{ fontFamily: FONT_BRAND, fontSize: '13px', color: '#B5B0AB', marginBottom: '12px', letterSpacing: '0.02em' }}>by {spot.nickname || '익명'}</p>

        {/* 사연 */}
        <p style={{ fontFamily: FONT_UI, fontSize: '14px', color: '#2A2520', lineHeight: 1.85, wordBreak: 'keep-all', marginBottom: '18px', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', flex: 1 }}>
          {spot.moment}
        </p>

        {/* 장소 — 네이버 지도 외부 링크 */}
        <a
          href={naverUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '7px 14px', background: '#FFF5F5', borderRadius: '99px', fontFamily: FONT_UI, fontSize: '11px', color: '#800020', letterSpacing: '0.02em', textDecoration: 'none', transition: 'background 0.15s' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#FBE9E9' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#FFF5F5' }}
        >
          <span style={{ fontSize: '11px' }}>📍</span>
          {spot.placeName}
          <span style={{ color: '#C99', marginLeft: '2px' }}>· 네이버 지도에서 보기</span>
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '1px' }}>
            <line x1="4" y1="10" x2="15" y2="10" /><polyline points="10,5 15,10 10,15" />
          </svg>
        </a>
      </div>
    </article>
  )
}
