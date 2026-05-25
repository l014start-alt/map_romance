'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import RecordModal from '@/components/RecordModal'
import RegionSilhouette from '@/components/RegionSilhouette'
import Footer from '@/components/Footer'
import { Spot, Category } from '@/types'

const LeafletMap = dynamic(() => import('@/components/NaverMap'), { ssr: false })

/* ── 타입 ── */
type View = 'landing' | 'map'
type Filter = 'all' | Category

interface Region {
  id: string
  name: string
  emoji: string
  lat: number
  lng: number
  zoom: number
  mood: string
}

/* ── 지역 데이터 ── */
const REGIONS: Region[] = [
  { id: 'seoul',    name: '서울', emoji: '🏙️', lat: 37.5665,  lng: 126.9780,  zoom: 13, mood: '골목과 지붕이 겹치는 곳' },
  { id: 'busan',    name: '부산', emoji: '🌊', lat: 35.1796,  lng: 129.0756,  zoom: 13, mood: '파도가 쓰는 일기' },
  { id: 'daegu',    name: '대구', emoji: '🍎', lat: 35.8714,  lng: 128.6014,  zoom: 13, mood: '뜨겁고 달콤한 여름' },
  { id: 'jeju',     name: '제주', emoji: '🍊', lat: 33.4996,  lng: 126.5312,  zoom: 12, mood: '바람이 남긴 문장' },
  { id: 'daejeon',  name: '대전', emoji: '🌙', lat: 36.3504,  lng: 127.3845,  zoom: 13, mood: '느린 밤의 온도' },
  { id: 'gwangju',  name: '광주', emoji: '🌸', lat: 35.1595,  lng: 126.8526,  zoom: 13, mood: '예술이 피어나는 봄' },
  { id: 'gyeongju', name: '경주', emoji: '🏺', lat: 35.8562,  lng: 129.2247,  zoom: 13, mood: '천 년의 낭만' },
  { id: 'gangneung',name: '강릉', emoji: '☕', lat: 37.7519,  lng: 128.8761,  zoom: 13, mood: '커피향이 파도처럼' },
]

const FONT_BRAND = 'var(--font-brand)'
const FONT_UI    = 'var(--font-sans)'

const FILTER_LABELS: Filter[] = ['all', '낭만', '젊음', '사랑']
const FILTER_KR: Record<Filter, string> = { all: '전체', 낭만: '낭만', 젊음: '젊음', 사랑: '사랑' }

/* ════════════════════════════════════ */
export default function App() {
  const [view, setView] = useState<View>('landing')
  const [fading, setFading] = useState(false)
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [filter, setFilter] = useState<Filter>('all')

  // localStorage 로컬 스팟 + Supabase 승인 스팟 병합 로딩
  useEffect(() => {
    const LS_KEY = 'map_romance_local_spots'
    let localSpots: Spot[] = []
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) localSpots = JSON.parse(raw) as Spot[]
    } catch { /* ignore */ }

    // 로컬 스팟 먼저 즉시 표시
    if (localSpots.length > 0) setSpots(localSpots)

    // API 스팟 불러와서 병합 (중복 제거: API 스팟 우선)
    fetch('/api/spots?approved=true')
      .then((r) => r.json())
      .then((apiSpots: Spot[]) => {
        const apiIds = new Set(apiSpots.map((s) => s.id))
        const localOnly = localSpots.filter((s) => !apiIds.has(s.id))
        setSpots([...apiSpots, ...localOnly])
      })
      .catch(() => {})
  }, [])
  const [showModal, setShowModal] = useState(false)
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null)

  const filteredSpots = filter === 'all' ? spots : spots.filter(s => s.category === filter)

  const transition = (fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 260)
  }

  const goMap = (region: Region) => transition(() => {
    setSelectedRegion(region)
    setView('map')
  })

  const goBack = () => transition(() => {
    setView('landing')
    setActiveSpot(null)
    setShowModal(false)
  })

  const handleSubmit = useCallback(async (data: {
    placeName: string; address?: string
    lat?: number; lng?: number
    category: Category; moment: string; nickname?: string
  }) => {
    const LS_KEY = 'map_romance_local_spots'

    // 로컬에서 즉시 approved:true로 표시할 스팟 생성
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

    // localStorage 저장 → 새로고침 후에도 유지
    try {
      const raw = localStorage.getItem(LS_KEY)
      const existing: Spot[] = raw ? (JSON.parse(raw) as Spot[]) : []
      localStorage.setItem(LS_KEY, JSON.stringify([newSpot, ...existing]))
    } catch { /* ignore */ }

    // Supabase에도 백그라운드 전송 (approved:false, 관리자 검토용)
    fetch('/api/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {})
  }, [])

  /* ── 공통 페이드 래퍼 ── */
  const pageStyle: React.CSSProperties = {
    opacity: fading ? 0 : 1,
    transition: 'opacity 0.26s ease',
    width: '100%',
    height: '100%',
  }

  /* ════════ LANDING VIEW ════════ */
  if (view === 'landing') {
    return (
      <div style={{ ...pageStyle, background: '#FAF8F5', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* ── 히어로 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '72px', paddingBottom: '52px', paddingLeft: '24px', paddingRight: '24px' }}>

          {/* 브랜드 마크 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '36px' }}>
            <span style={{ display: 'inline-block', width: '5px', height: '5px', borderRadius: '50%', background: '#800020' }} />
            <span style={{ fontFamily: FONT_BRAND, fontSize: '11px', color: '#800020', letterSpacing: '0.08em' }}>
              낭만여지도
            </span>
          </div>

          {/* 메인 타이틀 */}
          <h1 style={{
            fontFamily: FONT_BRAND,
            fontSize: 'clamp(56px, 16vw, 88px)',
            color: '#111',
            letterSpacing: '-0.02em',
            lineHeight: 1.08,
            textAlign: 'center',
            marginBottom: '20px',
          }}>
            낭만여지도
          </h1>

          {/* 슬로건 */}
          <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB', letterSpacing: '0.05em', textAlign: 'center', wordBreak: 'keep-all', lineHeight: 1.8 }}>
            우리들의 담백한 순간을 기록하는 지도
          </p>
        </div>

        {/* ── 지역 선택 ── */}
        <div style={{ flex: 1, padding: '0 20px 60px' }}>

          {/* 구분선 + 안내 텍스트 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
            <span style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>
              여행지를 골라주세요
            </span>
            <div style={{ flex: 1, height: '1px', background: '#EDE9E4' }} />
          </div>

          {/* 지역 카드 그리드 — 4열 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {REGIONS.map(region => (
              <RegionCard key={region.id} region={region} onClick={goMap} />
            ))}
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
          onMarkerClick={setActiveSpot}
          center={selectedRegion ? [selectedRegion.lat, selectedRegion.lng] : undefined}
          zoom={selectedRegion?.zoom}
        />
      </div>

      {/* ── 헤더 ── */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'linear-gradient(to bottom, rgba(250,248,245,0.96) 55%, transparent)',
      }}>
        {/* 뒤로가기 */}
        <button
          onClick={goBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560',
            cursor: 'pointer', minWidth: '44px', minHeight: '44px', padding: '0 6px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13,4 7,10 13,16" />
          </svg>
          지역 선택
        </button>

        {/* 센터 타이틀 */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: FONT_BRAND, fontSize: '17px', color: '#800020', lineHeight: 1.1 }}>
            낭만여지도
          </p>
          {selectedRegion && (
            <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', letterSpacing: '0.06em', marginTop: '2px' }}>
              {selectedRegion.emoji} {selectedRegion.name}
            </p>
          )}
        </div>

        {/* 카테고리 필터 */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {FILTER_LABELS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: FONT_UI, fontSize: '11px', cursor: 'pointer',
              color: filter === f ? '#111' : '#C0BEBB',
              fontWeight: filter === f ? 500 : 400,
              borderBottom: filter === f ? '1px solid #111' : '1px solid transparent',
              paddingBottom: '2px',
              transition: 'all 0.2s',
            }}>
              {FILTER_KR[f]}
            </button>
          ))}
        </div>
      </header>

      {/* ── 마커 클릭 카드 ── */}
      {activeSpot && (
        <div style={{
          position: 'absolute', zIndex: 1000,
          bottom: '120px', left: '50%', transform: 'translateX(-50%)',
          width: 'calc(100% - 40px)', maxWidth: '380px',
          background: '#FAF8F5', padding: '20px 22px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        }}>
          <button onClick={() => setActiveSpot(null)} style={{ position: 'absolute', top: '14px', right: '16px', color: '#C0BEBB', fontSize: '11px', cursor: 'pointer', fontFamily: FONT_UI }}>✕</button>
          <p style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#800020', letterSpacing: '0.14em', marginBottom: '6px' }}>
            {activeSpot.category}
          </p>
          <p style={{ fontFamily: FONT_BRAND, fontSize: '17px', color: '#111', marginBottom: '4px', letterSpacing: '-0.01em' }}>
            {activeSpot.placeName}
          </p>
          {activeSpot.address && (
            <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', marginBottom: '12px' }}>
              {activeSpot.address}
            </p>
          )}
          <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#2A2520', lineHeight: '1.9', borderTop: '1px solid #EDE9E4', paddingTop: '12px', wordBreak: 'keep-all' }}>
            {activeSpot.moment}
          </p>
        </div>
      )}

      {/* ── 기록하기 FAB ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
        display: 'flex', justifyContent: 'center', paddingBottom: '36px',
        background: 'linear-gradient(to top, rgba(250,248,245,0.96) 45%, transparent)',
      }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            fontFamily: FONT_BRAND, fontSize: '15px', letterSpacing: '0.04em',
            color: '#FAF8F5', background: '#800020',
            padding: '13px 30px',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 20px rgba(128,0,32,0.28)',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <line x1="6" y1="1" x2="6" y2="11" />
            <line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          낭만 기록하기
        </button>
      </div>

      {/* 스팟 카운트 */}
      {spots.length > 0 && (
        <p style={{
          position: 'absolute', right: '20px', bottom: '40px', zIndex: 1000,
          fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.1em',
        }}>
          {filteredSpots.length}개의 낭만
        </p>
      )}

      {/* 기록 모달 — position:absolute로 지도 위를 완전히 덮음 */}
      {showModal && (
        <RecordModal
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          defaultCenter={selectedRegion ? { lat: selectedRegion.lat, lng: selectedRegion.lng } : undefined}
        />
      )}
    </main>
  )
}

/* ── 지역 카드 컴포넌트 ── */
function RegionCard({ region, onClick }: { region: Region; onClick: (r: Region) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => onClick(region)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '22px 12px 18px',
        background: hovered ? '#FFF8F8' : '#FFFFFF',
        border: `1px solid ${hovered ? '#800020' : '#EDEAE5'}`,
        cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 24px rgba(128,0,32,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'all 0.22s ease',
        gap: '10px',
      }}
    >
      <RegionSilhouette regionId={region.id} size={68} />
      <span style={{ fontFamily: FONT_BRAND, fontSize: '22px', color: hovered ? '#800020' : '#2A2520', lineHeight: 1.1 }}>
        {region.name}
      </span>
      <span style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.04em', textAlign: 'center', wordBreak: 'keep-all', lineHeight: 1.6 }}>
        {region.mood}
      </span>
    </button>
  )
}
