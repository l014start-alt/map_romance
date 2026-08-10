'use client'

/* ══════════════════════════════════════════════════════════════
   사연 피드 — 시간순으로 한 화면에 12개(그리드), 페이지 넘김.
   카드 클릭 → 좌: 지도 위치(네이버 미니맵) / 우: 사연 내용 (데스크탑은 좌우, 모바일은 상하)
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Spot, Category } from '@/types'

const FONT_BRAND = 'var(--font-brand)'
const FONT_UI    = 'var(--font-sans)'
const CAT_COLOR: Record<Category, string> = { 낭만: '#800020', 젊음: '#2A6040', 사랑: '#B0402B' }
const PER_PAGE = 12

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/* ── 단일 장소 네이버 미니맵 ── */
function SpotMiniMap({ spot }: { spot: Spot }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (spot.lat == null || spot.lng == null) return
    let map: naver.maps.Map | null = null
    let interval: ReturnType<typeof setInterval> | null = null
    const init = () => {
      const n = window.naver
      if (!n?.maps || !ref.current) return
      const pos = new n.maps.LatLng(spot.lat!, spot.lng!)
      map = new n.maps.Map(ref.current, {
        center: pos, zoom: 16,
        logoControl: false, mapDataControl: false, scaleControl: false,
        zoomControl: true,
      })
      new n.maps.Marker({ position: pos, map })
    }
    if (window.naver?.maps) init()
    else interval = setInterval(() => { if (window.naver?.maps) { clearInterval(interval!); interval = null; init() } }, 100)
    return () => { if (interval) clearInterval(interval); map?.destroy?.() }
  }, [spot.id, spot.lat, spot.lng])

  if (spot.lat == null || spot.lng == null) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0EDE8' }}>
        <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB' }}>위치 정보가 없어요</p>
      </div>
    )
  }
  return <div ref={ref} style={{ width: '100%', height: '100%' }} />
}

/* ── 상세: 좌 지도 / 우 내용 ── */
function StoryDetail({ spot, desktop, onBack }: { spot: Spot; desktop: boolean; onBack: () => void }) {
  const color = CAT_COLOR[spot.category] ?? '#800020'
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(spot.placeName)}`
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF8F5' }}>
      {/* 상단 목록으로 */}
      <div style={{ flexShrink: 0, padding: desktop ? '16px 28px' : '12px 16px', borderBottom: '1px solid #EDE9E4' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: FONT_UI, fontSize: '13px', color: '#6B6560', cursor: 'pointer', background: 'transparent', border: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
          목록으로
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: desktop ? 'row' : 'column' }}>
        {/* 좌: 지도 위치 */}
        <div style={{ position: 'relative', flexShrink: 0, width: desktop ? '48%' : '100%', height: desktop ? 'auto' : '300px', borderRight: desktop ? '1px solid #EDE9E4' : 'none', borderBottom: desktop ? 'none' : '1px solid #EDE9E4', background: '#F0EDE8' }}>
          <SpotMiniMap spot={spot} />
          {/* 장소 이름 오버레이 */}
          <div style={{ position: 'absolute', left: '14px', top: '14px', zIndex: 5, background: 'rgba(250,248,245,0.95)', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)', maxWidth: 'calc(100% - 28px)' }}>
            <p style={{ fontFamily: FONT_BRAND, fontSize: '16px', color: '#800020', lineHeight: 1.2, wordBreak: 'keep-all' }}>{spot.placeName}</p>
            {spot.address && <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#8A8480', marginTop: '3px', wordBreak: 'keep-all' }}>{spot.address}</p>}
          </div>
        </div>

        {/* 우: 사연 내용 */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: desktop ? '40px 44px 56px' : '26px 22px 44px' }}>
          <div style={{ maxWidth: '620px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: FONT_UI, fontSize: '11px', color, letterSpacing: '0.1em', fontWeight: 600 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, display: 'inline-block' }} />{spot.category}
              </span>
              <span style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#B5B0AB' }}>{formatDate(spot.createdAt)}</span>
            </div>

            {spot.title && (
              <h2 style={{ fontFamily: FONT_BRAND, fontSize: desktop ? '32px' : '26px', color: '#2A2520', lineHeight: 1.3, wordBreak: 'keep-all', marginBottom: '8px' }}>{spot.title}</h2>
            )}
            <p style={{ fontFamily: FONT_BRAND, fontSize: '14px', color: '#B5B0AB', marginBottom: '26px' }}>by {spot.nickname || '익명'}</p>

            {spot.imageUrl && (
              <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', marginBottom: '26px', background: '#F0EDE8' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={spot.imageUrl} alt="" style={{ width: '100%', display: 'block' }} />
              </div>
            )}

            <p style={{ fontFamily: FONT_UI, fontSize: desktop ? '17px' : '15px', color: '#2A2520', lineHeight: 2.1, wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{spot.moment}</p>

            {spot.sns && (
              <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#800020', marginTop: '24px', wordBreak: 'break-all' }}>
                📷 인스타그램 @{spot.sns.replace(/^@/, '')}
              </p>
            )}

            <a href={naverUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '13px', color: '#2A6040', marginTop: '28px', textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2C6.5 2 4 4.6 4 8c0 4.2 6 10 6 10s6-5.8 6-10c0-3.4-2.5-6-6-6Z" /><circle cx="10" cy="8" r="2" /></svg>
              네이버 지도에서 보기
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── 그리드 카드 ── */
function FeedCard({ spot, onClick }: { spot: Spot; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  const color = CAT_COLOR[spot.category] ?? '#800020'
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ textAlign: 'left', background: '#FFFFFF', border: `1px solid ${hover ? '#E4D5D5' : '#EDEAE5'}`, borderRadius: '14px', padding: '18px 20px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', boxShadow: hover ? '0 10px 26px rgba(0,0,0,0.09)' : '0 2px 8px rgba(0,0,0,0.04)', transform: hover ? 'translateY(-3px)' : 'translateY(0)', transition: 'all 0.2s ease', minHeight: '176px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '10px', color, letterSpacing: '0.12em', fontWeight: 600 }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, display: 'inline-block' }} />{spot.category}
        </span>
        <span style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB' }}>{formatDate(spot.createdAt)}</span>
      </div>
      <p style={{ fontFamily: FONT_BRAND, fontSize: '20px', color: '#2A2520', lineHeight: 1.3, wordBreak: 'keep-all', marginBottom: '4px' }}>{spot.title || '무제'}</p>
      <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#8A8480', marginBottom: '10px', wordBreak: 'keep-all' }}>📍 {spot.placeName}</p>
      <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#6B6560', lineHeight: 1.7, wordBreak: 'keep-all', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', flex: 1 }}>{spot.moment}</p>
      <p style={{ fontFamily: FONT_BRAND, fontSize: '12px', color: '#B5B0AB', marginTop: '12px' }}>by {spot.nickname || '익명'}</p>
    </button>
  )
}

export default function StoryFeed({ spots, startPlaceName, desktop = false }: { spots: Spot[]; startPlaceName?: string; desktop?: boolean }) {
  // 시간순(최신 먼저)
  const ordered = useMemo(() => [...spots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [spots])
  const [selected, setSelected] = useState<Spot | null>(null)
  const [page, setPage] = useState(0)

  // 지도에서 특정 장소로 진입 시 그 장소의 최신 사연 상세로
  useEffect(() => {
    if (!startPlaceName) return
    const s = ordered.find(x => x.placeName === startPlaceName)
    if (s) setSelected(s)
  }, [startPlaceName, ordered])

  if (selected) {
    return <StoryDetail spot={selected} desktop={desktop} onBack={() => setSelected(null)} />
  }

  const pageCount = Math.max(1, Math.ceil(ordered.length / PER_PAGE))
  const safePage = Math.min(page, pageCount - 1)
  const pageSpots = ordered.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF8F5' }}>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: desktop ? '28px 40px' : '18px 16px' }}>
        {ordered.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <p style={{ fontFamily: FONT_BRAND, fontSize: '24px', color: '#C0BEBB' }}>아직 사연이 없어요</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(4, 1fr)' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: desktop ? '18px' : '12px' }}>
              {pageSpots.map(s => <FeedCard key={s.id} spot={s} onClick={() => setSelected(s)} />)}
            </div>

            {/* 페이지 넘김 */}
            {pageCount > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '28px 0 8px' }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={safePage === 0}
                  style={{ fontFamily: FONT_UI, fontSize: '13px', color: safePage === 0 ? '#D4D0CB' : '#6B6560', background: 'transparent', border: '1px solid #EDE9E4', borderRadius: '8px', padding: '9px 18px', cursor: safePage === 0 ? 'default' : 'pointer' }}>← 이전</button>
                <span style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#8A8480' }}>{safePage + 1} / {pageCount}</span>
                <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} disabled={safePage >= pageCount - 1}
                  style={{ fontFamily: FONT_UI, fontSize: '13px', color: safePage >= pageCount - 1 ? '#D4D0CB' : '#6B6560', background: 'transparent', border: '1px solid #EDE9E4', borderRadius: '8px', padding: '9px 18px', cursor: safePage >= pageCount - 1 ? 'default' : 'pointer' }}>다음 →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
