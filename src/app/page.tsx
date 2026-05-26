'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import RecordModal from '@/components/RecordModal'
import LocationPicker, { type PinData } from '@/components/LocationPicker'
import SpotSheet from '@/components/SpotSheet'
import FeedView from '@/components/FeedView'
import RegionSilhouette from '@/components/RegionSilhouette'
import DaeguMap from '@/components/DaeguMap'
import Footer from '@/components/Footer'
import { reverseGeocode } from '@/lib/geocoding'
import { Spot, Category, LocationGroup } from '@/types'
import { MOCK_SPOTS } from '@/lib/mockData'

const LeafletMap = dynamic(() => import('@/components/NaverMap'), { ssr: false })

type View = 'landing' | 'map'
type Tab  = 'map' | 'feed'
type RecordPhase = 'idle' | 'picking' | 'form'
type Filter = 'all' | Category

interface Region {
  id: string; name: string; emoji: string
  lat: number; lng: number; zoom: number; mood: string
}

const REGIONS: Region[] = [
  { id: 'seoul',     name: '서울', emoji: '🏙️', lat: 37.5665,  lng: 126.9780, zoom: 13, mood: '골목과 지붕이 겹치는 곳' },
  { id: 'busan',     name: '부산', emoji: '🌊', lat: 35.1796,  lng: 129.0756, zoom: 13, mood: '파도가 쓰는 일기' },
  { id: 'daegu',     name: '대구', emoji: '🍎', lat: 35.8714,  lng: 128.6014, zoom: 13, mood: '뜨겁고 달콤한 여름' },
  { id: 'jeju',      name: '제주', emoji: '🍊', lat: 33.4996,  lng: 126.5312, zoom: 12, mood: '바람이 남긴 문장' },
  { id: 'daejeon',   name: '대전', emoji: '🌙', lat: 36.3504,  lng: 127.3845, zoom: 13, mood: '느린 밤의 온도' },
  { id: 'gwangju',   name: '광주', emoji: '🌸', lat: 35.1595,  lng: 126.8526, zoom: 13, mood: '예술이 피어나는 봄' },
  { id: 'gyeongju',  name: '경주', emoji: '🏺', lat: 35.8562,  lng: 129.2247, zoom: 13, mood: '천 년의 낭만' },
  { id: 'gangneung', name: '강릉', emoji: '☕', lat: 37.7519,  lng: 128.8761, zoom: 13, mood: '커피향이 파도처럼' },
]

const FONT_BRAND = 'var(--font-brand)'
const FONT_UI    = 'var(--font-sans)'
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

  const [phase, setPhase]   = useState<RecordPhase>('idle')
  const [pin, setPin]       = useState<PinData | null>(null)

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
    setView('map')
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
    setTab(newTab)
  }

  /* ── 지도 클릭 → 역지오코딩 ── */
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    setPin({ lat, lng, address: '주소 확인 중…' })
    const address = await reverseGeocode(lat, lng)
    setPin(prev => prev ? { ...prev, address: address ?? '' } : prev)
  }, [])

  const startPicking = () => { setPin(null); setPhase('picking'); setActiveGroupKey(null) }
  const confirmPin   = () => { if (pin) setPhase('form') }
  const closeRecord  = () => { setPhase('idle'); setPin(null) }

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
    setMapFlyTarget({ center: [spot.lat, spot.lng], zoom: 16 })
    setActiveGroupKey(spot.placeName.trim().toLowerCase())
    setTab('map')
  }, [])

  const pageStyle: React.CSSProperties = {
    opacity: fading ? 0 : 1,
    transition: 'opacity 0.26s ease',
    width: '100%', height: '100%',
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

        {/* 대구 행정구역 인터랙티브 지도 */}
        <div style={{ width: '100%', padding: '24px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
            <span style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>대구 행정구역</span>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
          </div>
          <DaeguMap
            onRegionClick={() => {
              const daegu = REGIONS.find(r => r.id === 'daegu')
              if (daegu) goMap(daegu)
            }}
          />
        </div>

        {/* 지역 선택 섹션 */}
        <div style={{ flex: 1, padding: '0 20px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '28px 0 24px' }}>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
            <span style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>여행지를 골라주세요</span>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {REGIONS.map(region => <RegionCard key={region.id} region={region} onClick={goMap} />)}
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  /* ════════ MAP VIEW ════════ */
  const mapCenter = mapFlyTarget?.center ?? (selectedRegion ? [selectedRegion.lat, selectedRegion.lng] as [number, number] : undefined)
  const mapZoom   = mapFlyTarget?.zoom   ?? selectedRegion?.zoom

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
          onMapClick={tab === 'map' && phase === 'picking' ? handleMapClick : undefined}
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
            <LocationPicker pin={pin} onPinUpdate={setPin} onConfirm={confirmPin} onCancel={closeRecord} />
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

      {/* 하단 탭 바 — picking/form 중에는 숨김 */}
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

/* ── 지역 카드 ── */
function RegionCard({ region, onClick }: { region: Region; onClick: (r: Region) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button onClick={() => onClick(region)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '22px 12px 18px', background: hovered ? '#FFF8F8' : '#FFFFFF', border: `1px solid ${hovered ? '#800020' : '#EDEAE5'}`, cursor: 'pointer', transform: hovered ? 'translateY(-3px)' : 'translateY(0)', boxShadow: hovered ? '0 8px 24px rgba(128,0,32,0.12)' : '0 1px 4px rgba(0,0,0,0.04)', transition: 'all 0.22s ease', gap: '10px' }}>
      <RegionSilhouette regionId={region.id} size={68} />
      <span style={{ fontFamily: FONT_BRAND, fontSize: '22px', color: hovered ? '#800020' : '#2A2520', lineHeight: 1.1 }}>{region.name}</span>
      <span style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.04em', textAlign: 'center', wordBreak: 'keep-all', lineHeight: 1.6 }}>{region.mood}</span>
    </button>
  )
}
