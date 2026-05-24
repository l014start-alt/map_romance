'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Category } from '@/types'

interface RecordModalProps {
  onClose: () => void
  onSubmit: (data: {
    placeName: string
    address?: string
    lat?: number
    lng?: number
    category: Category
    moment: string
    nickname?: string
  }) => Promise<void>
}

const CATEGORIES: Category[] = ['낭만', '젊음', '사랑']
const MOMENT_MAX = 120

export default function RecordModal({ onClose, onSubmit }: RecordModalProps) {
  const [nickname, setNickname] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [foundAddress, setFoundAddress] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [moment, setMoment] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  const canSubmit =
    placeName.trim().length > 0 &&
    category !== null &&
    moment.trim().length > 0 &&
    moment.length <= MOMENT_MAX &&
    !submitting

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const searchAddress = async () => {
    if (!placeName.trim()) return
    setSearching(true)
    setSearchError(null)
    setFoundAddress(null)
    setCoords(null)
    try {
      const query = encodeURIComponent(placeName.trim())
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=ko`,
        { headers: { 'Accept-Language': 'ko' } }
      )
      const data = await res.json()
      if (data.length > 0) {
        const place = data[0]
        setFoundAddress(place.display_name.split(',').slice(0, 3).join(', '))
        setCoords({ lat: parseFloat(place.lat), lng: parseFloat(place.lon) })
      } else {
        setSearchError('위치를 찾지 못했어요. 더 구체적인 이름으로 검색해보세요.')
      }
    } catch {
      setSearchError('검색 중 오류가 발생했어요. 다시 시도해주세요.')
    } finally {
      setSearching(false)
    }
  }

  const handleMomentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length > MOMENT_MAX) return
    setMoment(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    try {
      await onSubmit({
        placeName: placeName.trim(),
        address: foundAddress ?? undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        category,
        moment: moment.trim(),
        nickname: nickname.trim() || undefined,
      })
      setDone(true)
    } catch {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(4px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          className="w-full max-w-lg flex flex-col items-center justify-center py-20 px-8"
          style={{
            background: '#FAF8F5',
            borderRadius: '14px 14px 0 0',
            minHeight: '40dvh',
          }}
        >
          <p
            className="text-center word-keep"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              color: '#2A2520',
              lineHeight: '2.0',
              letterSpacing: '-0.01em',
            }}
          >
            기록이 접수되었습니다.
          </p>
          <p
            className="mt-3 text-center word-keep"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              color: '#B5B0AB',
              lineHeight: '1.9',
            }}
          >
            검토 후 지도 위에 올라갑니다.<br />
            낭만을 남겨주셔서 감사해요.
          </p>
          <button
            onClick={onClose}
            className="mt-10"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: '#C0BEBB',
              letterSpacing: '0.06em',
              borderBottom: '1px solid #EDE9E4',
              paddingBottom: '1px',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-lg no-scrollbar"
        style={{
          maxHeight: '88dvh',
          overflowY: 'auto',
          background: '#FAF8F5',
          borderRadius: '14px 14px 0 0',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* ── 핸들 바 ── */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
        </div>

        {/* ── 헤더 ── */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: '#FAF8F5', borderBottom: '1px solid #EDE9E4' }}
        >
          <div style={{ width: '24px' }} />
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                fontWeight: 600,
                color: '#800020',
                letterSpacing: '0.04em',
              }}
            >
              낭만여지도
            </span>
            <span style={{ color: '#DED9D3', fontSize: '11px' }}>·</span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                color: '#C0BEBB',
                letterSpacing: '0.04em',
              }}
            >
              기록하기
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#B5B0AB',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-12 pt-8 flex flex-col gap-10">

          {/* ── 0. 닉네임 ── */}
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: '9px',
                color: '#C0BEBB',
                letterSpacing: '0.18em',
                marginBottom: '14px',
              }}
            >
              닉네임 <span style={{ color: '#DED9D3' }}>(선택)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="남기고 싶은 이름"
              maxLength={20}
              style={{
                width: '100%',
                background: 'transparent',
                fontFamily: 'var(--font-sans)',
                fontSize: '16px',
                color: '#111',
                paddingBottom: '12px',
                letterSpacing: '-0.01em',
                outline: 'none',
                borderBottom: '1px solid #EDE9E4',
              }}
            />
          </div>

          {/* ── 1. 장소 ── */}
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-sans)',
                fontSize: '9px',
                color: '#C0BEBB',
                letterSpacing: '0.18em',
                marginBottom: '14px',
              }}
            >
              장소
            </label>

            <div className="flex gap-3 items-end" style={{ borderBottom: '1px solid #EDE9E4' }}>
              <input
                type="text"
                value={placeName}
                onChange={(e) => {
                  setPlaceName(e.target.value)
                  setFoundAddress(null)
                  setCoords(null)
                  setSearchError(null)
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchAddress() } }}
                placeholder="장소 이름 또는 주소"
                style={{
                  flex: 1,
                  background: 'transparent',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '16px',
                  color: '#111',
                  paddingBottom: '12px',
                  letterSpacing: '-0.01em',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={searchAddress}
                disabled={!placeName.trim() || searching}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  color: placeName.trim() ? '#800020' : '#C8C4C0',
                  letterSpacing: '0.04em',
                  paddingBottom: '13px',
                  whiteSpace: 'nowrap',
                  cursor: placeName.trim() ? 'pointer' : 'default',
                  transition: 'color 0.2s',
                  flexShrink: 0,
                }}
              >
                {searching ? '검색 중…' : '위치 찾기'}
              </button>
            </div>

            {foundAddress && (
              <p
                className="mt-2 word-keep"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  color: '#800020',
                  lineHeight: '1.6',
                }}
              >
                ↳ {foundAddress}
              </p>
            )}
            {searchError && (
              <p
                className="mt-2 word-keep"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  color: '#C0BEBB',
                }}
              >
                {searchError}
              </p>
            )}
          </div>

          {/* ── 2. 낭만 카테고리 ── */}
          <div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '9px',
                color: '#C0BEBB',
                letterSpacing: '0.18em',
                marginBottom: '18px',
              }}
            >
              카테고리
            </p>
            <div className="flex gap-8">
              {CATEGORIES.map((c) => {
                const active = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(active ? null : c)}
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: '15px',
                      fontWeight: active ? 500 : 400,
                      color: active ? '#111' : '#C0BEBB',
                      letterSpacing: '-0.01em',
                      paddingBottom: '4px',
                      borderBottom: active ? '1.5px solid #111' : '1.5px solid transparent',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                    aria-pressed={active}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 3. 그곳에서의 순간 ── */}
          <div>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '9px',
                color: '#C0BEBB',
                letterSpacing: '0.18em',
                marginBottom: '14px',
              }}
            >
              그곳에서의 순간
            </p>
            <textarea
              ref={textareaRef}
              value={moment}
              onChange={handleMomentChange}
              placeholder="그곳에서 마주한 문장이나 장면을 자연스럽게 적어주세요."
              rows={4}
              className="word-keep"
              style={{
                width: '100%',
                background: 'transparent',
                fontFamily: 'var(--font-sans)',
                fontSize: '15px',
                color: '#111',
                lineHeight: '2.0',
                letterSpacing: '-0.01em',
                borderBottom: '1px solid #EDE9E4',
                paddingBottom: '12px',
                outline: 'none',
                resize: 'none',
                minHeight: '96px',
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '9px',
                  color: moment.length >= MOMENT_MAX ? '#800020' : 'transparent',
                  letterSpacing: '0.04em',
                }}
              >
                {moment.length >= MOMENT_MAX ? '최대 글자수에 도달했어요.' : ''}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '10px',
                  color: moment.length >= MOMENT_MAX ? '#800020' : '#C8C4C0',
                }}
              >
                {moment.length} / {MOMENT_MAX}
              </span>
            </div>
          </div>

          {/* ── 등록하기 버튼 ── */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%',
              padding: '16px',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              letterSpacing: '0.1em',
              cursor: canSubmit ? 'pointer' : 'default',
              background: canSubmit ? '#111' : 'transparent',
              color: canSubmit ? '#FAF8F5' : '#C8C4C0',
              border: canSubmit ? '1px solid #111' : '1px solid #EDE9E4',
              transition: 'all 0.3s ease',
              marginTop: '4px',
            }}
          >
            {submitting ? '등록 중…' : '등록하기'}
          </button>

        </form>
      </div>
    </div>
  )
}
