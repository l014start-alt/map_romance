'use client'

import type { PinData } from './LocationPicker'

interface PlacePreviewCardProps {
  pin: PinData
  onConfirm: () => void
  onReselect: () => void
}

export default function PlacePreviewCard({ pin, onConfirm, onReselect }: PlacePreviewCardProps) {
  const displayName = pin.placeName || pin.address || '선택한 위치'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        zIndex: 500,
        background: '#FAF8F5',
        borderRadius: '14px 14px 0 0',
        padding: '0 20px 32px',
        boxShadow: '0 -4px 28px rgba(0,0,0,0.14)',
      }}
    >
      {/* 핸들 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
        <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
      </div>

      {/* 장소 정보 */}
      <div style={{ marginBottom: '20px' }}>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
          fontWeight: 600,
          color: '#111',
          margin: '0 0 4px',
          lineHeight: 1.3,
          wordBreak: 'keep-all',
        }}>
          {displayName}
        </p>
        {pin.placeName && pin.address && (
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '11px',
            color: '#B5B0AB',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {pin.address}
          </p>
        )}
      </div>

      {/* 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: '100%',
            padding: '14px 0',
            background: '#800020',
            color: '#FAF8F5',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            borderRadius: '6px',
            transition: 'opacity 0.2s',
          }}
        >
          이 위치에 사연 기록하기
        </button>
        <button
          type="button"
          onClick={onReselect}
          style={{
            width: '100%',
            padding: '12px 0',
            border: '1px solid #EDE9E4',
            color: '#6B6560',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            cursor: 'pointer',
            letterSpacing: '0.02em',
            borderRadius: '6px',
            transition: 'all 0.15s',
          }}
        >
          위치 다시 선택
        </button>
      </div>
    </div>
  )
}
