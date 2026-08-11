'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
import { randomQuote } from '@/lib/quotes' // 낭젊사 매거진 글귀(사진 크게보기 랜덤 표시)

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

  // 입장 시 촬영한 사진(dataURL, 메모리에만 보관 → 새로고침 시 자동 삭제) + 출신 지역 (헤더 뱃지 표시용)
  const [visitor, setVisitor]     = useState<{ photo: string | null; region: string } | null>(null)
  // 지도 좌상단 사진 아바타 클릭 → 사진 크게 보기
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false)
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

  /* ── 입장 처리 — 사진(메모리 보관)·지역 저장 + 통계는 '지역'만 수집 + 인트로(2단계)로 ── */
  const enterWithSelection = (photo: string | null, region: string) => {
    setVisitor({ photo, region })              // 헤더/인트로에 표시 (사진은 저장·전송 안 함)
    saveVisitorSelection(region)               // 통계: 출신 지역만 수집 (사진은 수집하지 않음)
    transition(() => setView('intro'))         // 곧장 지도가 아니라 환영 인트로부터
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
          photo={visitor.photo}
          region={visitor.region}
          onEnter={goSecond}   // 버튼 → 새 두번째 페이지(엽서 리더)로 진입
          onBack={goBack}      // 다시 찍기 → 랜딩
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

          {/* 입장 시 촬영한 사진 — 지도 위에 반짝이는 '별'처럼 (클릭 → 오늘의 낭만 열기) */}
          {visitor?.photo && (
            <button onClick={() => setPhotoZoomOpen(true)} title="눌러서 오늘의 낭만 한 조각 열기" className="photo-star"
              style={{ ['--star-glow' as string]: dark ? 'rgba(244,213,138,0.55)' : 'rgba(128,0,32,0.30)', position: 'absolute', top: isDesktop ? '16px' : '12px', left: isDesktop ? '16px' : '12px', zIndex: 30, display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 15px 5px 5px', borderRadius: '99px', background: dark ? 'rgba(20,17,48,0.78)' : 'rgba(255,255,255,0.94)', border: `1px solid ${dark ? 'rgba(244,213,138,0.6)' : '#EAD7B0'}`, backdropFilter: 'blur(6px)', cursor: 'pointer' } as React.CSSProperties}>
              {/* 사진(별 알맹이) — 금빛 링 */}
              <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={visitor.photo} alt="" style={{ width: isDesktop ? '60px' : '50px', height: isDesktop ? '42px' : '34px', borderRadius: '9px', objectFit: 'cover', border: `1.5px solid ${dark ? '#F4D58A' : '#800020'}`, display: 'block' }} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, alignItems: 'flex-start', gap: '1px' }}>
                <span style={{ fontFamily: FONT_UI, fontSize: isDesktop ? '17px' : '14px', fontWeight: 700, color: dark ? '#F4D58A' : '#800020', whiteSpace: 'nowrap' }}>{visitor.region}에서 오심</span>
                <span style={{ fontFamily: FONT_UI, fontSize: isDesktop ? '12px' : '11px', fontWeight: 500, color: dark ? 'rgba(233,231,247,0.72)' : '#B08968', whiteSpace: 'nowrap', letterSpacing: '0.02em' }}>숨은 낭만 열기</span>
              </span>
              <span className="photo-sparkle" style={{ fontSize: isDesktop ? '19px' : '16px', lineHeight: 1, flexShrink: 0 }}>✨</span>
            </button>
          )}

          {/* 사진 크게 보기 모달 */}
          {photoZoomOpen && visitor?.photo && (
            <PhotoZoomModal photo={visitor.photo} region={visitor.region} onClose={() => setPhotoZoomOpen(false)} />
          )}
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
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><g transform="translate(2 2) scale(0.667)" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></g></svg>
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
            {/* 촬영한 사진 썸네일 + 지역 뱃지 */}
            {visitor && <VisitorBadge photo={visitor.photo} region={visitor.region} />}
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
          <VisitorBadge photo={visitor.photo} region={visitor.region} compact />
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
   입장 첫 화면: 캐릭터 선택 → '사진 촬영'으로 교체.
   촬영한 사진은 메모리(React state)에만 담기고 저장·전송하지 않음(자동 삭제).
   ══════════════════════════════════════════════════════════ */

/* 어느 지역에서 왔는지 — 전국 17개 시·도(광역 지자체) */
const ORIGINS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

/* ── 입장 후 헤더 뱃지 — 촬영 사진 썸네일 + 지역 이름 ── */
function VisitorBadge({ photo, region, compact = false }: { photo: string | null; region: string; compact?: boolean }) {
  const size = compact ? 20 : 24
  return (
    <div
      title={region}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        padding: compact ? '4px 10px 4px 6px' : '5px 12px 5px 6px',
        borderRadius: '99px', background: '#FFF5F5', border: '1px solid #F0E0E0',
      }}
    >
      {photo && (
        <span style={{ width: size, height: size, borderRadius: '50%', background: '#FFFFFF', border: '1px solid #EDE9E4', overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </span>
      )}
      <span style={{ fontFamily: FONT_UI, fontSize: compact ? '11px' : '12px', color: '#800020', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
        {region}에서 오심
      </span>
    </div>
  )
}

/* ── 사진 크게 보기 모달 — 촬영 원본을 크게 + 낭젊사 매거진 랜덤 글귀 ── */
function PhotoZoomModal({ photo, region, onClose }: { photo: string; region: string; onClose: () => void }) {
  // 모달이 열릴 때마다 새 글귀 하나 (열기마다 랜덤)
  const [quote] = useState(randomQuote)
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(8,6,20,0.88)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '18px', overflowY: 'auto' }}>
      {/* 닫기 */}
      <button onClick={onClose} aria-label="닫기"
        style={{ position: 'fixed', top: '18px', right: '18px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: 'none', color: '#F4F2EC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" /></svg>
      </button>

      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', maxWidth: 'min(92vw, 560px)', width: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" style={{ width: '100%', height: 'auto', maxHeight: '58vh', objectFit: 'contain', borderRadius: '18px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }} />

        {/* 낭젊사 매거진 랜덤 글귀 */}
        <figure style={{ margin: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
          <span style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.18em', color: '#F4D58A', opacity: 0.85 }}>· {quote.c} ·</span>
          <blockquote style={{ margin: 0, fontFamily: FONT_BRAND, fontSize: '21px', lineHeight: 1.7, color: '#F4F2EC', wordBreak: 'keep-all', maxWidth: '460px' }}>
            “{quote.t}”
          </blockquote>
          <figcaption style={{ fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(233,231,247,0.6)', letterSpacing: '0.02em' }}>
            낭만젊음사랑 매거진 · {region}에서 온 당신에게
          </figcaption>
        </figure>
      </div>
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

/* ── 입장 직후 환영 인트로 (촬영 사진·지역 활용, 담백/여백 중심) ── */
function EntryIntro({ photo, region, onEnter, onBack }: { photo: string | null; region: string; onEnter: () => void; onBack: () => void }) {
  const [hovered, setHovered] = useState(false)
  // 환영 문구 → 리드 문장 순서로 타이핑
  const headingText = `${region}에서 오신 걸\n환영합니다`
  const leadText = '여기, 우리가 머물렀던 이야기들이 지도가 되어 있어요.\n천천히 둘러보세요.'
  const typedHeading = useTypewriter(headingText, 55, 350)
  const headingDone = typedHeading.length >= headingText.length
  const typedLead = useTypewriter(leadText, 31, 250, headingDone)
  const leadDone = typedLead.length >= leadText.length
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#FAF8F5', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>

      {/* 촬영한 사진 — 촬영 비율 그대로 크게(덜 잘리게), 부드러운 둥근 사각형 */}
      <div className="const-node" style={{ position: 'relative', width: '100%', maxWidth: '440px', aspectRatio: '3 / 2', borderRadius: '26px', background: '#FFFFFF', border: '1px solid #EDE9E4', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 14px 36px rgba(128,0,32,0.12)', marginBottom: '34px' }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '54px', opacity: 0.5 }}>📷</span>
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

/* ── 사진 촬영 부스 — '촬영하기' 누르면 3초 카운트다운 후 셀카 캡처 ──
   촬영한 사진은 dataURL로 상위에 전달되며 저장·전송하지 않음(메모리에만). ── */
function CameraBooth({ photo, onCapture, onError, desktop = false }: {
  photo: string | null
  onCapture: (dataUrl: string | null) => void
  onError?: () => void
  desktop?: boolean
}) {
  const videoRef  = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [count, setCount] = useState<number | null>(null)  // 카운트다운(3,2,1) — null이면 대기
  const [ready, setReady] = useState(false)                // 카메라 스트림 준비됨
  const [error, setError] = useState<string | null>(null)

  // 사진이 없을 때만 카메라 스트림을 켠다. (촬영/재촬영 시 자동으로 다시 실행)
  useEffect(() => {
    if (photo) return
    let cancelled = false
    setReady(false); setError(null)
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md?.getUserMedia) {
      setError('이 브라우저에서는 카메라를 쓸 수 없어요.'); onError?.()
      return
    }
    md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setReady(true)
      })
      .catch(() => { setError('카메라 권한이 필요해요. 브라우저에서 카메라를 허용해 주세요.'); onError?.() })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    // onError는 매 렌더 새로 생성될 수 있어 의존성에서 제외(카메라 재시작 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo])

  const capture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const vw = v.videoWidth, vh = v.videoHeight
    // 표시 비율(aspect = 가로/세로)에 맞춰 가운데 크롭
    let cw = vw, chh = vh
    if (vw / vh > aspect) { cw = Math.round(vh * aspect); chh = vh }   // 영상이 더 넓음 → 좌우 크롭
    else { cw = vw; chh = Math.round(vw / aspect) }                    // 영상이 더 좁음 → 상하 크롭
    const sx = (vw - cw) / 2, sy = (vh - chh) / 2
    const canvas = document.createElement('canvas')
    canvas.width = cw; canvas.height = chh
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.translate(cw, 0); ctx.scale(-1, 1)   // 좌우 반전(거울) — 미리보기와 동일하게
    ctx.drawImage(v, sx, sy, cw, chh, 0, 0, cw, chh)
    const url = canvas.toDataURL('image/jpeg', 0.85)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    onCapture(url)
  }

  // 촬영하기 → 3,2,1 카운트다운 후 캡처 (총 3초)
  const shoot = () => {
    if (count !== null || !ready) return
    let n = 3
    setCount(n)
    const tick = () => {
      n -= 1
      if (n > 0) { setCount(n); window.setTimeout(tick, 1000) }
      else { setCount(null); capture() }
    }
    window.setTimeout(tick, 1000)
  }

  // 데스크탑: 가로로 길게(와이드), 모바일: 살짝 가로형
  const aspect = desktop ? 1.6 : 1.35        // 가로 / 세로 비율
  const maxW   = desktop ? 560 : 340
  const frameStyle: React.CSSProperties = {
    position: 'relative', width: '100%', maxWidth: `${maxW}px`, margin: '0 auto',
    aspectRatio: `${aspect} / 1`, borderRadius: '18px', overflow: 'hidden',
    background: '#141130', border: '1px solid #EDE9E4',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={frameStyle}>
        {photo ? (
          // 촬영 완료 — 결과 미리보기
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : error ? (
          // 카메라 사용 불가
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '18px', textAlign: 'center' }}>
            <span style={{ fontSize: '30px' }}>📷</span>
            <p style={{ fontFamily: FONT_UI, fontSize: '12px', lineHeight: 1.6, color: '#E9E7F7', wordBreak: 'keep-all' }}>{error}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', background: '#141130' }}
            />
            {/* 카운트다운 숫자 오버레이 */}
            {count !== null && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,11,30,0.35)' }}>
                <span style={{ fontFamily: FONT_BRAND, fontSize: '92px', color: '#FAF8F5', lineHeight: 1, textShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{count}</span>
              </div>
            )}
            {/* 준비 중 표시 */}
            {!ready && count === null && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(233,231,247,0.7)' }}>카메라 준비 중…</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 버튼 */}
      {photo ? (
        <button onClick={() => onCapture(null)}
          style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#800020', background: '#FFF5F5', border: '1px solid #F0E0E0', borderRadius: '99px', padding: '9px 20px', cursor: 'pointer' }}>
          다시 촬영
        </button>
      ) : !error ? (
        <button onClick={shoot} disabled={!ready || count !== null}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: FONT_BRAND, fontSize: desktop ? '19px' : '17px', letterSpacing: '0.03em', color: '#FAF8F5', background: (ready && count === null) ? '#800020' : '#C9B3B9', border: 'none', borderRadius: '99px', padding: desktop ? '12px 30px' : '11px 26px', cursor: (ready && count === null) ? 'pointer' : 'default', boxShadow: (ready && count === null) ? '0 4px 14px rgba(128,0,32,0.22)' : 'none', transition: 'all 0.16s' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
          </svg>
          {count !== null ? '촬영 중…' : '촬영하기'}
        </button>
      ) : null}

      {/* 개인정보 안내 — 사진은 저장·전송하지 않음 (강조: 진하고 잘 보이게) */}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: FONT_UI, fontSize: '13px', fontWeight: 700, letterSpacing: '0.01em', color: '#800020', background: '#FFF0F0', border: '1px solid #EBC9C9', borderRadius: '99px', padding: '9px 16px', wordBreak: 'keep-all', lineHeight: 1.5, textAlign: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        촬영한 사진은 저장·전송되지 않고 자동 삭제됩니다
      </span>
    </div>
  )
}

/* ── 입장 게이트 — 사진 촬영 + 지역 선택 후 입장 버튼 활성화 ── */
function EntryGate({ onStart, desktop = false }: { onStart: (photo: string | null, region: string) => void; desktop?: boolean }) {
  const [photo, setPhoto]     = useState<string | null>(null)   // 촬영한 사진(dataURL)
  const [camError, setCamError] = useState(false)               // 카메라 사용 불가(권한 거부 등)
  const [origin, setOrigin]   = useState<string | null>(null)   // 선택한 출신 지역
  const [hovered, setHovered] = useState(false)
  // 지역은 필수, 사진은 찍었거나(또는 카메라를 못 쓰는 경우) 입장 가능 — 카메라 문제로 잠기지 않게
  const ready = origin !== null && (photo !== null || camError)

  const enter = () => {
    if (!ready || !origin) return
    onStart(photo, origin)
  }

  const guide = ready
    ? '준비됐어요! 이제 입장할 수 있어요'
    : origin === null
      ? '사진을 촬영하고 지역을 선택해주세요'
      : '사진을 촬영해주세요'

  /* STEP 1 — 사진 촬영 */
  const cameraSection = (
    <section>
      <StepLabel n={1} text="사진을 촬영해 주세요" desktop={desktop} />
      <div style={{ marginTop: desktop ? '18px' : '14px' }}>
        <CameraBooth photo={photo} onCapture={setPhoto} onError={() => setCamError(true)} desktop={desktop} />
      </div>
    </section>
  )

  /* STEP 2 — 출신 지역 선택 */
  const regionSection = (
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
  )

  /* 안내 문구 + 입장 버튼 */
  const enterBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', marginTop: '4px' }}>
      <p style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.04em', color: ready ? '#2A6040' : '#C0BEBB', transition: 'color 0.2s', wordBreak: 'keep-all', textAlign: 'center' }}>
        {guide}
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
  )

  // 세로 스택: (위)가로로 긴 카메라 → (아래)지역 선택 → 입장 버튼
  return (
    <div style={{ width: desktop ? '600px' : '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: desktop ? '34px' : '24px' }}>
      {cameraSection}
      {regionSection}
      {enterBlock}
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
