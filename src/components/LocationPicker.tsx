'use client'

import { useState } from 'react'

export interface PinData {
  lat: number
  lng: number
  address: string
}

interface LocationPickerProps {
  pin: PinData | null
  onPinUpdate: (pin: PinData) => void
  onConfirm: () => void
  onCancel: () => void
}

export default function LocationPicker({ pin, onPinUpdate, onConfirm, onCancel }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
    const result = await res.json() as { lat?: number; lng?: number; address?: string; error?: string } | null
    setSearching(false)
    if (result && !result.error && result.lat != null && result.lng != null) {
      onPinUpdate({ lat: result.lat, lng: result.lng, address: result.address ?? '' })
    } else {
      setError('위치를 찾을 수 없어요. 더 구체적으로 입력해보세요.')
    }
  }

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
      <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
        <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
      </div>

      {/* 안내 문구 */}
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '11px',
        color: pin ? '#2A6040' : '#B5B0AB',
        textAlign: 'center', marginBottom: '16px', letterSpacing: '0.02em',
        transition: 'color 0.2s',
      }}>
        {pin ? `📍 ${pin.address || '위치 선택됨'}` : '지도를 클릭하거나 주소를 검색해주세요'}
      </p>

      {/* 검색바 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: error ? '8px' : '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
          placeholder="주소 검색 (예: 대구 중구 동성로)"
          style={{
            flex: 1,
            background: '#F0EDE8',
            borderRadius: '8px',
            padding: '11px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: '#111',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={!query.trim() || searching}
          style={{
            padding: '11px 18px',
            background: query.trim() && !searching ? '#800020' : '#EDE9E4',
            color: query.trim() && !searching ? '#FAF8F5' : '#C0BEBB',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            borderRadius: '8px',
            cursor: query.trim() && !searching ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
            letterSpacing: '0.04em',
          }}
        >
          {searching ? '…' : '검색'}
        </button>
      </div>

      {error && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', marginBottom: '16px', lineHeight: 1.5 }}>
          {error}
        </p>
      )}

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1, padding: '13px 0',
            border: '1px solid #EDE9E4',
            fontFamily: 'var(--font-sans)', fontSize: '12px',
            color: '#B5B0AB', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!pin}
          style={{
            flex: 2, padding: '13px 0',
            background: pin ? '#111' : '#EDE9E4',
            color: pin ? '#FAF8F5' : '#C0BEBB',
            fontFamily: 'var(--font-sans)', fontSize: '12px',
            cursor: pin ? 'pointer' : 'default',
            letterSpacing: '0.04em',
            transition: 'all 0.2s',
          }}
        >
          이 위치로 기록하기
        </button>
      </div>
    </div>
  )
}
