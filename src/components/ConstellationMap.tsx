'use client'

/* ══════════════════════════════════════════════════════════════
   낭만 별자리 지도 (2D 데모) — 영상의 인터랙션을 '우리 밝은 톤'으로 재해석
   ----------------------------------------------------------------
   · 다크/3D 아님. 크림·버건디 팔레트 + 순수 SVG(2D), 외부 라이브러리 X.
   · 장소(노드)를 실제 위경도로 투영해 배치하고, 가까운 곳끼리 선으로 연결.
   · 노드 클릭 → 연결 강조 + 담백한 상세 패널(뒤로가기/분야/연결/사연 수).
   · 데이터는 기존 spots(mock + localStorage)를 그대로 사용.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Spot, Category } from '@/types'
import { MOCK_SPOTS } from '@/lib/mockData'

const FONT_BRAND = 'var(--font-brand)'
const FONT_SERIF = 'var(--font-serif)'
const FONT_UI    = 'var(--font-sans)'
const LS_KEY = 'map_romance_local_spots'

const CAT_COLOR: Record<Category, string> = { 낭만: '#800020', 젊음: '#2A6040', 사랑: '#B0402B' }

/* 장소 노드 */
interface Node {
  key: string
  placeName: string
  lat: number
  lng: number
  x: number            // SVG 좌표(투영 후)
  y: number
  categories: Category[]
  count: number        // 사연 개수
  links: number        // 연결된 다른 장소 수
}

const VB = 1000                     // viewBox 한 변
const PAD = 130                     // 투영 여백

export default function ConstellationMap() {
  const [spots, setSpots]     = useState<Spot[]>(MOCK_SPOTS)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover]       = useState<string | null>(null)

  /* 기존 로컬 사연도 병합해서 노드 만들기 */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      const local: Spot[] = raw ? JSON.parse(raw) : []
      const ids = new Set(local.map(s => s.id))
      setSpots([...local, ...MOCK_SPOTS.filter(s => !ids.has(s.id))])
    } catch { /* mock만 사용 */ }
  }, [])

  /* 장소별 그룹 → 노드 + 위경도 투영 + 최근접 연결 */
  const { nodes, edges } = useMemo(() => {
    // 1) placeName 기준 그룹화 (좌표 있는 것만)
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

    // 2) 위경도 → SVG 좌표 (북쪽이 위로)
    const lats = raw.map(r => r.lat), lngs = raw.map(r => r.lng)
    const minLat = Math.min(...lats), maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const spanLat = Math.max(maxLat - minLat, 0.0001)
    const spanLng = Math.max(maxLng - minLng, 0.0001)
    const px = (lng: number) => PAD + ((lng - minLng) / spanLng) * (VB - PAD * 2)
    const py = (lat: number) => PAD + (1 - (lat - minLat) / spanLat) * (VB - PAD * 2)

    const nodes: Node[] = raw.map(r => ({
      key: r.placeName, placeName: r.placeName, lat: r.lat, lng: r.lng,
      x: px(r.lng), y: py(r.lat), categories: Array.from(r.cats), count: r.count, links: 0,
    }))

    // 2-b) 겹침 방지 — 같은 도시 내 가까운 장소들이 포개지지 않도록 살짝 밀어냄
    const MIN_DIST = 150
    for (let iter = 0; iter < 80; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j]
          let dx = b.x - a.x, dy = b.y - a.y
          let d = Math.hypot(dx, dy)
          if (d === 0) { dx = Math.random(); dy = Math.random(); d = Math.hypot(dx, dy) }
          if (d < MIN_DIST) {
            const push = (MIN_DIST - d) / 2
            const ux = dx / d, uy = dy / d
            a.x -= ux * push; a.y -= uy * push
            b.x += ux * push; b.y += uy * push
          }
        }
      }
      // 화면 밖으로 나가지 않게 클램프
      for (const n of nodes) {
        n.x = Math.max(PAD, Math.min(VB - PAD, n.x))
        n.y = Math.max(PAD, Math.min(VB - PAD, n.y))
      }
    }

    // 3) 각 노드를 가장 가까운 2곳과 연결(별자리) — 중복 제거
    const edgeSet = new Set<string>()
    const edges: { a: string; b: string; key: string }[] = []
    const K = 2
    for (const n of nodes) {
      const near = nodes
        .filter(m => m.key !== n.key)
        .map(m => ({ m, d: (m.lat - n.lat) ** 2 + (m.lng - n.lng) ** 2 }))
        .sort((p, q) => p.d - q.d)
        .slice(0, K)
      for (const { m } of near) {
        const key = [n.key, m.key].sort().join('|')
        if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ a: n.key, b: m.key, key }) }
      }
    }
    // 4) 연결 수 집계
    const linkCount = new Map<string, number>()
    for (const e of edges) {
      linkCount.set(e.a, (linkCount.get(e.a) ?? 0) + 1)
      linkCount.set(e.b, (linkCount.get(e.b) ?? 0) + 1)
    }
    for (const n of nodes) n.links = linkCount.get(n.key) ?? 0

    return { nodes, edges }
  }, [spots])

  const nodeByKey = useMemo(() => new Map(nodes.map(n => [n.key, n])), [nodes])
  const active = selected ?? hover
  const connectedKeys = useMemo(() => {
    if (!active) return new Set<string>()
    const set = new Set<string>()
    for (const e of edges) {
      if (e.a === active) set.add(e.b)
      if (e.b === active) set.add(e.a)
    }
    return set
  }, [active, edges])

  const sel = selected ? nodeByKey.get(selected) ?? null : null

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: '#FAF8F5', display: 'flex', flexDirection: 'column' }}>

      {/* ── 상단 헤더 : 뒤로 + 타이틀 + 원형 게이지 ── */}
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', zIndex: 5 }}>
        <div>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: '#8A8480' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
            돌아가기
          </Link>
          <p style={{ fontFamily: FONT_BRAND, fontSize: '30px', color: '#800020', lineHeight: 1.1, marginTop: '8px' }}>낭만 별자리 지도</p>
          <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB', marginTop: '4px', letterSpacing: '0.02em' }}>
            우리가 머문 자리를 선으로 이어봅니다 · 장소 {nodes.length}곳
          </p>
        </div>
        <Gauge count={nodes.length} />
      </header>

      {/* ── 별자리 SVG ── */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%', display: 'block' }}
             onClick={() => setSelected(null)}>
          {/* 연결선 */}
          {edges.map((e, i) => {
            const a = nodeByKey.get(e.a)!, b = nodeByKey.get(e.b)!
            const isOn = active != null && (e.a === active || e.b === active)
            return (
              <line key={e.key} className="const-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isOn ? '#B0402B' : '#D8B8B8'} strokeWidth={isOn ? 2.4 : 1.2}
                strokeOpacity={active == null ? 0.55 : isOn ? 0.9 : 0.18}
                style={{ animationDelay: `${i * 0.06}s`, transition: 'stroke 0.2s, stroke-opacity 0.2s, stroke-width 0.2s' }} />
            )
          })}

          {/* 노드 */}
          {nodes.map((n, i) => {
            const isActive = active === n.key
            const isConn = connectedKeys.has(n.key)
            const dim = active != null && !isActive && !isConn
            const color = CAT_COLOR[n.categories[0]] ?? '#800020'
            return (
              <g key={n.key} className="const-node" style={{ animationDelay: `${0.3 + i * 0.05}s`, cursor: 'pointer', opacity: dim ? 0.35 : 1, transition: 'opacity 0.2s' }}
                 onClick={(ev) => { ev.stopPropagation(); setSelected(prev => prev === n.key ? null : n.key) }}
                 onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)}>
                {/* 후광 */}
                <circle cx={n.x} cy={n.y} r={isActive ? 18 : 13} fill={color} opacity={isActive ? 0.18 : 0.1}
                        style={isActive ? { animation: 'const-halo 1.8s ease-in-out infinite' } : undefined} />
                {/* 점 */}
                <circle cx={n.x} cy={n.y} r={isActive ? 7 : 5} fill={color} stroke="#FAF8F5" strokeWidth={2} />
                {/* 라벨 */}
                <text x={n.x} y={n.y - 20} textAnchor="middle"
                      fontFamily="var(--font-sans)" fontSize={isActive ? 20 : 17}
                      fill={isActive ? '#2A2520' : '#8A8480'} style={{ pointerEvents: 'none', fontWeight: isActive ? 600 : 400 }}>
                  {n.placeName}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── 상세 패널 (영상의 ATEK/RECOMMEND/SECTOR 구조를 담백하게) ── */}
      {sel && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 10, background: '#FFFFFF', borderTop: '1px solid #EDE9E4', boxShadow: '0 -8px 30px rgba(0,0,0,0.06)', padding: '22px 28px 28px', animation: 'const-node-in 0.25s ease-out' }}>
          <button onClick={() => setSelected(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: FONT_UI, fontSize: '12px', color: '#8A8480', background: '#F7F3EF', border: '1px solid #EDE9E4', borderRadius: '99px', padding: '7px 14px', cursor: 'pointer', marginBottom: '16px' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
            뒤로 가기
          </button>

          <p style={{ fontFamily: FONT_BRAND, fontSize: '26px', color: '#800020', lineHeight: 1.2, marginBottom: '16px' }}>{sel.placeName}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <PanelRow label="분야">
              <span style={{ display: 'inline-flex', gap: '6px' }}>
                {sel.categories.map(c => (
                  <span key={c} style={{ fontFamily: FONT_UI, fontSize: '12px', color: CAT_COLOR[c], border: `1px solid ${CAT_COLOR[c]}33`, background: `${CAT_COLOR[c]}0D`, borderRadius: '99px', padding: '3px 10px' }}>{c}</span>
                ))}
              </span>
            </PanelRow>
            <PanelRow label="연결"><Val>{sel.links}곳</Val></PanelRow>
            <PanelRow label="사연"><Val>{sel.count}개</Val></PanelRow>
          </div>

          {/* 실제 지도에서 이 장소 열기 (기존 앱 흐름과 연결) */}
          <a href={`https://map.naver.com/v5/search/${encodeURIComponent(sel.placeName)}`} target="_blank" rel="noopener noreferrer"
             style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '18px', fontFamily: FONT_UI, fontSize: '12px', color: '#800020', background: '#FFF5F5', borderRadius: '99px', padding: '9px 16px', textDecoration: 'none' }}>
            📍 네이버 지도에서 보기
          </a>
        </div>
      )}
    </div>
  )
}

/* 상세 패널 한 줄 (label ─────── value) */
function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F0ECE7' }}>
      <span style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.14em', color: '#B5B0AB' }}>{label}</span>
      {children}
    </div>
  )
}
function Val({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT_SERIF, fontSize: '15px', color: '#2A2520' }}>{children}</span>
}

/* 원형 눈금 게이지 (영상 '톱니바퀴 다이얼'의 2D·라이트 버전) */
function Gauge({ count }: { count: number }) {
  const size = 96, cx = size / 2, cy = size / 2
  const R = 40, ticks = 60
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const ang = (i / ticks) * Math.PI * 2 - Math.PI / 2
        // 눈금 길이를 규칙적으로 변주 (기계식 다이얼 느낌)
        const len = 4 + (i % 5 === 0 ? 7 : i % 2 === 0 ? 3 : 1)
        const r1 = R, r2 = R - len
        return (
          <line key={i}
            x1={cx + Math.cos(ang) * r1} y1={cy + Math.sin(ang) * r1}
            x2={cx + Math.cos(ang) * r2} y2={cy + Math.sin(ang) * r2}
            stroke="#C9A9A9" strokeWidth={i % 5 === 0 ? 1.4 : 0.8} strokeOpacity={0.9} />
        )
      })}
      <circle cx={cx} cy={cy} r={R - 14} fill="none" stroke="#EAD9D9" strokeWidth={1} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--font-brand)" fontSize={22} fill="#800020">{count}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={7} letterSpacing="1.5" fill="#B5B0AB">PLACES</text>
    </svg>
  )
}
