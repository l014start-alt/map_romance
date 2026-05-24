'use client'

import { useState, useRef, FormEvent } from 'react'
import Link from 'next/link'
import Footer from '@/components/Footer'
import { Category } from '@/types'

const CATEGORIES: Category[] = ['낭만', '젊음', '사랑']
const MOMENT_MAX = 120
const FONT_UI = 'var(--font-sans)'
const FONT_BRAND = 'var(--font-brand)'

export default function ContributePage() {
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

  const canSubmit =
    placeName.trim().length > 0 &&
    category !== null &&
    moment.trim().length > 0 &&
    moment.length <= MOMENT_MAX &&
    !submitting

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
      if (Array.isArray(data) && data.length > 0) {
        const place = data[0] as { display_name: string; lat: string; lon: string }
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
      const res = await fetch('/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeName: placeName.trim(),
          address: foundAddress ?? undefined,
          lat: coords?.lat,
          lng: coords?.lng,
          category,
          moment: moment.trim(),
          nickname: nickname.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('등록 실패')
      setDone(true)
    } catch {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          background: '#FAF8F5',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <p
          style={{
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: '#2A2520',
            lineHeight: '2.0',
            textAlign: 'center',
            wordBreak: 'keep-all',
          }}
        >
          기록이 접수되었습니다.
        </p>
        <p
          style={{
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#B5B0AB',
            lineHeight: '1.9',
            textAlign: 'center',
            marginTop: '12px',
          }}
        >
          검토 후 지도 위에 올라갑니다.
          <br />
          낭만을 남겨주셔서 감사해요.
        </p>
        <Link
          href="/"
          style={{
            fontFamily: FONT_UI,
            fontSize: '11px',
            color: '#C0BEBB',
            letterSpacing: '0.06em',
            borderBottom: '1px solid #EDE9E4',
            paddingBottom: '1px',
            marginTop: '32px',
          }}
        >
          지도로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#FAF8F5' }}>
      {/* ── 헤더 ── */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: '#FAF8F5',
          borderBottom: '1px solid #EDE9E4',
        }}
      >
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontFamily: FONT_UI,
            fontSize: '12px',
            color: '#6B6560',
            minWidth: '44px',
            minHeight: '44px',
            padding: '0 6px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13,4 7,10 13,16" />
          </svg>
          돌아가기
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontFamily: FONT_BRAND,
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
              fontFamily: FONT_UI,
              fontSize: '11px',
              color: '#C0BEBB',
              letterSpacing: '0.04em',
            }}
          >
            낭만 제보하기
          </span>
        </div>
        <div style={{ width: '44px' }} />
      </div>

      {/* ── 폼 ── */}
      <form onSubmit={handleSubmit} style={{ padding: '32px 24px 0', display: 'flex', flexDirection: 'column', gap: '36px' }}>

        {/* 닉네임 */}
        <div>
          <label style={{ display: 'block', fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
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
              fontFamily: FONT_UI,
              fontSize: '16px',
              color: '#111',
              paddingBottom: '12px',
              letterSpacing: '-0.01em',
              outline: 'none',
              borderBottom: '1px solid #EDE9E4',
            }}
          />
        </div>

        {/* 장소 */}
        <div>
          <label style={{ display: 'block', fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
            장소
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', borderBottom: '1px solid #EDE9E4' }}>
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
                fontFamily: FONT_UI,
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
                fontFamily: FONT_UI,
                fontSize: '10px',
                color: placeName.trim() ? '#800020' : '#C8C4C0',
                letterSpacing: '0.04em',
                paddingBottom: '13px',
                whiteSpace: 'nowrap',
                cursor: placeName.trim() ? 'pointer' : 'default',
                flexShrink: 0,
              }}
            >
              {searching ? '검색 중…' : '위치 찾기'}
            </button>
          </div>
          {foundAddress && (
            <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#800020', lineHeight: '1.6', marginTop: '8px' }}>
              ↳ {foundAddress}
            </p>
          )}
          {searchError && (
            <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', marginTop: '8px' }}>
              {searchError}
            </p>
          )}
        </div>

        {/* 카테고리 */}
        <div>
          <p style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '18px' }}>
            카테고리
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {CATEGORIES.map((c) => {
              const active = category === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(active ? null : c)}
                  aria-pressed={active}
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: '15px',
                    fontWeight: active ? 500 : 400,
                    color: active ? '#111' : '#C0BEBB',
                    paddingBottom: '4px',
                    borderBottom: active ? '1.5px solid #111' : '1.5px solid transparent',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>

        {/* 순간 기록 */}
        <div>
          <p style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
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
              fontFamily: FONT_UI,
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
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
            <span style={{
              fontFamily: FONT_UI,
              fontSize: '9px',
              color: moment.length >= MOMENT_MAX ? '#800020' : 'transparent',
            }}>
              {moment.length >= MOMENT_MAX ? '최대 글자수에 도달했어요.' : ''}
            </span>
            <span style={{
              fontFamily: FONT_UI,
              fontSize: '10px',
              color: moment.length >= MOMENT_MAX ? '#800020' : '#C8C4C0',
            }}>
              {moment.length} / {MOMENT_MAX}
            </span>
          </div>
        </div>

        {/* 등록 버튼 */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '16px',
            fontFamily: FONT_UI,
            fontSize: '13px',
            letterSpacing: '0.1em',
            cursor: canSubmit ? 'pointer' : 'default',
            background: canSubmit ? '#111' : 'transparent',
            color: canSubmit ? '#FAF8F5' : '#C8C4C0',
            border: canSubmit ? '1px solid #111' : '1px solid #EDE9E4',
            transition: 'all 0.3s ease',
            marginBottom: '0',
          }}
        >
          {submitting ? '등록 중…' : '등록하기'}
        </button>
      </form>

      <Footer />
    </div>
  )
}
