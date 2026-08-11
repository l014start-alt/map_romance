'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import RecordModal from '@/components/RecordModal'
import LocationPicker, { type PinData } from '@/components/LocationPicker'
import PlacePreviewCard from '@/components/PlacePreviewCard'
import SpotSheet from '@/components/SpotSheet'
import FeedView from '@/components/FeedView'
import Footer from '@/components/Footer'
import StoryFeed from '@/components/StoryFeed'             // 사연 피드(시간순 그리드 + 좌지도/우내용)
import ConstellationMap from '@/components/ConstellationMap' // 별자리 지도(지도로 보기)
import { Spot, Category, LocationGroup } from '@/types'
import { MOCK_SPOTS } from '@/lib/mockData'
import { saveVisitorSelection, setCollectionExcluded } from '@/lib/visitorStats' // 요구사항 3: 선택 통계 저장

const LeafletMap = dynamic(() => import('@/components/NaverMap'), { ssr: false })

type View = 'landing' | 'intro' | 'read' | 'map'  // read: 새 두번째 페이지(엽서/별자리)
type SecondView = 'read' | 'constellation'        // 엽서 리더 ↔ 별자리 지도 토글
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

  // 요구사항 2: 입장 시 선택한 캐릭터/지역 (헤더 뱃지 표시용)
  const [visitor, setVisitor]     = useState<{ characterId: string; region: string } | null>(null)
  // 새 두번째 페이지 모드: 별자리 지도(기본) ↔ 엽서 리더
  const [secondView, setSecondView] = useState<SecondView>('constellation')
  // 지도에서 특정 장소를 눌러 사연으로 들어올 때 시작 장소
  const [readerStart, setReaderStart] = useState<string | null>(null)

  const isDesktop = useIsDesktop()

  const filteredSpots  = filter === 'all' ? spots : spots.filter(s => s.category === filter)
  const filteredGroups = groupSpots(filteredSpots)
  const activeGroup    = activeGroupKey ? filteredGroups.find(g => g.key === activeGroupKey) ?? null : null

  /* ── 통계 수집 제외 스위치: 주소에 ?nolog=1(제외) / ?nolog=0(해제)로 접속하면
        이 기기에 표시가 저장돼, 사장님 본인 기기·테스트 선택은 통계에서 빠진다. ── */
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search).get('nolog')
      if (p === '1') setCollectionExcluded(true)
      else if (p === '0') setCollectionExcluded(false)
    } catch { /* ignore */ }
  }, [])

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

  /* ── 입장 처리 — 선택값 저장(통계) + 헤더 뱃지용 state + 인트로(2단계)로 ── */
  const enterWithSelection = (characterId: string, region: string) => {
    setVisitor({ characterId, region })       // 요구사항 2: 헤더에 표시
    saveVisitorSelection(characterId, region) // 요구사항 3: LocalStorage 통계 저장(+백엔드 훅)
    transition(() => setView('intro'))         // D안: 곧장 지도가 아니라 환영 인트로부터
  }

  /* ── 인트로 → 새 두번째 페이지: 별자리 지도부터 진입 ── */
  const goSecond = () => transition(() => {
    setSelectedRegion(DAEGU)
    setSecondView('constellation')  // 입장하면 지도가 먼저
    setReaderStart(null)
    setView('read')
  })

  /* 지도의 장소 → 그곳의 사연으로 진입 */
  const openStories = (placeName: string) => { setReaderStart(placeName); setSecondView('read') }
  const goBack = () => transition(() => {
    setView('landing'); setActiveGroupKey(null)
    setPhase('idle'); setPin(null)
  })
  /* read 화면 하단 바: '돌아가기'는 환영 인트로로 한 단계, '처음으로'는 맨 처음(입장)으로 초기화 */
  const goIntro = () => transition(() => { setPhase('idle'); setPin(null); setView('intro') })

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
    title?: string; sns?: string; imageUrl?: string; password?: string
  }) => {
    const newSpot: Spot = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      placeName: data.placeName, address: data.address,
      lat: data.lat, lng: data.lng,
      category: data.category, moment: data.moment,
      nickname: data.nickname, title: data.title, sns: data.sns,
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
        nickname: data.nickname, title: data.title, sns: data.sns,
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

        {/* 좌측 — 히어로 일러스트 (화면 절반 고정) */}
        <div style={{ width: '50%', flexShrink: 0, height: '100%', background: '#FAF8F5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', borderRight: '1px solid #EDE9E4' }}>
          <Image
            src="/hero-map.png"
            alt="낭만여지도"
            width={773}
            height={1100}
            priority
            style={{ width: 'auto', height: '100%', maxWidth: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* 우측 — 화면 절반: (위)입장 게이트 + (아래)2단 분할 Footer */}
        <div style={{ width: '50%', flexShrink: 0, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 56px' }}>
            <EntryGate onStart={enterWithSelection} desktop />
          </div>
          {/* 우측 영역 하단을 좌(상호+주소)/우(나머지)로 분할 */}
          <Footer />
        </div>
      </div>
    )
  }

  /* ════════ LANDING VIEW ════════ */
  if (view === 'landing') {
    return (
      <div style={{ ...pageStyle, background: '#FAF8F5', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* 히어로 섹션 — 전체 일러스트 이미지 (상단 선은 이미지 파일에서 제거 완료) */}
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

        {/* 입장 게이트 — 캐릭터/지역 선택 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '28px 20px 40px' }}>
          <EntryGate onStart={enterWithSelection} />
        </div>

        {/* 소개글 — 좌(상호+주소)/우(나머지) 2단 분할 */}
        <Footer />
      </div>
    )
  }

  /* ════════ INTRO VIEW — D안: 입장 직후 환영 인트로(2단계) ════════ */
  if (view === 'intro' && visitor) {
    return (
      <div style={pageStyle}>
        <EntryIntro
          characterId={visitor.characterId}
          region={visitor.region}
          onEnter={goSecond}   // 버튼 → 새 두번째 페이지(엽서 리더)로 진입
          onBack={goBack}      // 다시 고르기 → 랜딩
        />
      </div>
    )
  }

  /* ════════ SECOND PAGE — 엽서 리더 + 별자리 지도 토글 (새 구성) ════════ */
  if (view === 'read') {
    const readerSpots = [...filteredSpots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const isRead = secondView === 'read'
    const segBtn = (active: boolean): React.CSSProperties => ({
      fontFamily: FONT_UI, fontSize: '12px', letterSpacing: '0.04em', padding: '7px 16px', borderRadius: '99px', cursor: 'pointer',
      background: active ? '#800020' : 'transparent', color: active ? '#FAF8F5' : '#8A8480', fontWeight: active ? 500 : 400, transition: 'all 0.16s',
    })
    const dark = secondView === 'constellation'  // 별자리(우주) 모드일 때 헤더/배경도 어둡게
    return (
      <div style={{ ...pageStyle, position: 'relative', background: dark ? '#0d0b1e' : '#FAF8F5', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 헤더 */}
        <header style={{ flexShrink: 0, borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #EDE9E4', background: dark ? '#141130' : '#FAF8F5', zIndex: 10, transition: 'background 0.3s, border-color 0.3s' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: isDesktop ? '16px 32px' : '12px 16px' }}>
            {/* 좌 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '18px' : '10px', minWidth: 0 }}>
              {/* 모바일: 상단 돌아가기(아이콘) / 데스크탑: 하단 바로 이동 */}
              {!isDesktop && (
                <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: dark ? 'rgba(233,231,247,0.7)' : '#6B6560', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
                </button>
              )}
              <span style={{ fontFamily: FONT_BRAND, fontSize: isDesktop ? '26px' : '19px', color: dark ? '#F4D58A' : '#800020', lineHeight: 1 }}>낭만여지도</span>
              {isDesktop && visitor && <VisitorBadge characterId={visitor.characterId} region={visitor.region} />}
            </div>
            {/* 우 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? '14px' : '8px', flexShrink: 0 }}>
              {/* 지도 ↔ 사연 토글 (지도가 기본) */}
              <div style={{ display: 'flex', gap: '2px', background: dark ? 'rgba(255,255,255,0.08)' : '#F2EEE9', borderRadius: '99px', padding: '3px' }}>
                <button onClick={() => setSecondView('constellation')} style={segBtn(!isRead)}>지도</button>
                <button onClick={() => { setReaderStart(null); setSecondView('read') }} style={segBtn(isRead)}>사연</button>
              </div>
              {/* 기록하기 — 모바일만 상단(아이콘). 데스크탑은 하단 바로 이동 */}
              {!isDesktop && (
                <button onClick={startPicking} style={{ fontFamily: FONT_BRAND, fontSize: '0', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', padding: '9px', borderRadius: '50%', display: 'flex', alignItems: 'center', gap: '7px', boxShadow: '0 4px 14px rgba(128,0,32,0.22)', cursor: 'pointer', flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
                </button>
              )}
            </div>
          </div>
          {/* 카테고리 필터 제거 — 사연을 하나의 흐름으로 봄 */}
        </header>

        {/* 본문 */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {isRead
            ? <StoryFeed spots={readerSpots} startPlaceName={readerStart ?? undefined} desktop={isDesktop} />
            : <ConstellationMap embedded spots={filteredSpots} onOpenStories={openStories} />}
        </div>

        {/* 데스크탑(키오스크) 하단 고정 바 — 돌아가기 · 처음으로 · 낭만여지도 남기기 */}
        {isDesktop && (
          <footer style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '16px 32px', borderTop: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #EDE9E4', background: dark ? '#141130' : '#FAF8F5', transition: 'background 0.3s, border-color 0.3s', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={goIntro} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT_UI, fontSize: '14px', color: dark ? 'rgba(233,231,247,0.82)' : '#6B6560', background: 'transparent', border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : '#E4DFD9'}`, borderRadius: '10px', padding: '11px 20px', cursor: 'pointer', transition: 'all 0.16s' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
                돌아가기
              </button>
              <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT_UI, fontSize: '14px', color: dark ? 'rgba(233,231,247,0.82)' : '#6B6560', background: 'transparent', border: `1px solid ${dark ? 'rgba(255,255,255,0.18)' : '#E4DFD9'}`, borderRadius: '10px', padding: '11px 20px', cursor: 'pointer', transition: 'all 0.16s' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a6 6 0 1 1 1.8 4.3" /><polyline points="4,15 4,10 9,10" /></svg>
                처음으로
              </button>
            </div>
            <button onClick={startPicking} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontFamily: FONT_BRAND, fontSize: '20px', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', border: 'none', borderRadius: '12px', padding: '13px 34px', boxShadow: '0 4px 16px rgba(128,0,32,0.26)', cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
              낭만여지도 남기기
            </button>
          </footer>
        )}

        {/* 기록 오버레이 — 검색 기반(지도 불필요), 데스크탑/모바일 공용 */}
        {phase === 'picking' && (
          <LocationPicker desktop pin={pin} onPinUpdate={handlePinUpdate} onMapFlyTo={handleMapFlyTo} onConfirm={confirmPin} onCancel={closeRecord} />
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

  /* ════════ MAP VIEW (구버전 — 현재 흐름에서는 진입하지 않음, 참고/폴백용) ════════ */
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
            {/* 요구사항 2: 선택한 캐릭터 아이콘 + 지역 뱃지 */}
            {visitor && <VisitorBadge characterId={visitor.characterId} region={visitor.region} />}
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
              낭만여지도 남기기
            </button>
          </div>
        </header>

        {/* 갤러리 */}
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          {gallerySpots.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <p style={{ fontFamily: FONT_BRAND, fontSize: '26px', color: '#C0BEBB' }}>아직 사연이 없어요</p>
              <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#DED9D3' }}>‘낭만여지도 남기기’로 첫 사연을 남겨보세요</p>
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

      {/* 요구사항 2(모바일): 선택 캐릭터+지역 뱃지 — 헤더 아래 중앙에 작게 떠 있음 */}
      {phase === 'idle' && visitor && (
        <div style={{ position: 'absolute', top: '52px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', borderRadius: '99px' }}>
          <VisitorBadge characterId={visitor.characterId} region={visitor.region} compact />
        </div>
      )}

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
                낭만여지도 남기기
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

/* ══════════════════════════════════════════════════════════
   변경: 입장 사진 촬영(CameraBooth/DaeguStart) 기능 삭제
   → 캐릭터 선택 + 출신 지역 선택 후 '입장하기' 게이트로 교체
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   변경: 캐릭터 아이콘을 '낭만여지도' 일러스트(hero-map.png) 속
   요소들로 교체. public/characters/*.png 에 저장돼 있음.
   ▶ 다른 스프라이트/이미지로 바꾸려면 아래 src 경로만 수정하면 됩니다.
     (예: '/characters/beer.png' → 원하는 파일 경로로 교체)
   ══════════════════════════════════════════════════════════ */
const CHARACTERS: { id: string; name: string; src: string }[] = [
  { id: 'beer',     name: '맥주',   src: '/characters/beer.png' },
  { id: 'sun',      name: '태양',   src: '/characters/sun.png' },
  { id: 'car',      name: '자동차', src: '/characters/car.png' },
  { id: 'wine',     name: '와인',   src: '/characters/wine.png' },
  { id: 'mountain', name: '산',     src: '/characters/mountain.png' },
  { id: 'clock',    name: '시계',   src: '/characters/clock.png' },
  { id: 'pin',      name: '지도핀', src: '/characters/pin.png' },
  { id: 'music',    name: '음악',   src: '/characters/music.png' },
]

/* 변경: 어느 지역에서 왔는지 — 전국 17개 시·도(광역 지자체)로 확대 */
const ORIGINS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

/* 캐릭터 id → 캐릭터 정보 조회 (헤더 뱃지 등에서 사용) */
const getCharacter = (id: string | null | undefined) => CHARACTERS.find(c => c.id === id)

/* ── 입장 후 헤더 뱃지 — 선택한 캐릭터 아이콘 + 지역 이름 (요구사항 2) ── */
function VisitorBadge({ characterId, region, compact = false }: { characterId: string; region: string; compact?: boolean }) {
  const ch = getCharacter(characterId)
  if (!ch) return null
  const size = compact ? 20 : 24
  return (
    <div
      title={`${ch.name} · ${region}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: compact ? '4px 10px 4px 6px' : '5px 12px 5px 6px',
        borderRadius: '99px', background: '#FFF5F5', border: '1px solid #F0E0E0',
      }}
    >
      <span style={{ width: size, height: size, borderRadius: '50%', background: '#FFFFFF', border: '1px solid #EDE9E4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ch.src} alt={ch.name} style={{ width: '68%', height: '68%', objectFit: 'contain' }} />
      </span>
      <span style={{ fontFamily: FONT_UI, fontSize: compact ? '11px' : '12px', color: '#800020', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
        {region}에서 오심
      </span>
    </div>
  )
}

/* ── 타자 치듯 한 글자씩 나타나는 효과(너무 빠르지 않게, 문장부호에서 잠깐 쉼) ── */
function useTypewriter(text: string, speed: number, startDelay = 0, enabled = true) {
  const [out, setOut] = useState('')
  useEffect(() => {
    if (!enabled) return
    setOut('')
    let i = 0
    let t: ReturnType<typeof setTimeout>
    const step = () => {
      i += 1
      setOut(text.slice(0, i))
      if (i >= text.length) return
      const prev = text[i - 1]
      t = setTimeout(step, /[.,·…?!\n]/.test(prev) ? speed * 6 : speed)
    }
    t = setTimeout(step, startDelay)
    return () => clearTimeout(t)
  }, [text, speed, startDelay, enabled])
  return out
}

/* ── D안: 입장 직후 환영 인트로 (캐릭터·지역 활용, 담백/여백 중심) ── */
function EntryIntro({ characterId, region, onEnter, onBack }: { characterId: string; region: string; onEnter: () => void; onBack: () => void }) {
  const ch = getCharacter(characterId)
  const [hovered, setHovered] = useState(false)
  // 환영 문구 → 리드 문장 순서로 타이핑
  const headingText = `${region}에서 오신 걸\n환영해요`
  const leadText = '여기, 우리가 머물렀던 이야기들이 지도가 되어 있어요.\n천천히 둘러보세요.'
  const typedHeading = useTypewriter(headingText, 110, 350)
  const headingDone = typedHeading.length >= headingText.length
  const typedLead = useTypewriter(leadText, 62, 250, headingDone)
  const leadDone = typedLead.length >= leadText.length
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#FAF8F5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>

      {/* 선택한 캐릭터 — 크게(약 2배) */}
      <div className="const-node" style={{ position: 'relative', width: '200px', height: '200px', borderRadius: '50%', background: '#FFFFFF', border: '1px solid #EDE9E4', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(128,0,32,0.10)', marginBottom: '34px' }}>
        {ch && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ch.src} alt={ch.name} style={{ width: '60%', height: '60%', objectFit: 'contain' }} />
        )}
      </div>

      {/* eyebrow */}
      <p style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.22em', color: '#B5B0AB', marginBottom: '16px' }}>NANGMAN YEOJIDO</p>

      {/* 환영 문구 — 지역 활용 (타자 효과) */}
      <h1 style={{ fontFamily: FONT_BRAND, fontSize: '38px', lineHeight: 1.3, color: '#800020', wordBreak: 'keep-all', margin: 0, whiteSpace: 'pre-line', minHeight: '99px' }}>
        {typedHeading}
        {!headingDone && <span style={{ display: 'inline-block', width: '2px', height: '0.82em', background: '#800020', marginLeft: '3px', verticalAlign: '-0.06em', animation: 'tw-blink 1s step-end infinite' }} />}
      </h1>

      {/* 리드 문장 (타자 효과 — 환영 문구가 끝난 뒤 시작) */}
      <p style={{ fontFamily: FONT_UI, fontSize: '14px', lineHeight: 2, color: '#8A8480', wordBreak: 'keep-all', maxWidth: '360px', marginTop: '20px', whiteSpace: 'pre-line', minHeight: '56px' }}>
        {typedLead}
        {headingDone && !leadDone && <span style={{ display: 'inline-block', width: '2px', height: '0.9em', background: '#B5B0AB', marginLeft: '2px', verticalAlign: '-0.1em', animation: 'tw-blink 1s step-end infinite' }} />}
      </p>

      {/* CTA — 지도로 진입 */}
      <button
        onClick={onEnter}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontFamily: FONT_BRAND, fontSize: '22px', letterSpacing: '0.04em', color: '#FAF8F5', background: '#800020', padding: '15px 40px', marginTop: '40px', cursor: 'pointer', transform: hovered ? 'translateY(-2px)' : 'translateY(0)', boxShadow: hovered ? '0 10px 30px rgba(128,0,32,0.32)' : '0 4px 18px rgba(128,0,32,0.22)', transition: 'all 0.2s ease' }}
      >
        낭만여지도 보러가기
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" y1="10" x2="15" y2="10" /><polyline points="10,5 15,10 10,15" />
        </svg>
      </button>

      {/* 다시 고르기 */}
      <button onClick={onBack} style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB', background: 'transparent', cursor: 'pointer', marginTop: '18px', padding: '6px 10px' }}>
        다시 고르기
      </button>
    </div>
  )
}

/* 단계 라벨 (①/② 스텝 표시) */
function StepLabel({ n, text, desktop = false }: { n: number; text: string; desktop?: boolean }) {
  const d = desktop
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: d ? '10px' : '8px' }}>
      <span style={{ width: d ? '26px' : '20px', height: d ? '26px' : '20px', borderRadius: '50%', background: '#800020', color: '#FAF8F5', fontFamily: FONT_UI, fontSize: d ? '14px' : '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</span>
      <span style={{ fontFamily: FONT_UI, fontSize: d ? '17px' : '13px', color: '#2A2520', letterSpacing: '0.02em' }}>{text}</span>
    </div>
  )
}

/* ── 입장 게이트 — 캐릭터 + 지역을 모두 선택해야 입장 버튼 활성화 ── */
function EntryGate({ onStart, desktop = false }: { onStart: (characterId: string, region: string) => void; desktop?: boolean }) {
  const [character, setCharacter] = useState<string | null>(null)   // 선택한 캐릭터 id
  const [origin, setOrigin]       = useState<string | null>(null)   // 선택한 출신 지역
  const [hovered, setHovered]     = useState(false)
  const ready = character !== null && origin !== null               // 둘 다 선택해야 입장 가능

  const enter = () => {
    if (!character || !origin) return
    // 선택값을 상위(App)로 전달 → 저장/헤더 표시 처리
    onStart(character, origin)
  }

  return (
    <div style={{ width: desktop ? '640px' : '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: desktop ? '40px' : '26px' }}>

      {/* STEP 1 — 캐릭터 선택 */}
      <section>
        <StepLabel n={1} text="나의 캐릭터를 골라주세요" desktop={desktop} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: desktop ? '16px' : '10px', marginTop: desktop ? '20px' : '14px' }}>
          {CHARACTERS.map(c => {
            const on = character === c.id
            return (
              // 요구사항 1: 아이콘 하단 한글 라벨 제거 → 아이콘만 표시 (이름은 title 툴팁으로만 유지)
              <button key={c.id} onClick={() => setCharacter(c.id)} title={c.name} aria-label={c.name}
                style={{ aspectRatio: '1 / 1', borderRadius: desktop ? '18px' : '14px', border: `1.5px solid ${on ? '#800020' : '#EDE9E4'}`, background: on ? '#FFF5F5' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: on ? '0 4px 14px rgba(128,0,32,0.16)' : 'none', transform: on ? 'translateY(-2px)' : 'translateY(0)', transition: 'all 0.16s' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.src} alt={c.name} style={{ width: '62%', height: '62%', objectFit: 'contain' }} />
              </button>
            )
          })}
        </div>
      </section>

      {/* STEP 2 — 출신 지역 선택 */}
      <section>
        <StepLabel n={2} text="어느 지역에서 오셨나요?" desktop={desktop} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: desktop ? '10px' : '8px', marginTop: desktop ? '20px' : '14px' }}>
          {ORIGINS.map(o => {
            const on = origin === o
            return (
              <button key={o} onClick={() => setOrigin(o)}
                style={{ fontFamily: FONT_UI, fontSize: desktop ? '16px' : '13px', padding: desktop ? '12px 22px' : '9px 16px', borderRadius: '99px', border: `1.5px solid ${on ? '#800020' : '#EDE9E4'}`, background: on ? '#800020' : '#FFFFFF', color: on ? '#FAF8F5' : '#8A8480', fontWeight: on ? 500 : 400, cursor: 'pointer', transition: 'all 0.16s' }}>
                {o}
              </button>
            )
          })}
        </div>
      </section>

      {/* 안내 문구 + 입장 버튼 (둘 다 선택해야 활성화) */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
        <p style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.04em', color: ready ? '#2A6040' : '#C0BEBB', transition: 'color 0.2s', wordBreak: 'keep-all', textAlign: 'center' }}>
          {ready ? '준비됐어요! 이제 입장할 수 있어요' : '캐릭터와 지역을 모두 선택해주세요'}
        </p>

        <button
          onClick={enter}
          disabled={!ready}
          onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', fontFamily: FONT_BRAND, fontSize: desktop ? '24px' : '20px', letterSpacing: '0.04em', color: ready ? '#FAF8F5' : '#C0BEBB', background: ready ? '#800020' : '#EDE9E4', padding: desktop ? '16px 48px' : '15px 40px', cursor: ready ? 'pointer' : 'not-allowed', transform: ready && hovered ? 'translateY(-2px)' : 'translateY(0)', boxShadow: ready ? (hovered ? '0 10px 30px rgba(128,0,32,0.32)' : '0 4px 18px rgba(128,0,32,0.22)') : 'none', transition: 'all 0.2s ease' }}
        >
          낭만여지도 입장하기
          {ready && (
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="10" x2="15" y2="10" /><polyline points="10,5 15,10 10,15" />
            </svg>
          )}
        </button>
      </div>
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
