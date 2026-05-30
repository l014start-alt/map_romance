'use client'

import type { PinData } from './LocationPicker'

interface PlacePreviewCardProps {
  pin: PinData
  onConfirm: () => void
  onReselect: () => void
}

export default function PlacePreviewCard({ pin, onConfirm, onReselect }: PlacePreviewCardProps) {
  const isLoading = !pin.address || pin.address === '주소 확인 중…'

  /* ── 타이틀 결정 ──
     1순위: placeName (검색 결과에서 온 장소명, 예: "대구역")
     2순위: shortName (역지오코딩에서 파싱한 짧은 이름, 예: "중앙대로 484")
     3순위: 로딩 중 / 주소 없음 폴백                          */
  const title = pin.placeName ?? pin.shortName ?? (isLoading ? null : pin.address)

  /* ── 주소 부제 (타이틀과 다를 때만 표시) ── */
  const subtitle = pin.address && !isLoading && pin.address !== title ? pin.address : null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        zIndex: 500,
        background: '#FAF8F5',
        borderRadius: '16px 16px 0 0',
        padding: '0 20px 36px',
        boxShadow: '0 -6px 32px rgba(0,0,0,0.13)',
      }}
    >
      {/* 핸들 바 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}>
        <div style={{ width: '36px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
      </div>

      {/* 장소 정보 */}
      <div style={{ marginBottom: '22px' }}>

        {/* 타이틀 */}
        {isLoading || !title ? (
          /* 로딩 스켈레톤 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              height: '20px', width: '55%',
              background: 'linear-gradient(90deg, #EDE9E4 25%, #F5F2EE 50%, #EDE9E4 75%)',
              backgroundSize: '200% 100%',
              borderRadius: '4px',
              animation: 'shimmer 1.4s infinite linear',
            }} />
            <div style={{
              height: '13px', width: '80%',
              background: 'linear-gradient(90deg, #EDE9E4 25%, #F5F2EE 50%, #EDE9E4 75%)',
              backgroundSize: '200% 100%',
              borderRadius: '4px',
              animation: 'shimmer 1.4s infinite linear 0.2s',
            }} />
          </div>
        ) : (
          <>
            <p style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '18px',
              fontWeight: 700,
              color: '#111',
              margin: '0 0 5px',
              lineHeight: 1.25,
              wordBreak: 'keep-all',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </p>
            {subtitle && (
              <p style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                color: '#9B9590',
                margin: 0,
                lineHeight: 1.5,
              }}>
                {subtitle}
              </p>
            )}
          </>
        )}
      </div>

      {/* shimmer 키프레임 (인라인 style 태그) */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* 버튼 영역 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: '100%',
            padding: '15px 0',
            background: '#800020',
            color: '#FAF8F5',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.05em',
            borderRadius: '8px',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
        >
          이 위치에 사연 기록하기
        </button>

        <button
          type="button"
          onClick={onReselect}
          style={{
            width: '100%',
            padding: '13px 0',
            border: '1px solid #EDE9E4',
            color: '#6B6560',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            borderRadius: '8px',
            background: 'transparent',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F5F2EE' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          위치 다시 선택
        </button>
      </div>
    </div>
  )
}
