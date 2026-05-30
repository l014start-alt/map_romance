'use client'

import { useState } from 'react'

export interface PinData {
  lat: number
  lng: number
  address: string
  placeName?: string
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
}

export default function LocationPicker({ pin, onPinUpdate, onMapFlyTo, onConfirm, onCancel }: LocationPickerProps) {
  const [query, setQuery]       = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults]   = useState<SearchResult[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)

  const search = async () => {
    if (!query.trim() || searching) return
    setSearching(true)
    setError(null)
    setResults([])
    setShowResults(false)

    // 네이버 Maps SDK 클라이언트 지오코더 우선 사용 — 결과 없으면 서버(Nominatim) 폴백
    if (typeof window !== 'undefined' && window.naver?.maps?.Service?.geocode) {
      window.naver.maps.Service.geocode(
        { query: query.trim() },
        async (status, response) => {
          const ok = status === window.naver.maps.Service.Status.OK && response.v2.addresses.length > 0
          if (ok) {
            setSearching(false)
            const list: SearchResult[] = response.v2.addresses.slice(0, 5).map((addr) => ({
              lat: parseFloat(addr.y),
              lng: parseFloat(addr.x),
              address: addr.roadAddress || addr.jibunAddress,
              roadAddress: addr.roadAddress,
              jibunAddress: addr.jibunAddress,
            }))
            setResults(list)
            setShowResults(true)
            if (list.length === 1) selectResult(list[0])
          } else {
            // SDK 결과 없음 → 서버 API(Naver REST + Nominatim) 폴백
            try {
              const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
              const data = await res.json() as { results?: SearchResult[]; error?: string }
              setSearching(false)
              if (data.results && data.results.length > 0) {
                setResults(data.results)
                if (data.results.length === 1) {
                  selectResult(data.results[0])
                } else {
                  setShowResults(true)
                }
              } else {
                setError('위치를 찾을 수 없어요. 더 구체적으로 입력해보세요.')
              }
            } catch {
              setSearching(false)
              setError('검색 중 오류가 발생했어요.')
            }
          }
        }
      )
    } else {
      // 폴백: 서버 API 라우트 (Naver + Nominatim)
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json() as { results?: SearchResult[]; error?: string }
        setSearching(false)
        if (data.results && data.results.length > 0) {
          setResults(data.results)
          if (data.results.length === 1) {
            selectResult(data.results[0])
          } else {
            setShowResults(true)
          }
        } else {
          setError('위치를 찾을 수 없어요. 더 구체적으로 입력해보세요.')
        }
      } catch {
        setSearching(false)
        setError('검색 중 오류가 발생했어요.')
      }
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
        {pin ? `📍 ${pin.address || '위치 선택됨'}` : '지도를 클릭하거나 장소·주소를 검색해주세요'}
      </p>

      {/* 검색바 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: error ? '8px' : showResults ? '0' : '20px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); if (!e.target.value) { setResults([]); setShowResults(false) } }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search() } }}
          placeholder="장소명·주소 검색 (예: 대구역, 동성로)"
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
    </div>
  )
}
