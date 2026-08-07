'use client'

/* ══════════════════════════════════════════════════════════════
   낭만 별자리 지도 — '우주에 떠 있는 지도' 느낌 (2D, 순수 SVG)
   ----------------------------------------------------------------
   · 딥스페이스 배경 + 은하 + 별먼지 + 지도 격자(그래티큘) 위에
     장소를 별처럼 띄우고 가까운 곳끼리 성좌선으로 연결.
   · 노드 클릭 → 연결 강조 + 상세 패널(뒤로가기/분야/연결/사연 수).
   · 데이터는 기존 spots(mock + localStorage)를 그대로 사용.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Spot, Category } from '@/types'
import { MOCK_SPOTS } from '@/lib/mockData'
import { DAEGU_MAP } from '@/lib/daeguMap' // 간소화한 대구 자치구 경계(배경 지도)

const FONT_BRAND = 'var(--font-brand)'
const FONT_SERIF = 'var(--font-serif)'
const FONT_UI    = 'var(--font-sans)'
const LS_KEY = 'map_romance_local_spots'

const CAT_COLOR: Record<Category, string> = { 낭만: '#E4869B', 젊음: '#7FD1AE', 사랑: '#F0A48A' }

interface Node {
  key: string; placeName: string; lat: number; lng: number
  x: number; y: number; categories: Category[]; count: number; links: number
}

const VB = 1000

/* 결정적 난수 (별 배치가 렌더마다 안 바뀌게) */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export default function ConstellationMap({ embedded = false, onOpenStories }: { embedded?: boolean; onOpenStories?: (placeName: string) => void } = {}) {
  const [spots, setSpots]       = useState<Spot[]>(MOCK_SPOTS)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover]       = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      const local: Spot[] = raw ? JSON.parse(raw) : []
      const ids = new Set(local.map(s => s.id))
      setSpots([...local, ...MOCK_SPOTS.filter(s => !ids.has(s.id))])
    } catch { /* mock만 사용 */ }
  }, [])

  const { nodes, edges } = useMemo(() => {
    const map = new Map<string, { placeName: string; lat: number; lng: number; cats: Set<Category>; count: number }>()
    for (const s of spots) {
      if (s.lat == null || s.lng == null) continue
      const key = s.placeName.trim()
      const g = map.get(key)
      if (g) { g.cats.add(s.category); g.count++ }
      else map.set(key, { placeName: key, lat: s.lat, lng: s.lng, cats: new Set([s.category]), count: 1 })
    }
    const raw = Array.from(map.values())
    if (raw.length === 0) return { nodes: [] as Node[], edges: [] as { a: string; b: string; key: string }[] }

    // 배경 지도와 동일한 선형 투영 → 노드가 실제 대구 자치구 위에 놓임
    const px = (lng: number) => DAEGU_MAP.A * lng + DAEGU_MAP.B
    const py = (lat: number) => DAEGU_MAP.C * lat + DAEGU_MAP.D

    const nodes: Node[] = raw.map(r => ({
      key: r.placeName, placeName: r.placeName, lat: r.lat, lng: r.lng,
      x: px(r.lng), y: py(r.lat), categories: Array.from(r.cats), count: r.count, links: 0,
    }))

    // 라벨이 겹치는 아주 가까운 곳만 살짝 벌림(지도 정렬은 최대한 유지)
    const MIN_DIST = 128, MARGIN = 60
    for (let iter = 0; iter < 60; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let d = Math.hypot(dx, dy)
          if (d === 0) { dx = Math.random(); dy = Math.random(); d = Math.hypot(dx, dy) }
          if (d < MIN_DIST) {
            const push = (MIN_DIST - d) / 2, ux = dx / d, uy = dy / d
            a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push
          }
        }
      }
      for (const n of nodes) {
        n.x = Math.max(MARGIN, Math.min(VB - MARGIN, n.x))
        n.y = Math.max(MARGIN, Math.min(VB - MARGIN, n.y))
      }
    }

    const edgeSet = new Set<string>()
    const edges: { a: string; b: string; key: string }[] = []
    for (const n of nodes) {
      const near = nodes.filter(m => m.key !== n.key)
        .map(m => ({ m, d: (m.lat - n.lat) ** 2 + (m.lng - n.lng) ** 2 }))
        .sort((p, q) => p.d - q.d).slice(0, 2)
      for (const { m } of near) {
        const key = [n.key, m.key].sort().join('|')
        if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ a: n.key, b: m.key, key }) }
      }
    }
    const linkCount = new Map<string, number>()
    for (const e of edges) {
      linkCount.set(e.a, (linkCount.get(e.a) ?? 0) + 1)
      linkCount.set(e.b, (linkCount.get(e.b) ?? 0) + 1)
    }
    for (const n of nodes) n.links = linkCount.get(n.key) ?? 0
    return { nodes, edges }
  }, [spots])

  /* 별먼지 — viewBox 밖까지 넉넉히 뿌려 넓은 화면에서도 채움 */
  const stars = useMemo(() => {
    const rnd = mulberry32(20260807)
    const arr: { x: number; y: number; r: number; o: number; tw: boolean; d: string }[] = []
    for (let i = 0; i < 230; i++) {
      arr.push({
        x: -600 + rnd() * 2200,
        y: -300 + rnd() * 1600,
        r: 0.5 + rnd() * 1.9,
        o: 0.15 + rnd() * 0.7,
        tw: rnd() < 0.18,
        d: (rnd() * 3.4).toFixed(2),
      })
    }
    return arr
  }, [])

  const nodeByKey = useMemo(() => new Map(nodes.map(n => [n.key, n])), [nodes])
  const active = selected ?? hover
  const connectedKeys = useMemo(() => {
    if (!active) return new Set<string>()
    const set = new Set<string>()
    for (const e of edges) { if (e.a === active) set.add(e.b); if (e.b === active) set.add(e.a) }
    return set
  }, [active, edges])

  const sel = selected ? nodeByKey.get(selected) ?? null : null
  const cxAvg = nodes.length ? nodes.reduce((s, n) => s + n.x, 0) / nodes.length : 500
  const cyAvg = nodes.length ? nodes.reduce((s, n) => s + n.y, 0) / nodes.length : 500

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(125% 90% at 50% 22%, #1c1940 0%, #100d24 46%, #06060f 100%)' }}>

      {/* 헤더 / 게이지 */}
      {embedded ? (
        <div style={{ position: 'absolute', top: '14px', right: '18px', zIndex: 6 }}>
          <Gauge count={nodes.length} />
        </div>
      ) : (
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', zIndex: 5 }}>
          <div>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(233,231,247,0.65)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
              돌아가기
            </Link>
            <p style={{ fontFamily: FONT_BRAND, fontSize: '30px', color: '#F4D58A', lineHeight: 1.1, marginTop: '8px' }}>낭만 별자리 지도</p>
            <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(210,214,240,0.55)', marginTop: '4px', letterSpacing: '0.02em' }}>
              우주에 떠 있는 우리들의 자리 · 장소 {nodes.length}곳
            </p>
          </div>
          <Gauge count={nodes.length} />
        </header>
      )}

      {/* 우주 지도 SVG */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}
             onClick={() => setSelected(null)}>
          <defs>
            <radialGradient id="nebA" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4a3a86" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#4a3a86" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nebB" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2f5a7a" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#2f5a7a" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="territory" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8ea0e0" stopOpacity="0.16" />
              <stop offset="60%" stopColor="#8ea0e0" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#8ea0e0" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFE7A8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FFE7A8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 은하 */}
          <ellipse cx="260" cy="210" rx="620" ry="500" fill="url(#nebA)" />
          <ellipse cx="840" cy="860" rx="640" ry="520" fill="url(#nebB)" />

          {/* 배경 지도 — 간소화한 대구 자치구 경계 (홀로그램 느낌: 글로우 + 라인) */}
          <g fill="none" strokeLinejoin="round">
            {DAEGU_MAP.paths.map((d, i) => <path key={`mg${i}`} d={d} stroke="rgba(120,150,240,0.13)" strokeWidth="5" />)}
            {DAEGU_MAP.paths.map((d, i) => <path key={`ml${i}`} d={d} stroke="rgba(174,196,255,0.28)" strokeWidth="1.1" />)}
          </g>

          {/* 별먼지 */}
          <g fill="#FFFFFF">
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o}
                className={s.tw ? 'star-tw' : undefined} style={s.tw ? { animationDelay: `${s.d}s` } : undefined} />
            ))}
          </g>

          {/* 지역 발광(홀로그램 지도 느낌) */}
          <ellipse cx={cxAvg} cy={cyAvg} rx="440" ry="360" fill="url(#territory)" />

          {/* 성좌선 */}
          {edges.map((e, i) => {
            const a = nodeByKey.get(e.a)!, b = nodeByKey.get(e.b)!
            const isOn = active != null && (e.a === active || e.b === active)
            return (
              <line key={e.key} className="const-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isOn ? '#F4D58A' : '#93a0dd'} strokeWidth={isOn ? 2.2 : 1}
                strokeOpacity={active == null ? 0.4 : isOn ? 0.9 : 0.12}
                style={{ animationDelay: `${i * 0.06}s`, transition: 'stroke 0.2s, stroke-opacity 0.2s, stroke-width 0.2s' }} />
            )
          })}

          {/* 별(노드) */}
          {nodes.map((n, i) => {
            const isActive = active === n.key
            const isConn = connectedKeys.has(n.key)
            const dim = active != null && !isActive && !isConn
            return (
              <g key={n.key} className="const-node" style={{ animationDelay: `${0.3 + i * 0.05}s`, cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity 0.2s' }}
                 onClick={(ev) => { ev.stopPropagation(); setSelected(prev => prev === n.key ? null : n.key) }}
                 onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)}>
                {/* 발광 후광 */}
                <circle cx={n.x} cy={n.y} r={isActive ? 34 : 24} fill="url(#nodeGlow)" opacity={isActive ? 1 : 0.7} />
                {/* 별 코어 */}
                <circle cx={n.x} cy={n.y} r={isActive ? 6.5 : 5} fill="#FFF6DC" />
                <circle cx={n.x} cy={n.y} r={isActive ? 3 : 2.2} fill="#FFFFFF" />
                {/* 라벨 */}
                <text x={n.x} y={n.y - 22} textAnchor="middle"
                      fontFamily="var(--font-sans)" fontSize={isActive ? 20 : 17}
                      fill={isActive ? '#FFF7E6' : dim ? '#6a6d8c' : '#CBD0EA'} style={{ pointerEvents: 'none', fontWeight: isActive ? 600 : 400 }}>
                  {n.placeName}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 상세 패널 — 다크 글래스 */}
      {sel && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, background: 'rgba(16,14,34,0.86)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderTop: '1px solid rgba(255,255,255,0.10)', padding: '22px 28px 28px', animation: 'const-node-in 0.25s ease-out' }}>
          <button onClick={() => setSelected(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(233,231,247,0.75)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '99px', padding: '7px 14px', cursor: 'pointer', marginBottom: '16px' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
            뒤로 가기
          </button>

          <p style={{ fontFamily: FONT_BRAND, fontSize: '26px', color: '#F4D58A', lineHeight: 1.2, marginBottom: '16px' }}>{sel.placeName}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <PanelRow label="분야">
              <span style={{ display: 'inline-flex', gap: '6px' }}>
                {sel.categories.map(c => (
                  <span key={c} style={{ fontFamily: FONT_UI, fontSize: '12px', color: CAT_COLOR[c], border: `1px solid ${CAT_COLOR[c]}55`, background: `${CAT_COLOR[c]}1A`, borderRadius: '99px', padding: '3px 10px' }}>{c}</span>
                ))}
              </span>
            </PanelRow>
            <PanelRow label="연결"><Val>{sel.links}곳</Val></PanelRow>
            <PanelRow label="사연"><Val>{sel.count}개</Val></PanelRow>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px', flexWrap: 'wrap' }}>
            {/* 이곳의 사연 보기 — 엽서 리더로 진입 */}
            {onOpenStories && (
              <button onClick={() => onOpenStories(sel.placeName)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: FONT_UI, fontSize: '13px', color: '#1a1730', background: '#F4D58A', border: 'none', borderRadius: '99px', padding: '10px 18px', cursor: 'pointer', fontWeight: 500 }}>
                이곳의 사연 보기
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="10" x2="15" y2="10" /><polyline points="10,5 15,10 10,15" /></svg>
              </button>
            )}
            <a href={`https://map.naver.com/v5/search/${encodeURIComponent(sel.placeName)}`} target="_blank" rel="noopener noreferrer"
               style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(233,231,247,0.7)', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', padding: '9px 14px', textDecoration: 'none' }}>
              📍 네이버 지도
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <span style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(210,214,240,0.5)' }}>{label}</span>
      {children}
    </div>
  )
}
function Val({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT_SERIF, fontSize: '15px', color: '#EDECF5' }}>{children}</span>
}

/* 원형 눈금 게이지 — 우주 톤 */
function Gauge({ count }: { count: number }) {
  const size = 96, cx = size / 2, cy = size / 2
  const R = 40, ticks = 60
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const ang = (i / ticks) * Math.PI * 2 - Math.PI / 2
        const len = 4 + (i % 5 === 0 ? 7 : i % 2 === 0 ? 3 : 1)
        const r1 = R, r2 = R - len
        const rd = (v: number) => Math.round(v * 100) / 100  // 하이드레이션 float 불일치 방지
        return (
          <line key={i}
            x1={rd(cx + Math.cos(ang) * r1)} y1={rd(cy + Math.sin(ang) * r1)}
            x2={rd(cx + Math.cos(ang) * r2)} y2={rd(cy + Math.sin(ang) * r2)}
            stroke="rgba(216,222,255,0.45)" strokeWidth={i % 5 === 0 ? 1.4 : 0.8} />
        )
      })}
      <circle cx={cx} cy={cy} r={R - 14} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--font-brand)" fontSize={22} fill="#F4D58A">{count}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={7} letterSpacing="1.5" fill="rgba(210,214,240,0.6)">PLACES</text>
    </svg>
  )
}
