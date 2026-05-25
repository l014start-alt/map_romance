'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import RecordModal from '@/components/RecordModal'
import LocationPicker, { type PinData } from '@/components/LocationPicker'
import RegionSilhouette from '@/components/RegionSilhouette'
import Footer from '@/components/Footer'
import { reverseGeocode } from '@/lib/geocoding'
import { Spot, Category } from '@/types'

const LeafletMap = dynamic(() => import('@/components/NaverMap'), { ssr: false })

type View = 'landing' | 'map'
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

export default function App() {
  const [view, setView]                   = useState<View>('landing')
  const [fading, setFading]               = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [spots, setSpots]                 = useState<Spot[]>([])
  const [filter, setFilter]               = useState<Filter>('all')
  const [activeSpot, setActiveSpot]       = useState<Spot | null>(null)

  // 기록 단계: idle → picking(지도에서 위치 고르기) → form(폼 작성)
  const [phase, setPhase]   = useState<RecordPhase>('idle')
  const [pin, setPin]       = useState<PinData | null>(null)

  /* ── 스팟 초기 로딩 (localStorage + Supabase 병합) ── */
  useEffect(() => {
    let localSpots: Spot[] = []
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) localSpots = JSON.parse(raw) as Spot[]
    } catch { /* ignore */ }

    if (localSpots.length > 0) setSpots(localSpots)

    fetch('/api/spots?approved=true')
      .then((r) => r.json())
      .then((apiSpots: Spot[]) => {
        const apiIds = new Set(apiSpots.map((s) => s.id))
        const localOnly = localSpots.filter((s) => !apiIds.has(s.id))
        setSpots([...apiSpots, ...localOnly])
      })
      .catch(() => {})
  }, [])

  const filteredSpots = filter === 'all' ? spots : spots.filter((s) => s.category === filter)

  /* ── 뷰 전환 ── */
  const transition = (fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 260)
  }
  const goMap  = (region: Region) => transition(() => { setSelectedRegion(region); setView('map') })
  const goBack = () => transition(() => {
    setView('landing'); setActiveSpot(null)
    setPhase('idle'); setPin(null)
  })

  /* ── 지도 클릭 → 임시 핀 + 역지오코딩 ── */
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    // 즉시 임시 핀 표시 (주소는 로딩 중)
    setPin({ lat, lng, address: '주소 확인 중…' })
    const address = await reverseGeocode(lat, lng)
    setPin((prev) => prev ? { ...prev, address: address ?? '' } : prev)
  }, [])

  /* ── 기록하기 FAB 클릭 → picking 단계로 ── */
  const startPicking = () => {
    setPin(null)
    setPhase('picking')
    setActiveSpot(null)
  }

  /* ── picking 완료 → form 단계로 ── */
  const confirmPin = () => { if (pin) setPhase('form') }

  /* ── 폼 취소/닫기 ── */
  const closeRecord = () => { setPhase('idle'); setPin(null) }

  /* ── 폼 제출 ── */
  const handleSubmit = useCallback(async (data: {
    placeName: string; address?: string
    lat?: number; lng?: number
    category: Category; moment: string; nickname?: string
  }) => {
    const newSpot: Spot = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      placeName: data.placeName,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      category: data.category,
      moment: data.moment,
      nickname: data.nickname,
      approved: true,
      createdAt: new Date().toISOString(),
    }

    // 상태 즉시 반영 → 지도에 핀 실시간 생성
    setSpots((prev) => [newSpot, ...prev])

    // localStorage 영구 저장
    try {
      const raw = localStorage.getItem(LS_KEY)
      const existing: Spot[] = raw ? (JSON.parse(raw) as Spot[]) : []
      localStorage.setItem(LS_KEY, JSON.stringify([newSpot, ...existing]))
    } catch { /* ignore */ }

    // Supabase 백그라운드 전송 (approved:false, 관리자 검토용)
    fetch('/api/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {})
  }, [])

  /* ── 페이드 래퍼 ── */
  const pageStyle: React.CSSProperties = {
    opacity: fading ? 0 : 1,
    transition: 'opacity 0.26s ease',
    width: '100%', height: '100%',
  }

  /* ════════ LANDING VIEW ════════ */
  if (view === 'landing') {
    return (
      <div style={{ ...pageStyle, background: '#FAF8F5', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* 히어로 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '72px', paddingBottom: '52px', padding: '72px 24px 52px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '36px' }}>
            <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#800020' }} />
            <span style={{ fontFamily: FONT_BRAND, fontSize: '11px', color: '#800020', letterSpacing: '0.08em' }}>낭만여지도</span>
          </div>
          <h1 style={{ fontFamily: FONT_BRAND, fontSize: 'clamp(56px, 16vw, 88px)', color: '#111', letterSpacing: '-0.02em', lineHeight: 1.08, textAlign: 'center', marginBottom: '20px' }}>
            낭만여지도
          </h1>
          <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB', letterSpacing: '0.05em', textAlign: 'center', wordBreak: 'keep-all', lineHeight: 1.8 }}>
            우리들의 담백한 순간을 기록하는 지도
          </p>
        </div>

        {/* 지역 선택 */}
        <div style={{ flex: 1, padding: '0 20px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
            <span style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>여행지를 골라주세요</span>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {REGIONS.map((region) => <RegionCard key={region.id} region={region} onClick={goMap} />)}
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  /* ════════ MAP VIEW ════════ */
  return (
    <main style={{ ...pageStyle, position: 'relative' }}>

      {/* 지도 레이어 */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <LeafletMap
          spots={filteredSpots}
          onMarkerClick={phase === 'idle' ? setActiveSpot : undefined}
          center={selectedRegion ? [selectedRegion.lat, selectedRegion.lng] : undefined}
          zoom={selectedRegion?.zoom}
          tempPin={pin}
          onMapClick={phase === 'picking' ? handleMapClick : undefined}
        />
      </div>

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
          {FILTER_LABELS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ fontFamily: FONT_UI, fontSize: '11px', cursor: 'pointer', color: filter === f ? '#111' : '#C0BEBB', fontWeight: filter === f ? 500 : 400, borderBottom: filter === f ? '1px solid #111' : '1px solid transparent', paddingBottom: '2px', transition: 'all 0.2s' }}>
              {FILTER_KR[f]}
            </button>
          ))}
        </div>
      </header>

      {/* 마커 클릭 카드 (idle 상태에서만) */}
      {phase === 'idle' && activeSpot && (
        <div style={{ position: 'absolute', zIndex: 1000, bottom: '120px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '380px', background: '#FAF8F5', padding: '20px 22px', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
          <button onClick={() => setActiveSpot(null)} style={{ position: 'absolute', top: '14px', right: '16px', color: '#C0BEBB', fontSize: '11px', cursor: 'pointer', fontFamily: FONT_UI }}>✕</button>
          <p style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#800020', letterSpacing: '0.14em', marginBottom: '6px' }}>{activeSpot.category}</p>
          <p style={{ fontFamily: FONT_BRAND, fontSize: '17px', color: '#111', marginBottom: '4px' }}>{activeSpot.placeName}</p>
          {activeSpot.address && <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', marginBottom: '12px' }}>{activeSpot.address}</p>}
          <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#2A2520', lineHeight: 1.9, borderTop: '1px solid #EDE9E4', paddingTop: '12px', wordBreak: 'keep-all' }}>{activeSpot.moment}</p>
        </div>
      )}

      {/* 기록하기 FAB (idle 상태에서만) */}
      {phase === 'idle' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', paddingBottom: '36px', background: 'linear-gradient(to top, rgba(250,248,245,0.96) 45%, transparent)' }}>
          <button onClick={startPicking} style={{ fontFamily: FONT_BRAND, fontSize: '15px', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', padding: '13px 30px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 20px rgba(128,0,32,0.28)', cursor: 'pointer', transition: 'opacity 0.2s' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
            </svg>
            낭만 기록하기
          </button>
        </div>
      )}

      {/* 스팟 카운트 */}
      {phase === 'idle' && filteredSpots.length > 0 && (
        <p style={{ position: 'absolute', right: '20px', bottom: '40px', zIndex: 1000, fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.1em' }}>
          {filteredSpots.length}개의 낭만
        </p>
      )}

      {/* picking 단계: 지도 클릭 안내 바 */}
      {phase === 'picking' && (
        <LocationPicker
          pin={pin}
          onPinUpdate={setPin}
          onConfirm={confirmPin}
          onCancel={closeRecord}
        />
      )}

      {/* form 단계: 기록 폼 */}
      {phase === 'form' && (
        <RecordModal
          pin={pin}
          onClose={closeRecord}
          onSubmit={handleSubmit}
        />
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
