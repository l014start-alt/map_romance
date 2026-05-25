'use client'

import { useState, useEffect, useRef } from 'react'
import { Spot, Category, LocationGroup } from '@/types'

interface SpotSheetProps {
  group: LocationGroup
  onClose: () => void
  onDelete: (spotId: string) => void
  onUpdate: (spotId: string, data: Partial<Pick<Spot, 'title' | 'moment' | 'category'>>) => void
  verifyPassword: (spotId: string, pw: string) => boolean
}

type PendingAction = { type: 'edit' | 'delete'; spotId: string } | null

const CATEGORIES: Category[] = ['낭만', '젊음', '사랑']
const CATEGORY_COLOR: Record<string, string> = { 낭만: '#800020', 젊음: '#2A6040', 사랑: '#B0402B' }

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function SpotSheet({ group, onClose, onDelete, onUpdate, verifyPassword }: SpotSheetProps) {
  const [expandedId, setExpandedId]       = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [pwInput, setPwInput]             = useState('')
  const [pwError, setPwError]             = useState(false)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editTitle, setEditTitle]         = useState('')
  const [editMoment, setEditMoment]       = useState('')
  const [editCategory, setEditCategory]   = useState<Category>('낭만')
  const pwInputRef = useRef<HTMLInputElement>(null)

  const sortedSpots = [...group.spots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    if (pendingAction) {
      setPwInput(''); setPwError(false)
      setTimeout(() => pwInputRef.current?.focus(), 80)
    }
  }, [pendingAction])

  const handlePwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPwInput(e.target.value.replace(/\D/g, '').slice(0, 4))
    setPwError(false)
  }

  const handlePwConfirm = () => {
    if (!pendingAction) return
    if (!verifyPassword(pendingAction.spotId, pwInput)) { setPwError(true); return }
    if (pendingAction.type === 'delete') {
      onDelete(pendingAction.spotId)
      setPendingAction(null)
    } else {
      const spot = group.spots.find(s => s.id === pendingAction.spotId)
      if (spot) {
        setEditTitle(spot.title ?? '')
        setEditMoment(spot.moment)
        setEditCategory(spot.category)
        setEditingId(pendingAction.spotId)
      }
      setPendingAction(null)
    }
  }

  const handleSaveEdit = (spotId: string) => {
    onUpdate(spotId, { title: editTitle.trim() || undefined, moment: editMoment.trim(), category: editCategory })
    setEditingId(null)
  }

  return (
    <div
      style={{ position: 'absolute', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-end', background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !pendingAction) onClose() }}
    >
      <div style={{ width: '100%', maxHeight: '88dvh', display: 'flex', flexDirection: 'column', background: '#FAF8F5', borderRadius: '16px 16px 0 0', overflow: 'hidden', position: 'relative' }}>

        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '2px', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
        </div>

        {/* 헤더 */}
        <div style={{ padding: '10px 20px 14px', borderBottom: '1px solid #EDE9E4', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', color: '#111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {group.placeName}
              </p>
              {group.address && (
                <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', marginTop: '3px' }}>{group.address}</p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, paddingTop: '4px' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#B5B0AB', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                {sortedSpots.length}개의 사연
              </span>
              <button onClick={onClose} aria-label="닫기" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B5B0AB', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 사연 피드 */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {sortedSpots.map((spot, idx) => {
            const isExpanded = expandedId === spot.id
            const isEditing  = editingId === spot.id
            const color      = CATEGORY_COLOR[spot.category] ?? '#800020'
            const imgSrc     = spot.imageUrl
            const isLast     = idx === sortedSpots.length - 1

            return (
              <article key={spot.id} style={{ borderBottom: isLast ? 'none' : '1px solid #F0EDE8' }}>

                {/* 사진 */}
                {imgSrc && !isEditing && (
                  <div style={{ width: '100%', background: '#F0EDE8', aspectRatio: '16/9', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imgSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                )}

                <div style={{ padding: '16px 20px 18px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', gap: '20px' }}>
                        {CATEGORIES.map((c) => (
                          <button key={c} type="button" onClick={() => setEditCategory(c)}
                            style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: editCategory === c ? '#111' : '#C0BEBB', fontWeight: editCategory === c ? 500 : 400, paddingBottom: '2px', borderBottom: editCategory === c ? '1px solid #111' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }}>
                            {c}
                          </button>
                        ))}
                      </div>
                      <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="제목 (선택)" maxLength={60}
                        style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-brand)', fontSize: '19px', color: '#111', paddingBottom: '8px', outline: 'none', borderBottom: '1px solid #EDE9E4' }} />
                      <textarea value={editMoment} onChange={(e) => setEditMoment(e.target.value.slice(0, 500))} rows={5}
                        style={{ width: '100%', background: '#F7F4F0', fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#111', lineHeight: 1.9, padding: '12px', outline: 'none', resize: 'none', borderRadius: '6px', wordBreak: 'keep-all' }} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" onClick={() => setEditingId(null)}
                          style={{ flex: 1, padding: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B5B0AB', border: '1px solid #EDE9E4', cursor: 'pointer' }}>취소</button>
                        <button type="button" onClick={() => handleSaveEdit(spot.id)} disabled={!editMoment.trim()}
                          style={{ flex: 2, padding: '10px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: editMoment.trim() ? '#FAF8F5' : '#C8C4C0', background: editMoment.trim() ? '#111' : '#EDE9E4', cursor: editMoment.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color, letterSpacing: '0.16em', fontWeight: 600 }}>{spot.category}</span>
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.06em' }}>{formatDate(spot.createdAt)}</span>
                      </div>
                      {spot.title && (
                        <p style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', color: '#111', lineHeight: 1.25, marginBottom: '5px', wordBreak: 'keep-all' }}>{spot.title}</p>
                      )}
                      {spot.nickname && (
                        <p style={{ fontFamily: 'var(--font-brand)', fontSize: '13px', color: '#B5B0AB', marginBottom: '12px' }}>by {spot.nickname}</p>
                      )}
                      <p onClick={() => setExpandedId(isExpanded ? null : spot.id)}
                        style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: '#2A2520', lineHeight: 1.9, wordBreak: 'keep-all', cursor: 'pointer', display: '-webkit-box', WebkitLineClamp: isExpanded ? undefined : 4, WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden' }}>
                        {spot.moment}
                      </p>
                      {!isExpanded && spot.moment.length > 120 && (
                        <button type="button" onClick={() => setExpandedId(spot.id)} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', marginTop: '4px', cursor: 'pointer', letterSpacing: '0.04em' }}>더 보기</button>
                      )}
                      {isExpanded && (
                        <button type="button" onClick={() => setExpandedId(null)} style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', marginTop: '4px', cursor: 'pointer', letterSpacing: '0.04em' }}>접기</button>
                      )}
                      <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
                        <button type="button" onClick={() => setPendingAction({ type: 'edit', spotId: spot.id })}
                          style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C8C4C0', cursor: 'pointer', letterSpacing: '0.06em' }}>편집</button>
                        <span style={{ color: '#E8E4DF', fontSize: '10px' }}>·</span>
                        <button type="button" onClick={() => setPendingAction({ type: 'delete', spotId: spot.id })}
                          style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C8C4C0', cursor: 'pointer', letterSpacing: '0.06em' }}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            )
          })}
          <div style={{ height: '28px' }} />
        </div>

        {/* 비밀번호 확인 오버레이 */}
        {pendingAction && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(250,248,245,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ width: '100%', maxWidth: '280px', padding: '36px 28px', background: '#FFFFFF', boxShadow: '0 8px 48px rgba(0,0,0,0.10)', borderRadius: '4px' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', color: '#B5B0AB', letterSpacing: '0.1em', textAlign: 'center', marginBottom: '28px' }}>
                {pendingAction.type === 'delete' ? '삭제하려면 비밀번호를 입력해주세요' : '편집하려면 비밀번호를 입력해주세요'}
              </p>
              <input ref={pwInputRef} type="password" inputMode="numeric" value={pwInput} onChange={handlePwChange}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePwConfirm() }}
                placeholder="• • • •" maxLength={4}
                style={{ width: '100%', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '26px', letterSpacing: '0.5em', color: '#111', paddingBottom: '12px', outline: 'none', borderBottom: `1px solid ${pwError ? '#800020' : '#EDE9E4'}`, textAlign: 'center', marginBottom: '6px' }} />
              {pwError
                ? <p style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#800020', textAlign: 'center', marginBottom: '20px' }}>비밀번호가 맞지 않아요</p>
                : <div style={{ height: '26px' }} />
              }
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setPendingAction(null)}
                  style={{ flex: 1, padding: '12px', fontFamily: 'var(--font-sans)', fontSize: '12px', color: '#B5B0AB', border: '1px solid #EDE9E4', cursor: 'pointer' }}>취소</button>
                <button type="button" onClick={handlePwConfirm} disabled={pwInput.length < 4}
                  style={{ flex: 2, padding: '12px', fontFamily: 'var(--font-sans)', fontSize: '12px', background: pwInput.length === 4 ? (pendingAction.type === 'delete' ? '#800020' : '#111') : '#EDE9E4', color: pwInput.length === 4 ? '#FAF8F5' : '#C8C4C0', cursor: pwInput.length === 4 ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                  {pendingAction.type === 'delete' ? '삭제' : '확인'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
