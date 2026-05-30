'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Category } from '@/types'
import { compressImageToBase64 } from '@/lib/imageUtils'
import type { PinData } from './LocationPicker'

interface RecordModalProps {
  pin: PinData | null
  onClose: () => void
  onSubmit: (data: {
    placeName: string
    address?: string
    lat?: number
    lng?: number
    category: Category
    moment: string
    nickname: string
    title?: string
    imageUrl?: string
    password?: string
  }) => Promise<void>
}

const CATEGORIES: Category[] = ['낭만', '젊음', '사랑']
const MOMENT_MAX = 500

export default function RecordModal({ pin, onClose, onSubmit }: RecordModalProps) {
  const [nickname, setNickname]     = useState('')
  const [placeName, setPlaceName]   = useState(pin?.placeName ?? '')
  const [address, setAddress]       = useState(pin?.address ?? '')
  const [category, setCategory]     = useState<Category | null>(null)
  const [title, setTitle]           = useState('')
  const [moment, setMoment]         = useState('')
  const [password, setPassword]     = useState('')
  const [imageUrl, setImageUrl]     = useState<string | undefined>()
  const [compressing, setCompressing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]             = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setAddress(pin?.address ?? '') }, [pin])
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const canSubmit =
    nickname.trim().length > 0 &&
    placeName.trim().length > 0 &&
    category !== null &&
    moment.trim().length > 0 &&
    moment.length <= MOMENT_MAX &&
    password.length === 4 &&
    !submitting && !compressing

  const handleMomentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (e.target.value.length > MOMENT_MAX) return
    setMoment(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCompressing(true)
    try {
      const b64 = await compressImageToBase64(file)
      setImageUrl(b64)
    } catch {
      // ignore
    } finally {
      setCompressing(false)
      // 같은 파일 재선택 허용
      e.target.value = ''
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value.replace(/\D/g, '').slice(0, 4))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit || !category) return
    setSubmitting(true)
    try {
      await onSubmit({
        placeName: placeName.trim(),
        address: address.trim() || undefined,
        lat: pin?.lat, lng: pin?.lng,
        category, moment: moment.trim(),
        nickname: nickname.trim(),
        title: title.trim() || undefined,
        imageUrl,
        password: password || undefined,
      })
      setDone(true)
    } catch {
      setSubmitting(false)
    }
  }

  /* ── 완료 화면 ── */
  if (done) return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', background: '#FAF8F5', borderRadius: '14px 14px 0 0', minHeight: '40dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#2A2520', lineHeight: 2.0, textAlign: 'center', wordBreak: 'keep-all' }}>기록이 접수되었습니다.</p>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B5B0AB', lineHeight: 1.9, marginTop: '12px', textAlign: 'center', wordBreak: 'keep-all' }}>
          지도 위에 핀이 꽂혔어요.<br />낭만을 남겨주셔서 감사해요.
        </p>
        <button onClick={onClose} style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#C0BEBB', letterSpacing: '0.06em', borderBottom: '1px solid #EDE9E4', paddingBottom: '1px', marginTop: '40px', cursor: 'pointer' }}>닫기</button>
      </div>
    </div>
  )

  /* ── 메인 폼 ── */
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '100%', maxHeight: '90dvh', overflowY: 'auto', background: '#FAF8F5', borderRadius: '14px 14px 0 0', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>

        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
        </div>

        {/* 헤더 */}
        <div style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px 16px', background: '#FAF8F5', borderBottom: '1px solid #EDE9E4' }}>
          <div style={{ width: '24px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600, color: '#800020', letterSpacing: '0.04em' }}>낭만여지도</span>
            <span style={{ color: '#DED9D3', fontSize: '11px' }}>·</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#C0BEBB', letterSpacing: '0.04em' }}>기록하기</span>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B5B0AB', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* 핀 위치 */}
        {pin && (
          <div style={{ padding: '12px 24px 0' }}>
            <div style={{ background: '#F0EDE8', borderRadius: '6px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px' }}>📍</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#6B6560', lineHeight: 1.4, wordBreak: 'keep-all' }}>
                {pin.address || `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '28px 24px 48px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* 사진 첨부 — 폼 맨 위에 배치해 시인성 확보 */}
          <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '12px' }}>
              사진 첨부 <span style={{ color: '#DED9D3' }}>(선택)</span>
            </p>
            {/* 숨겨진 file input */}
            <input
              ref={fileInputRef}
              id="photo-upload"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />

            {imageUrl ? (
              /* 미리보기 */
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', background: '#F0EDE8' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="미리보기"
                  style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  style={{ position: 'absolute', top: '8px', right: '8px', width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', lineHeight: 1 }}
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ position: 'absolute', bottom: '8px', right: '8px', padding: '4px 10px', background: 'rgba(0,0,0,0.45)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '10px', borderRadius: '4px', cursor: 'pointer', letterSpacing: '0.04em' }}
                >
                  교체
                </button>
              </div>
            ) : (
              /* 업로드 버튼 영역 */
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={compressing}
                style={{ width: '100%', padding: '24px 16px', border: '1.5px dashed #DED9D3', borderRadius: '8px', background: '#FDFBF8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: compressing ? 'default' : 'pointer', transition: 'border-color 0.2s' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C0BEBB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21,15 16,10 5,21" />
                </svg>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: compressing ? '#DED9D3' : '#B5B0AB', letterSpacing: '0.04em' }}>
                  {compressing ? '처리 중…' : '사진을 첨부하려면 탭하세요'}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#DED9D3' }}>JPG · PNG · HEIC</span>
              </button>
            )}
          </div>

          {/* 닉네임 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>닉네임</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="남기고 싶은 이름" maxLength={20}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '16px', color: '#111', paddingBottom: '12px', outline: 'none', borderBottom: '1px solid #EDE9E4' }} />
          </div>

          {/* 장소명 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>장소명</label>
            <input type="text" value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="기억 속 그 장소의 이름" maxLength={60}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '16px', color: '#111', paddingBottom: '12px', outline: 'none', borderBottom: '1px solid #EDE9E4' }} />
          </div>

          {/* 주소 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              주소 <span style={{ color: '#DED9D3' }}>(자동입력 · 수정 가능)</span>
            </label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="도로명 또는 지번 주소" maxLength={100}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#6B6560', paddingBottom: '12px', outline: 'none', borderBottom: '1px solid #EDE9E4' }} />
          </div>

          {/* 카테고리 */}
          <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '18px' }}>카테고리</p>
            <div style={{ display: 'flex', gap: '32px' }}>
              {CATEGORIES.map((c) => {
                const active = category === c
                return (
                  <button key={c} type="button" onClick={() => setCategory(active ? null : c)} aria-pressed={active}
                    style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: active ? 500 : 400, color: active ? '#111' : '#C0BEBB', paddingBottom: '4px', borderBottom: active ? '1.5px solid #111' : '1.5px solid transparent', transition: 'all 0.2s', cursor: 'pointer' }}>
                    {c}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              제목 <span style={{ color: '#DED9D3' }}>(선택)</span>
            </label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="이 순간을 한 문장으로" maxLength={60}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-brand)', fontSize: '18px', color: '#111', paddingBottom: '12px', outline: 'none', borderBottom: '1px solid #EDE9E4' }} />
          </div>

          {/* 순간 기록 */}
          <div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>그곳에서의 순간</p>
            <textarea ref={textareaRef} value={moment} onChange={handleMomentChange}
              placeholder="그곳에서 마주한 문장이나 장면을 자연스럽게 적어주세요." rows={4}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '15px', color: '#111', lineHeight: 2.0, borderBottom: '1px solid #EDE9E4', paddingBottom: '12px', outline: 'none', resize: 'none', minHeight: '96px', wordBreak: 'keep-all' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: moment.length >= MOMENT_MAX ? '#800020' : '#C8C4C0' }}>
                {moment.length} / {MOMENT_MAX}
              </span>
            </div>
          </div>

          {/* 비밀번호 */}
          <div>
            <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.18em', marginBottom: '14px' }}>
              비밀번호 <span style={{ color: '#DED9D3' }}>(숫자 4자리 · 수정·삭제 시 필요)</span>
            </label>
            <input type="password" inputMode="numeric" value={password} onChange={handlePasswordChange} placeholder="• • • •" maxLength={4}
              style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '20px', letterSpacing: '0.3em', color: '#111', paddingBottom: '12px', outline: 'none', borderBottom: '1px solid #EDE9E4' }} />
          </div>

          {/* 제출 */}
          <button type="submit" disabled={!canSubmit}
            style={{ width: '100%', padding: '16px', fontFamily: 'var(--font-sans)', fontSize: '13px', letterSpacing: '0.1em', cursor: canSubmit ? 'pointer' : 'default', background: canSubmit ? '#111' : 'transparent', color: canSubmit ? '#FAF8F5' : '#C8C4C0', border: canSubmit ? '1px solid #111' : '1px solid #EDE9E4', transition: 'all 0.3s' }}>
            {submitting ? '등록 중…' : '기록하기'}
          </button>

        </form>
      </div>
    </div>
  )
}
