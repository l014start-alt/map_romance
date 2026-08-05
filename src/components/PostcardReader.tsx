'use client'

/* ══════════════════════════════════════════════════════════════
   엽서 리더 — 사연을 한 번에 하나씩, 편지/엽서처럼 크게 펼쳐서 넘겨봄
   · 좌우 화살표 / 키보드(←→) / 모바일 스와이프로 이동 (순환)
   · 기존 사연 데이터(Spot)를 그대로 사용
   ══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react'
import { Spot } from '@/types'

const FONT_BRAND = 'var(--font-brand)'
const FONT_UI    = 'var(--font-sans)'

/* 깜빡이는 커서 */
function Caret() {
  return <span className="tw-cursor" aria-hidden="true">│</span>
}

/* 타자기 효과 — 제목 → (글쓴이 등장) → 본문 순서로 한 글자씩.
   실제 타자 느낌: 글자마다 속도가 살짝 다르고, 문장부호/줄바꿈에서 잠깐 멈춤.
   사연이 바뀌면(부모 key 변경) 처음부터 다시 타이핑. */
function TypedStory({ title, nickname, body }: { title: string; nickname: string; body: string }) {
  const [tN, setTN] = useState(0)
  const [bN, setBN] = useState(0)
  const [phase, setPhase] = useState<'title' | 'body' | 'done'>(title ? 'title' : 'body')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let ti = 0, bi = 0
    setTN(0); setBN(0); setPhase(title ? 'title' : 'body')

    // 글자별 지연 — 기본값 + 랜덤 흔들림, 문장부호에서 더 오래 쉼
    const jitter = (base: number) => base + Math.random() * 55
    const delayFor = (ch: string, base: number) => {
      if (ch === '\n') return base * 6
      if ('.!?…'.includes(ch)) return base * 8
      if (',·'.includes(ch)) return base * 3.5
      if (ch === ' ') return base * 1.5
      return jitter(base)
    }
    const TITLE_SPD = 95, BODY_SPD = 55

    const typeBody = () => {
      if (cancelled) return
      if (bi >= body.length) { setPhase('done'); return }
      const ch = body[bi]; bi += 1; setBN(bi)
      timer = setTimeout(typeBody, delayFor(ch, BODY_SPD))
    }
    const typeTitle = () => {
      if (cancelled) return
      if (ti >= title.length) { setPhase('body'); timer = setTimeout(typeBody, 450); return }
      const ch = title[ti]; ti += 1; setTN(ti)
      timer = setTimeout(typeTitle, delayFor(ch, TITLE_SPD))
    }

    timer = setTimeout(title ? typeTitle : typeBody, 320)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [title, body])

  return (
    <>
      {/* 제목 */}
      {title && (
        <p style={{ fontFamily: FONT_BRAND, fontSize: '30px', color: '#111', lineHeight: 1.3, marginBottom: '6px', wordBreak: 'keep-all', minHeight: '1.3em' }}>
          {title.slice(0, tN)}{phase === 'title' && <Caret />}
        </p>
      )}
      {/* 글쓴이 — 제목이 다 써진 뒤 등장 */}
      <p style={{ fontFamily: FONT_BRAND, fontSize: '15px', color: '#B5B0AB', marginBottom: '22px', letterSpacing: '0.02em', opacity: phase === 'title' ? 0 : 1, transition: 'opacity 0.5s' }}>
        by {nickname}
      </p>
      {/* 본문 */}
      <p style={{ fontFamily: FONT_UI, fontSize: '15px', color: '#2A2520', lineHeight: 2.05, wordBreak: 'keep-all', whiteSpace: 'pre-line', minHeight: '4.1em' }}>
        {body.slice(0, bN)}{phase === 'body' && <Caret />}
      </p>
    </>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function PostcardReader({ spots }: { spots: Spot[] }) {
  const [i, setI] = useState(0)
  const touchX = useRef<number | null>(null)

  // 목록이 바뀌면(필터 등) 인덱스 보정
  useEffect(() => { setI(prev => (spots.length === 0 ? 0 : Math.min(prev, spots.length - 1))) }, [spots.length])

  const total = spots.length
  const go = (dir: 1 | -1) => { if (total > 0) setI(prev => (prev + dir + total) % total) }

  // 키보드 좌우
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  if (total === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <p style={{ fontFamily: FONT_BRAND, fontSize: '26px', color: '#C0BEBB' }}>아직 사연이 없어요</p>
        <p style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#DED9D3' }}>‘낭만 기록하기’로 첫 사연을 남겨보세요</p>
      </div>
    )
  }

  const spot = spots[i]
  const naverUrl = `https://map.naver.com/v5/search/${encodeURIComponent(spot.placeName)}`

  return (
    <div
      style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 32px' }}
      className="no-scrollbar"
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)  // 왼쪽으로 밀면 다음
        touchX.current = null
      }}
    >
      {/* ── 엽서 카드 (index를 key로 줘서 넘길 때 부드럽게 등장) ── */}
      <article key={spot.id} className="const-node" style={{ width: '100%', maxWidth: '600px', background: '#FFFFFF', border: '1px solid #EDEAE5', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
        {spot.imageUrl && (
          <div style={{ width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', background: '#F0EDE8' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={spot.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <div style={{ padding: '28px 30px 30px' }}>
          {/* 날짜 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
            <span style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#C0BEBB', letterSpacing: '0.06em' }}>{formatDate(spot.createdAt)}</span>
          </div>

          {/* 제목 → 본문 순서로 타자기 효과 (사연이 바뀌면 처음부터) */}
          <TypedStory key={spot.id} title={spot.title ?? ''} nickname={spot.nickname || '익명'} body={spot.moment} />

          {/* 장소 */}
          <a href={naverUrl} target="_blank" rel="noopener noreferrer"
             style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '26px', padding: '8px 15px', background: '#FFF5F5', borderRadius: '99px', fontFamily: FONT_UI, fontSize: '12px', color: '#800020', textDecoration: 'none' }}>
            <span>📍</span>{spot.placeName}
            <span style={{ color: '#C99', marginLeft: '2px' }}>· 지도에서 보기</span>
          </a>
        </div>
      </article>

      {/* ── 넘기기 컨트롤 ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '26px' }}>
        <NavBtn dir="prev" onClick={() => go(-1)} />
        <span style={{ fontFamily: FONT_UI, fontSize: '13px', color: '#8A8480', letterSpacing: '0.08em', minWidth: '54px', textAlign: 'center' }}>
          <b style={{ color: '#800020', fontWeight: 600 }}>{i + 1}</b> / {total}
        </span>
        <NavBtn dir="next" onClick={() => go(1)} />
      </div>
    </div>
  )
}

function NavBtn({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={onClick} aria-label={dir === 'prev' ? '이전 사연' : '다음 사연'}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ width: '46px', height: '46px', borderRadius: '50%', background: hover ? '#800020' : '#FFFFFF', border: '1px solid #EDE9E4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', transition: 'all 0.16s' }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={hover ? '#FAF8F5' : '#800020'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
           style={{ transform: dir === 'next' ? 'scaleX(-1)' : 'none' }}>
        <polyline points="12,4 6,10 12,16" />
      </svg>
    </button>
  )
}
