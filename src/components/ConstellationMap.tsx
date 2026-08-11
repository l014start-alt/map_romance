'use client'

/* ══════════════════════════════════════════════════════════════
   낭만 별자리 지도 — 깊은 밤하늘에 뜬 대구, 반짝이는 별들
   ----------------------------------------------------------------
   · 순수 블랙 배경 + 은은히 반짝이는 별먼지 위로 간소화한 대구 지도.
   · 장소를 실제 위경도 위치의 별로, 가까운 곳끼리 성좌선으로 연결.
   · 휠/드래그/버튼으로 확대·축소·이동. 노드 클릭 → 상세 패널.
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Spot, Category } from '@/types'
import { MOCK_SPOTS } from '@/lib/mockData'
import { DAEGU_MAP } from '@/lib/daeguMap'

const FONT_BRAND = 'var(--font-brand)'
const FONT_UI    = 'var(--font-sans)'
const LS_KEY = 'map_romance_local_spots'

const CAT_COLOR: Record<Category, string> = { 낭만: '#E4869B', 젊음: '#7FD1AE', 사랑: '#F0A48A' }

interface Node {
  key: string; placeName: string; lat: number; lng: number
  x: number; y: number; categories: Category[]; count: number; links: number
}

const VB = 1000
const MIN_K = 0.7, MAX_K = 200   // 도심 밀집 구역까지 아주 깊게 확대(모바일 가독·터치)

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Tf = { k: number; tx: number; ty: number }

/* 사연 → 장소 노드 + 성좌선(가까운 곳끼리) 그래프 */
function buildGraph(spots: Spot[]): { nodes: Node[]; edges: { a: string; b: string; key: string }[] } {
  const map = new Map<string, { placeName: string; lat: number; lng: number; cats: Set<Category>; count: number }>()
  for (const s of spots) {
    if (s.lat == null || s.lng == null) continue
    const key = s.placeName.trim()
    const g = map.get(key)
    if (g) { g.cats.add(s.category); g.count++ }
    else map.set(key, { placeName: key, lat: s.lat, lng: s.lng, cats: new Set([s.category]), count: 1 })
  }
  const raw = Array.from(map.values())
  if (raw.length === 0) return { nodes: [], edges: [] }

  const px = (lng: number) => DAEGU_MAP.A * lng + DAEGU_MAP.B
  const py = (lat: number) => DAEGU_MAP.C * lat + DAEGU_MAP.D
  const nodes: Node[] = raw.map(r => ({
    key: r.placeName, placeName: r.placeName, lat: r.lat, lng: r.lng,
    x: px(r.lng), y: py(r.lat), categories: Array.from(r.cats), count: r.count, links: 0,
  }))

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
}

/* 노드들이 화면을 알맞게 채우도록 초기 줌/팬을 계산(빈 남부는 잘라내고 별무리를 가운데로).
   pad = 노드 bounding box 바깥에 남길 여백 비율(라벨 공간 확보용). */
function fitTransform(nodes: Node[], pad = 0.46): Tf {
  if (nodes.length === 0) return { k: 1, tx: 0, ty: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of nodes) {
    if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y
  }
  const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1)
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const k = Math.min(MAX_K, Math.max(MIN_K, (VB * (1 - pad)) / Math.max(bw, bh)))
  return { k, tx: VB / 2 - k * cx, ty: VB / 2 - k * cy }
}

export default function ConstellationMap({ embedded = false, onOpenStories, spots: spotsProp }: { embedded?: boolean; onOpenStories?: (placeName: string) => void; spots?: Spot[] } = {}) {
  const [loadedSpots, setLoadedSpots] = useState<Spot[]>(MOCK_SPOTS)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover]       = useState<string | null>(null)
  const [openStory, setOpenStory] = useState<string | null>(null)  // 드로어에서 펼쳐 읽는 사연
  // 초기 줌/팬 = 별무리에 맞춘 fit 뷰(MOCK_SPOTS 기준, 첫 렌더부터 프레이밍)
  const [tf, setTf]             = useState<Tf>(() => fitTransform(buildGraph(MOCK_SPOTS).nodes))
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)  // 드래그 직후 발생하는 click 무시
  const touchPan = useRef<{ sx: number; sy: number; tx: number; ty: number; moved: boolean } | null>(null)
  const touchPinch = useRef<{ dist: number; mx: number; my: number } | null>(null)
  const tfRef = useRef(tf)  // 최신 트랜스폼(네이티브 터치 핸들러에서 참조)
  tfRef.current = tf

  useEffect(() => {
    if (spotsProp) return  // 외부(앱)에서 spots를 주면 자체 로딩 생략(승인된 제보 포함 목록 사용)
    try {
      const raw = localStorage.getItem(LS_KEY)
      const local: Spot[] = raw ? JSON.parse(raw) : []
      const ids = new Set(local.map(s => s.id))
      setLoadedSpots([...local, ...MOCK_SPOTS.filter(s => !ids.has(s.id))])
    } catch { /* mock만 */ }
  }, [spotsProp])

  // 외부 prop이 있으면 그걸(승인 제보 포함), 없으면 자체 로딩(mock+로컬) 사용
  const spots = spotsProp ?? loadedSpots
  const { nodes, edges } = useMemo(() => buildGraph(spots), [spots])
  const fitTf = useMemo(() => fitTransform(nodes), [nodes])

  /* 별먼지 — 화면을 넉넉히 덮도록, 크기·밝기·반짝임 다양하게 */
  const stars = useMemo(() => {
    const rnd = mulberry32(20260811)
    const arr: { x: number; y: number; r: number; o: number; tw: boolean; dur: string; d: string }[] = []
    for (let i = 0; i < 280; i++) {
      const big = rnd() < 0.05
      arr.push({
        x: -700 + rnd() * 2400,
        y: -400 + rnd() * 1800,
        r: big ? 1.6 + rnd() * 1.3 : 0.4 + rnd() * 1.1,
        o: 0.1 + rnd() * 0.7,
        tw: rnd() < 0.4,
        dur: (2.4 + rnd() * 3.6).toFixed(2),
        d: (rnd() * 4).toFixed(2),
      })
    }
    return arr
  }, [])

  /* 라벨 위치 오프셋(점 기준) — 겹치지 않게 상/하/좌/우 후보 중 선택 */
  const labelLayout = useMemo(() => {
    const fs = 20
    type Box = { x0: number; y0: number; x1: number; y1: number }
    const overlaps = (a: Box, b: Box) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1)
    const boxes: Box[] = nodes.map(n => ({ x0: n.x - 9, y0: n.y - 9, x1: n.x + 9, y1: n.y + 9 }))
    const layout = new Map<string, { dx: number; dy: number; anchor: 'middle' | 'start' | 'end' }>()
    for (const n of [...nodes].sort((a, b) => a.y - b.y)) {
      const w = n.placeName.length * fs * 0.62
      const cands = [
        { x: n.x, y: n.y - 20, anchor: 'middle' as const, box: { x0: n.x - w / 2, y0: n.y - 20 - fs, x1: n.x + w / 2, y1: n.y - 20 } },
        { x: n.x, y: n.y + 30, anchor: 'middle' as const, box: { x0: n.x - w / 2, y0: n.y + 30 - fs, x1: n.x + w / 2, y1: n.y + 30 } },
        { x: n.x + 14, y: n.y + fs / 3, anchor: 'start' as const, box: { x0: n.x + 14, y0: n.y + fs / 3 - fs, x1: n.x + 14 + w, y1: n.y + fs / 3 } },
        { x: n.x - 14, y: n.y + fs / 3, anchor: 'end' as const, box: { x0: n.x - 14 - w, y0: n.y + fs / 3 - fs, x1: n.x - 14, y1: n.y + fs / 3 } },
      ]
      let best = cands[0], bestCount = Infinity
      for (const c of cands) {
        let cnt = 0
        for (const b of boxes) if (overlaps(c.box, b)) cnt++
        if (cnt < bestCount) { bestCount = cnt; best = c; if (cnt === 0) break }
      }
      boxes.push(best.box)
      layout.set(n.key, { dx: best.x - n.x, dy: best.y - n.y, anchor: best.anchor })
    }
    return layout
  }, [nodes])

  const nodeByKey = useMemo(() => new Map(nodes.map(n => [n.key, n])), [nodes])
  const active = selected ?? hover
  const connectedKeys = useMemo(() => {
    if (!active) return new Set<string>()
    const set = new Set<string>()
    for (const e of edges) { if (e.a === active) set.add(e.b); if (e.b === active) set.add(e.a) }
    return set
  }, [active, edges])
  const sel = selected ? nodeByKey.get(selected) ?? null : null

  /* ── 줌/팬 ── */
  const clientToSvg = (cx: number, cy: number) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  const zoomAt = (px: number, py: number, mult: number) => setTf(cur => {
    const nk = Math.min(MAX_K, Math.max(MIN_K, cur.k * mult))
    const f = nk / cur.k
    return { k: nk, tx: px - f * (px - cur.tx), ty: py - f * (py - cur.ty) }
  })
  // 휠 줌(포인터 기준) — passive:false 로 직접 등록
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = clientToSvg(e.clientX, e.clientY)
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0016))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  // 터치(모바일): 한 손가락 팬 + 두 손가락 핀치 줌/축소 — 네이티브 이벤트로 안정 처리
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const d2 = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const scaleOf = () => svg.getScreenCTM()?.a || 1

    const onStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        touchPan.current = null
        const a = e.touches[0], b = e.touches[1]
        touchPinch.current = { dist: d2(a, b), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 }
      } else if (e.touches.length === 1) {
        const t = e.touches[0]
        touchPan.current = { sx: t.clientX, sy: t.clientY, tx: tfRef.current.tx, ty: tfRef.current.ty, moved: false }
        touchPinch.current = null
      }
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length >= 2 && touchPinch.current) {   // ── 두 손가락 핀치(확대·축소) ──
        e.preventDefault()
        const a = e.touches[0], b = e.touches[1]
        const dist = d2(a, b)
        const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2
        const prev = touchPinch.current
        if (prev.dist > 0) {
          const p = clientToSvg(mx, my)
          zoomAt(p.x, p.y, dist / prev.dist)               // 손가락 간 거리 비율 = 배율(양방향)
          const s = scaleOf()
          setTf(cur => ({ ...cur, tx: cur.tx + (mx - prev.mx) / s, ty: cur.ty + (my - prev.my) / s }))
        }
        touchPinch.current = { dist, mx, my }
        suppressClick.current = true
      } else if (e.touches.length === 1 && touchPan.current) {  // ── 한 손가락 팬 ──
        const t = e.touches[0]
        const d = touchPan.current
        const s = scaleOf()
        const dx = (t.clientX - d.sx) / s, dy = (t.clientY - d.sy) / s
        if (Math.abs(t.clientX - d.sx) + Math.abs(t.clientY - d.sy) > 4) { d.moved = true; suppressClick.current = true; e.preventDefault() }
        setTf(cur => ({ ...cur, tx: d.tx + dx, ty: d.ty + dy }))
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) { touchPan.current = null; touchPinch.current = null }
      else if (e.touches.length === 1) {                   // 두 손가락→한 손가락: 팬 재개
        touchPinch.current = null
        const t = e.touches[0]
        touchPan.current = { sx: t.clientX, sy: t.clientY, tx: tfRef.current.tx, ty: tfRef.current.ty, moved: true }
      } else {
        const a = e.touches[0], b = e.touches[1]
        touchPinch.current = { dist: d2(a, b), mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 }
      }
    }
    svg.addEventListener('touchstart', onStart, { passive: false })
    svg.addEventListener('touchmove', onMove, { passive: false })
    svg.addEventListener('touchend', onEnd)
    svg.addEventListener('touchcancel', onEnd)
    return () => {
      svg.removeEventListener('touchstart', onStart)
      svg.removeEventListener('touchmove', onMove)
      svg.removeEventListener('touchend', onEnd)
      svg.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // ── 마우스 팬(데스크탑) ── 터치는 아래 네이티브 터치 핸들러가 처리.
  // 포인터 캡처는 쓰지 않음(캡처하면 click 타깃이 노드가 아니라 SVG로 잡혀 선택이 안 됨)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { sx: e.clientX, sy: e.clientY, tx: tf.tx, ty: tf.ty, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const d = drag.current
    if (!d) return
    if (!(e.buttons & 1)) { drag.current = null; return }  // 버튼이 떼어졌으면 종료
    const svg = svgRef.current
    const s = svg?.getScreenCTM()?.a || 1
    const dx = (e.clientX - d.sx) / s, dy = (e.clientY - d.sy) / s
    if (Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 4) d.moved = true
    setTf(cur => ({ ...cur, tx: d.tx + dx, ty: d.ty + dy }))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    if (drag.current?.moved) suppressClick.current = true  // 팬 직후 click은 무시
    drag.current = null
  }
  const zoomBtn = (mult: number) => zoomAt(500, 500, mult)
  const reset = () => setTf(fitTf)   // 처음 위치 = 별무리 fit 뷰
  // 노드 더블클릭 → 그 장소를 화면 중앙으로 확대(겹친 장소 분리에 유용)
  const focusNode = (n: Node) => setTf(cur => {
    const nk = Math.min(MAX_K, Math.max(cur.k * 2, 4))
    return { k: nk, tx: 500 - nk * n.x, ty: 500 - nk * n.y }
  })

  const inv = 1 / tf.k  // 마커·라벨을 화면상 일정 크기로 유지(역보정)

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(130% 100% at 50% 28%, #0b0d18 0%, #06070e 55%, #000 100%)' }}>

      {/* 헤더 / 게이지 */}
      {embedded ? (
        <div style={{ position: 'absolute', top: '14px', right: '18px', zIndex: 6 }}>
          <Gauge count={nodes.length} />
        </div>
      ) : (
        <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', zIndex: 5 }}>
          <div>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(228,230,245,0.6)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13,4 7,10 13,16" /></svg>
              돌아가기
            </Link>
            <p style={{ fontFamily: FONT_BRAND, fontSize: '30px', color: '#EFE3C4', lineHeight: 1.1, marginTop: '8px' }}>낭만 별자리 지도</p>
            <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: 'rgba(205,210,235,0.5)', marginTop: '4px', letterSpacing: '0.02em' }}>
              밤하늘에 뜬 우리들의 자리 · 장소 {nodes.length}곳
            </p>
          </div>
          <Gauge count={nodes.length} />
        </header>
      )}

      {/* 밤하늘 SVG */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <svg ref={svgRef} viewBox={`0 0 ${VB} ${VB}`} preserveAspectRatio="xMidYMid meet"
             style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
             onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onPointerLeave={onPointerUp}
             onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } setSelected(null) }}>
          <defs>
            <radialGradient id="starGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFF4D8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#FFF4D8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* 별먼지 — 고정 배경(줌 영향 없음) */}
          <g>
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o}
                className={s.tw ? 'star-tw' : undefined}
                style={s.tw ? { animationDuration: `${s.dur}s`, animationDelay: `${s.d}s` } : undefined} />
            ))}
          </g>

          {/* 줌/팬 대상: 대구 지도 + 성좌선 + 별(노드) */}
          <g transform={`translate(${tf.tx} ${tf.ty}) scale(${tf.k})`}>
            {/* 대구 자치구 경계 — 얇고 은은하게 */}
            <g fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
              {DAEGU_MAP.paths.map((d, i) => <path key={`m${i}`} d={d} stroke="rgba(150,168,220,0.16)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
            </g>

            {/* 성좌선 */}
            {edges.map((e, i) => {
              const a = nodeByKey.get(e.a)!, b = nodeByKey.get(e.b)!
              const isOn = active != null && (e.a === active || e.b === active)
              return (
                <line key={e.key} className="const-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isOn ? '#F4D58A' : 'rgba(200,208,240,0.34)'} strokeWidth={isOn ? 1.6 : 1}
                  strokeOpacity={active == null ? 1 : isOn ? 1 : 0.18} vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${i * 0.06}s`, transition: 'stroke 0.2s, stroke-opacity 0.2s' }} />
              )
            })}

            {/* 별(노드) — 화면상 일정 크기로(inv 역보정). 사연이 많을수록 크고 밝게 + 둘레 링. */}
            {nodes.map((n, i) => {
              const isActive = active === n.key
              const isConn = connectedKeys.has(n.key)
              const dim = active != null && !isActive && !isConn
              const lab = labelLayout.get(n.key) ?? { dx: 0, dy: -20, anchor: 'middle' as const }
              // 사연 수(count) → 크기·밝기 스케일(sqrt로 완만하게, 상한선 둠)
              const grow    = Math.sqrt(n.count) - 1               // 1개=0, 3개≈0.73, 9개=2
              const sizeMul = 1 + Math.min(0.95, grow * 0.5)        // 1 ~ 1.95
              const glowMul = 1 + Math.min(1.1, grow * 0.6)         // 후광 크기
              const bright  = Math.min(0.95, 0.5 + (n.count - 1) * 0.12) // 후광 밝기
              // 사연이 겹겹이 쌓인 곳: 둘레 동심원(2개↑부터, 최대 3겹)
              const rings   = Math.min(3, Math.max(0, n.count - 1))
              const coreR   = (isActive ? 3.4 : 2.6) * sizeMul
              return (
                <g key={n.key} className="const-node" style={{ animationDelay: `${0.3 + i * 0.05}s`, cursor: 'pointer', opacity: dim ? 0.4 : 1, transition: 'opacity 0.2s' }}
                   onClick={(ev) => { ev.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return } setSelected(prev => prev === n.key ? null : n.key) }}
                   onDoubleClick={(ev) => { ev.stopPropagation(); focusNode(n) }}
                   onMouseEnter={() => setHover(n.key)} onMouseLeave={() => setHover(null)}>
                  {/* 넓은 투명 클릭 영역(화면상 ~20px 고정) — 작아도 누르기 쉽게 */}
                  <circle cx={n.x} cy={n.y} r={20 * inv} fill="transparent" />
                  {/* 사연 수만큼 둘레에 도는 옅은 링(겹겹이 쌓인 이야기) */}
                  {Array.from({ length: rings }).map((_, ri) => (
                    <circle key={ri} className={dim ? undefined : 'const-ring'}
                      cx={n.x} cy={n.y} r={(coreR + 5 + ri * 4.5) * inv}
                      fill="none" stroke="#FFF2CE" strokeWidth={0.7 * inv}
                      opacity={dim ? 0.08 : undefined}
                      style={{ pointerEvents: 'none', animationDelay: `${ri * 0.5}s` }} />
                  ))}
                  <circle cx={n.x} cy={n.y} r={(isActive ? 30 : 20) * glowMul * inv} fill="url(#nodeGlow)" opacity={isActive ? 1 : bright} style={{ pointerEvents: 'none' }} />
                  <circle cx={n.x} cy={n.y} r={coreR * inv} fill="#FFF6DC" />
                  <circle cx={n.x} cy={n.y} r={(isActive ? 1.7 : 1.3) * sizeMul * inv} fill="#FFFFFF" />
                  <text x={n.x + lab.dx * inv} y={n.y + lab.dy * inv} textAnchor={lab.anchor}
                        fontFamily="var(--font-sans)" fontSize={(isActive ? 23 : 20) * inv} letterSpacing={0.2 * inv}
                        fill={isActive ? '#FFF7E6' : dim ? '#7a7d9c' : 'rgba(220,226,246,0.95)'} style={{ pointerEvents: 'none', fontWeight: isActive ? 600 : 500, paintOrder: 'stroke', stroke: 'rgba(6,7,14,0.55)', strokeWidth: 3 * inv }}>
                    {n.placeName}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* 줌 컨트롤 (우측 사연 드로어와 겹치지 않게 좌측 하단) */}
        <div style={{ position: 'absolute', left: '16px', bottom: '16px', zIndex: 8, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <ZoomBtn label="확대" onClick={() => zoomBtn(1.6)}><line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" /></ZoomBtn>
          <ZoomBtn label="축소" onClick={() => zoomBtn(1 / 1.6)}><line x1="4" y1="10" x2="16" y2="10" /></ZoomBtn>
          <ZoomBtn label="처음 위치" onClick={reset}><g transform="translate(2 2) scale(0.667)" strokeWidth="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></g></ZoomBtn>
        </div>
      </div>

      {/* 우측 사연 드로어 — 지명 클릭 시 그곳의 사연을 바로 보여줌 */}
      {sel && (() => {
        const selSpots = spots
          .filter(s => s.placeName === sel.placeName)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return (
          <aside style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(400px, 92%)', zIndex: 12,
            background: 'rgba(9,10,20,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
            borderLeft: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column',
            animation: 'drawer-in 0.28s ease-out', boxShadow: '-18px 0 44px rgba(0,0,0,0.45)' }}>

            {/* 헤더 */}
            <header style={{ flexShrink: 0, padding: '20px 22px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: FONT_BRAND, fontSize: '24px', color: '#EFE3C4', lineHeight: 1.2, wordBreak: 'keep-all' }}>{sel.placeName}</p>
                  <p style={{ fontFamily: FONT_UI, fontSize: '12.5px', color: 'rgba(205,210,235,0.55)', marginTop: '7px', letterSpacing: '0.04em' }}>사연 {selSpots.length}개 · 연결 {sel.links}곳</p>
                  <a href={`https://map.naver.com/v5/search/${encodeURIComponent(sel.placeName)}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: FONT_UI, fontSize: '12.5px', color: 'rgba(126,209,174,0.95)', marginTop: '10px', textDecoration: 'none' }}>
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2C6.5 2 4 4.6 4 8c0 4.2 6 10 6 10s6-5.8 6-10c0-3.4-2.5-6-6-6Z" /><circle cx="10" cy="8" r="2" /></svg>
                    네이버 지도에서 보기
                  </a>
                </div>
                <button onClick={() => setSelected(null)} aria-label="닫기"
                  style={{ flexShrink: 0, width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(235,238,250,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" /></svg>
                </button>
              </div>
            </header>

            {/* 사연 목록 — 여러 개면 제목 목록으로 다 보이고, 클릭하면 하나씩 펼쳐 읽기 */}
            <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selSpots.length === 0
                ? <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: 'rgba(205,210,235,0.5)', textAlign: 'center', marginTop: '30px' }}>아직 사연이 없어요</p>
                : selSpots.map(s => (
                    <StoryCardDark key={s.id} spot={s}
                      single={selSpots.length === 1}
                      expanded={selSpots.length === 1 || openStory === s.id}
                      onToggle={() => setOpenStory(prev => (prev === s.id ? null : s.id))} />
                  ))}
            </div>

            {/* 푸터 — 엽서 리더로 크게 보기 */}
            {onOpenStories && (
              <div style={{ flexShrink: 0, padding: '12px 18px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => onOpenStories(sel.placeName)}
                  style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', fontFamily: FONT_UI, fontSize: '13px', color: '#141118', background: '#EFE3C4', border: 'none', borderRadius: '10px', padding: '11px 0', cursor: 'pointer', fontWeight: 500 }}>
                  엽서로 크게 읽기
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="10" x2="15" y2="10" /><polyline points="10,5 15,10 10,15" /></svg>
                </button>
              </div>
            )}
          </aside>
        )
      })()}
    </div>
  )
}

/* 우측 드로어용 사연 카드 (다크) */
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
function StoryCardDark({ spot, expanded, single, onToggle }: { spot: Spot; expanded: boolean; single: boolean; onToggle: () => void }) {
  const color = CAT_COLOR[spot.category] ?? '#EFE3C4'
  return (
    <article style={{ flexShrink: 0, background: expanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.035)', border: `1px solid ${expanded ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`, borderRadius: '12px', overflow: 'hidden', transition: 'background 0.2s, border-color 0.2s' }}>
      {/* 헤더 — 클릭하면 펼침/접힘 (사연 1개면 항상 펼침) */}
      <button type="button" onClick={single ? undefined : onToggle} aria-expanded={expanded}
        style={{ width: '100%', textAlign: 'left', padding: '13px 15px', background: 'transparent', border: 'none', cursor: single ? 'default' : 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: FONT_UI, fontSize: '11px', color, letterSpacing: '0.1em' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, display: 'inline-block' }} />{spot.category}
          </span>
          <span style={{ fontFamily: FONT_UI, fontSize: '11px', color: 'rgba(205,210,235,0.45)' }}>{formatDate(spot.createdAt)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <p style={{ flex: 1, fontFamily: FONT_BRAND, fontSize: '21px', color: '#F3EEE0', lineHeight: 1.3, wordBreak: 'keep-all' }}>{spot.title || '무제'}</p>
          {!single && (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="rgba(205,210,235,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '4px', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <polyline points="5,8 10,13 15,8" />
            </svg>
          )}
        </div>
        {/* 접힘 상태: 미리보기 2줄 */}
        {!expanded && (
          <p style={{ fontFamily: FONT_UI, fontSize: '13.5px', color: 'rgba(210,215,238,0.62)', lineHeight: 1.75, marginTop: '7px', wordBreak: 'keep-all',
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {spot.moment}
          </p>
        )}
      </button>

      {/* 펼침 상태: 본문 전체 */}
      {expanded && (
        <div style={{ padding: '0 15px 16px' }}>
          {spot.imageUrl && (
            <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', marginBottom: '12px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={spot.imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          <p style={{ fontFamily: FONT_BRAND, fontSize: '13px', color: 'rgba(205,210,235,0.5)', marginBottom: '11px' }}>by {spot.nickname || '익명'}</p>
          <p style={{ fontFamily: FONT_UI, fontSize: '15px', color: 'rgba(228,231,246,0.9)', lineHeight: 1.95, wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{spot.moment}</p>
          {spot.sns && (
            <p style={{ fontFamily: FONT_UI, fontSize: '12.5px', color: 'rgba(150,178,235,0.85)', marginTop: '14px', wordBreak: 'break-all' }}>🔗 {spot.sns}</p>
          )}
        </div>
      )}
    </article>
  )
}

/* 줌 버튼 */
function ZoomBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(235,238,250,0.85)' }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </button>
  )
}

/* 원형 눈금 게이지 */
function Gauge({ count }: { count: number }) {
  const size = 96, cx = size / 2, cy = size / 2
  const R = 40, ticks = 60
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {Array.from({ length: ticks }).map((_, i) => {
        const ang = (i / ticks) * Math.PI * 2 - Math.PI / 2
        const len = 4 + (i % 5 === 0 ? 7 : i % 2 === 0 ? 3 : 1)
        const r1 = R, r2 = R - len
        const rd = (v: number) => Math.round(v * 100) / 100
        return (
          <line key={i}
            x1={rd(cx + Math.cos(ang) * r1)} y1={rd(cy + Math.sin(ang) * r1)}
            x2={rd(cx + Math.cos(ang) * r2)} y2={rd(cy + Math.sin(ang) * r2)}
            stroke="rgba(216,222,255,0.4)" strokeWidth={i % 5 === 0 ? 1.4 : 0.8} />
        )
      })}
      <circle cx={cx} cy={cy} r={R - 14} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="var(--font-brand)" fontSize={22} fill="#EFE3C4">{count}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontFamily="var(--font-sans)" fontSize={7} letterSpacing="1.5" fill="rgba(205,210,235,0.6)">PLACES</text>
    </svg>
  )
}
