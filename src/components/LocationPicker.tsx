'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import QRCode from './QRCode'

export interface PinData {
  lat: number
  lng: number
  address: string
  placeName?: string
  /** 역지오코딩에서 추출한 짧은 장소명 (예: "중앙대로 484") */
  shortName?: string
}

interface SearchResult {
  lat: number
  lng: number
  address: string
  roadAddress?: string
  jibunAddress?: string
  placeName?: string
}

interface LocationPickerProps {
  pin: PinData | null
  onPinUpdate: (pin: PinData) => void
  onMapFlyTo: (lat: number, lng: number, zoom?: number) => void
  onConfirm: (pin?: PinData) => void
  onCancel: () => void
  /** 데스크탑(지도 없는 갤러리)에서 중앙 모달 + 검색 전용으로 표시 */
  desktop?: boolean
}

export default function LocationPicker({ pin, onPinUpdate, onMapFlyTo, onConfirm, onCancel, desktop = false }: LocationPickerProps) {
  const [query, setQuery]       = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]   = useState<SearchResult[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [siteUrl, setSiteUrl]   = useState('')  // QR용 현재 사이트 주소(모바일 접속)

  useEffect(() => { setSiteUrl(window.location.origin) }, [])

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    setResults([])
    setShowResults(false)

    // 정확도 우선: 서버 /api/geocode (카카오 장소(POI) 검색 → 네이버 → Nominatim)
    // 상호명으로도 정확히 찾도록 하고, 후보 목록을 항상 보여줘 사용자가 정확한 위치를 선택.
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json() as { results?: SearchResult[]; error?: string }
      setSearching(false)
      if (data.results && data.results.length > 0) {
        setResults(data.results)
        setShowResults(true)
      } else {
        setError('위치를 찾을 수 없어요. 상호명이나 주소를 더 구체적으로 입력해보세요.')
      }
    } catch {
      setSearching(false)
      setError('검색 중 오류가 발생했어요.')
    }
  }

  const selectResult = (result: SearchResult) => {
    const pinData: PinData = { lat: result.lat, lng: result.lng, address: result.address, placeName: result.placeName }
    onPinUpdate(pinData)
    onMapFlyTo(result.lat, result.lng, 17)
    setShowResults(false)
    setQuery(result.placeName || result.address)
    onConfirm(pinData)
  }

  const rootStyle: CSSProperties = desktop
    ? {
        position: 'absolute',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '460px', maxWidth: '92%',
        zIndex: 600,
        background: '#FAF8F5',
        borderRadius: '16px',
        padding: '26px 26px 28px',
        boxShadow: '0 16px 56px rgba(0,0,0,0.22)',
      }
    : {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        zIndex: 500,
        background: '#FAF8F5',
        borderRadius: '14px 14px 0 0',
        padding: '0 20px 32px',
        boxShadow: '0 -4px 28px rgba(0,0,0,0.14)',
      }

  const card = (
    <div style={rootStyle}>
      {/* 핸들 (모바일 바텀시트) */}
      {!desktop && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
        </div>
      )}

      {/* 데스크탑 타이틀 */}
      {desktop && (
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', color: '#800020', textAlign: 'center', marginBottom: '16px', lineHeight: 1.1 }}>
          어디에서의 낭만인가요?
        </p>
      )}

      {/* 안내 문구 */}
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: '11px',
        color: pin ? '#2A6040' : '#B5B0AB',
        textAlign: 'center', marginBottom: '16px', letterSpacing: '0.02em',
        transition: 'color 0.2s',
      }}>
        {pin ? `📍 ${pin.address || '위치 선택됨'}` : (desktop ? '장소명이나 주소로 검색해 위치를 지정하세요' : '지도를 클릭하거나 장소·주소를 검색해주세요')}
      </p>

      {/* 검색바 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: error ? '8px' : showResults ? '0' : '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); if (!e.target.value) { setResults([]); setShowResults(false) } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
          placeholder="가게 이름·장소·주소로 검색 (예: 김광석길, 수성못 카페)"
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

      {/* 검색 결과 리스트 */}
      {showResults && results.length > 0 && (
        <div style={{
          marginBottom: '16px',
          border: '1px solid #EDE9E4',
          borderRadius: '8px',
          overflow: 'hidden',
          background: '#FFFFFF',
        }}>
          {results.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectResult(result)}
              style={{
                width: '100%',
                padding: '11px 14px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                borderBottom: idx < results.length - 1 ? '1px solid #F0EDE8' : 'none',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FAF8F5' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#111', lineHeight: 1.4 }}>
                {result.placeName || result.roadAddress || result.jibunAddress || result.address}
              </span>
              {(result.roadAddress || result.jibunAddress) && (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#C0BEBB', lineHeight: 1.3 }}>
                  {result.roadAddress || result.jibunAddress}
                </span>
              )}
              {!result.roadAddress && !result.jibunAddress && result.placeName && result.address && (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#C0BEBB', lineHeight: 1.3 }}>
                  {result.address.slice(0, 60)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', marginBottom: '16px', lineHeight: 1.5 }}>
          {error}
        </p>
      )}

      {/* 버튼 */}
      {!showResults && (
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
            onClick={() => onConfirm()}
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
      )}

      {/* 결과 표시 중일 때 취소 버튼만 */}
      {showResults && (
        <button
          type="button"
          onClick={() => { setShowResults(false); setResults([]) }}
          style={{
            width: '100%', marginTop: '12px', padding: '13px 0',
            border: '1px solid #EDE9E4',
            fontFamily: 'var(--font-sans)', fontSize: '12px',
            color: '#B5B0AB', cursor: 'pointer',
          }}
        >
          취소
        </button>
      )}

      {/* 데스크탑(전시 키오스크) — 휴대폰으로 작성하도록 QR + 안내 */}
      {desktop && siteUrl && (
        <div style={{ marginTop: '22px', paddingTop: '20px', borderTop: '1px solid #EDE9E4', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ padding: '8px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #EDE9E4', flexShrink: 0 }}>
            <QRCode value={siteUrl} size={104} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-brand)', fontSize: '16px', color: '#800020', lineHeight: 1.3, marginBottom: '6px' }}>휴대폰으로 편하게 남기기</p>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11.5px', color: '#8A8480', lineHeight: 1.7, wordBreak: 'keep-all' }}>
              이 자리에서 바로 작성하셔도 좋고, QR을 휴대폰으로 스캔하면 내 자리에서 천천히 사연을 남길 수 있어요.
            </p>
          </div>
        </div>
      )}
    </div>
  )

  if (desktop) {
    return (
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(2px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      >
        {card}
      </div>
    )
  }
  return card
}
