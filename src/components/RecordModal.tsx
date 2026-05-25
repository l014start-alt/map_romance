'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Category } from '@/types'

interface RecordModalProps {
  onClose: () => void
  defaultCenter?: { lat: number; lng: number }
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

export default function RecordModal({ onClose, defaultCenter, onSubmit }: RecordModalProps) {
  const [nickname, setNickname] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [moment, setMoment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSubmit =
    placeName.trim().length > 0 &&
    category !== null &&
    moment.trim().length > 0 &&
    moment.length <= MOMENT_MAX &&
    !submitting

  // 모달 열리면 스크롤 잠금 (body 기준)
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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
        address: address.trim() || undefined,
        // 현재 선택된 지역 좌표를 기본값으로 사용 (추후 네이버 지도 전환 시 교체)
        lat: defaultCenter?.lat,
        lng: defaultCenter?.lng,
        category,
        moment: moment.trim(),
        nickname: nickname.trim() || undefined,
      })
      setDone(true)
    } catch {
      setSubmitting(false)
    }
  }

  /* ── 완료 화면 ── */
  if (done) {
    return (
      // position: absolute — layout.tsx의 overflow:hidden 컨테이너 내에서 지도를 완전히 덮음
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.40)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <div
          style={{
            width: '100%',
            background: '#FAF8F5',
            borderRadius: '14px 14px 0 0',
            minHeight: '40dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 32px',
          }}
        >
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#2A2520', lineHeight: '2.0', letterSpacing: '-0.01em', textAlign: 'center', wordBreak: 'keep-all' }}>
            기록이 접수되었습니다.
          </p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B5B0AB', lineHeight: '1.9', marginTop: '12px', textAlign: 'center', wordBreak: 'keep-all' }}>
            지도 위에 핀이 꽂혔어요.<br />
            낭만을 남겨주셔서 감사해요.
          </p>
          <button
            onClick={onClose}
            style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#C0BEBB', letterSpacing: '0.06em', borderBottom: '1px solid #EDE9E4', paddingBottom: '1px', marginTop: '40px', cursor: 'pointer' }}
          >
            닫기
          </button>
        </div>
      </div>
    )
  }

  /* ── 메인 폼 ── */
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.40)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%',
          maxHeight: '90dvh',
          overflowY: 'auto',
          background: '#FAF8F5',
          borderRadius: '14px 14px 0 0',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {/* 핸들 바 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
        </div>

        {/* 헤더 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px 16px',
          background: '#FAF8F5',
          borderBottom: '1px solid #EDE9E4',
        }}>
          <div style={{ width: '24px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: '#800020', letterSpacing: '0.04em' }}>
              낭만여지도
            </span>
            <span style={{ color: '#DED9D3', fontSize: '11px' }}>·</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#C0BEBB', letterSpacing: '0.04em' }}>
              기록하기
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B5B0AB', cursor: 'pointer' }}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '32px 24px 48px', display: 'flex', flexDirection: 'column', gap: '36px' }}>

          {/* 0. 닉네임 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              닉네임 <span style={{ color: '#DED9D3' }}>(선택)</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="남기고 싶은 이름"
              maxLength={20}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '16px', color: '#111', paddingBottom: '12px', letterSpacing: '-0.01em', outline: 'none', borderBottom: '1px solid #EDE9E4' }}
            />
          </div>

          {/* 1. 장소명 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              장소명
            </label>
            <input
              type="text"
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="기억 속 그 장소의 이름"
              maxLength={60}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '16px', color: '#111', paddingBottom: '12px', letterSpacing: '-0.01em', outline: 'none', borderBottom: '1px solid #EDE9E4' }}
            />
          </div>

          {/* 2. 주소 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              주소 <span style={{ color: '#DED9D3' }}>(선택)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="도로명 또는 지번 주소"
              maxLength={100}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#111', paddingBottom: '12px', letterSpacing: '-0.01em', outline: 'none', borderBottom: '1px solid #EDE9E4' }}
            />
          </div>

          {/* 3. 카테고리 */}
          <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '18px' }}>
              카테고리
            </p>
            <div style={{ display: 'flex', gap: '32px' }}>
              {CATEGORIES.map((c) => {
                const active = category === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(active ? null : c)}
                    aria-pressed={active}
                    style={{
                      fontFamily: 'var(--font-sans)', fontSize: '15px',
                      fontWeight: active ? 500 : 400,
                      color: active ? '#111' : '#C0BEBB',
                      letterSpacing: '-0.01em',
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

          {/* 4. 순간 기록 */}
          <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              그곳에서의 순간
            </p>
            <textarea
              ref={textareaRef}
              value={moment}
              onChange={handleMomentChange}
              placeholder="그곳에서 마주한 문장이나 장면을 자연스럽게 적어주세요."
              rows={4}
              style={{
                width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)',
                fontSize: '15px', color: '#111', lineHeight: '2.0', letterSpacing: '-0.01em',
                borderBottom: '1px solid #EDE9E4', paddingBottom: '12px',
                outline: 'none', resize: 'none', minHeight: '96px', wordBreak: 'keep-all',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: moment.length >= MOMENT_MAX ? '#800020' : '#C8C4C0' }}>
                {moment.length} / {MOMENT_MAX}
              </span>
            </div>
          </div>

          {/* 등록하기 버튼 */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: '100%', padding: '16px',
              fontFamily: 'var(--font-sans)', fontSize: '13px', letterSpacing: '0.1em',
              cursor: canSubmit ? 'pointer' : 'default',
              background: canSubmit ? '#111' : 'transparent',
              color: canSubmit ? '#FAF8F5' : '#C8C4C0',
              border: canSubmit ? '1px solid #111' : '1px solid #EDE9E4',
              transition: 'all 0.3s ease',
            }}
          >
            {submitting ? '등록 중…' : '기록하기'}
          </button>

        </form>
      </div>
    </div>
  )
}
