'use client'

import { useState } from 'react'
import { Spot } from '@/types'

interface FeedViewProps {
  spots: Spot[]
  onGoToPlace: (spot: Spot) => void
}

const CATEGORY_COLOR: Record<string, string> = { 낭만: '#800020', 젊음: '#2A6040', 사랑: '#B0402B' }

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function FeedCard({ spot, onGoToPlace }: { spot: Spot; onGoToPlace: (s: Spot) => void }) {
  const [expanded, setExpanded] = useState(false)
  const color = CATEGORY_COLOR[spot.category] ?? '#800020'
  const imgSrc = spot.imageUrl

  return (
    <article style={{ background: '#FFFFFF', marginBottom: '10px', overflow: 'hidden' }}>
      {/* 사진 */}
      {imgSrc && (
        <div style={{ width: '100%', aspectRatio: '16/9', overflow: 'hidden', background: '#F0EDE8' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      <div style={{ padding: '16px 20px 18px' }}>
        {/* 카테고리 + 날짜 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color, letterSpacing: '0.18em', fontWeight: 600 }}>
            {spot.category}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.06em' }}>
            {formatDate(spot.createdAt)}
          </span>
        </div>

        {/* 제목 */}
        {spot.title && (
          <p style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', color: '#111', lineHeight: 1.3, marginBottom: '4px', wordBreak: 'keep-all' }}>
            {spot.title}
          </p>
        )}

        {/* 닉네임 */}
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: '13px', color: '#B5B0AB', marginBottom: '12px', letterSpacing: '0.02em' }}>
          by {spot.nickname || '익명'}
        </p>

        {/* 사연 본문 */}
        <p
          onClick={() => setExpanded(!expanded)}
          style={{
            fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#2A2520', lineHeight: 1.9, wordBreak: 'keep-all',
            cursor: spot.moment.length > 80 ? 'pointer' : 'default',
            display: '-webkit-box', WebkitLineClamp: expanded ? undefined : 3,
            WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden',
          }}
        >
          {spot.moment}
        </p>
        {!expanded && spot.moment.length > 100 && (
          <button type="button" onClick={() => setExpanded(true)}
            style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', marginTop: '4px', cursor: 'pointer', letterSpacing: '0.04em' }}>
            더 보기
          </button>
        )}

        {/* 장소명 태그 */}
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => onGoToPlace(spot)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: '#FFF5F5', borderRadius: '99px', fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#800020', cursor: 'pointer', transition: 'background 0.15s', letterSpacing: '0.02em' }}
          >
            <span style={{ fontSize: '10px' }}>📍</span>
            {spot.placeName}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function FeedView({ spots, onGoToPlace }: FeedViewProps) {
  const [filter, setFilter] = useState<'all' | '낭만' | '젊음' | '사랑'>('all')

  const sorted = [...spots]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter(s => filter === 'all' || s.category === filter)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF8F5' }}>

      {/* 피드 헤더 */}
      <div style={{ padding: '16px 20px 0', background: '#FAF8F5', flexShrink: 0 }}>
        {/* 카테고리 필터 */}
        <div style={{ display: 'flex', gap: '6px', paddingBottom: '14px', borderBottom: '1px solid #EDE9E4' }}>
          {(['all', '낭만', '젊음', '사랑'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px', borderRadius: '99px', fontFamily: 'var(--font-sans)', fontSize: '11px', cursor: 'pointer',
                background: filter === f ? '#111' : '#F0EDE8',
                color: filter === f ? '#FAF8F5' : '#8A8480',
                transition: 'all 0.15s',
                letterSpacing: '0.04em',
              }}
            >
              {f === 'all' ? '전체' : f}
            </button>
          ))}
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', display: 'flex', alignItems: 'center', letterSpacing: '0.04em' }}>
            {sorted.length}개
          </span>
        </div>
      </div>

      {/* 카드 리스트 */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', padding: '10px 0 20px' }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '12px' }}>
            <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', color: '#C0BEBB' }}>아직 사연이 없어요</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#DED9D3' }}>지도에서 낭만을 기록해보세요</p>
          </div>
        ) : (
          sorted.map(spot => (
            <FeedCard key={spot.id} spot={spot} onGoToPlace={onGoToPlace} />
          ))
        )}
      </div>
    </div>
  )
}
