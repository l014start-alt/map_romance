'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Spot } from '@/types'

const FONT_UI = 'var(--font-sans)'
const FONT_BRAND = 'var(--font-brand)'

const CATEGORY_COLOR: Record<string, string> = {
  낭만: '#800020',
  젊음: '#2A6040',
  사랑: '#C0392B',
}

/* ────────────────────────────────────────
   상세보기 모달
──────────────────────────────────────── */
interface DetailModalProps {
  spot: Spot
  onClose: () => void
  onApprove: (id: string) => Promise<void>
  onUnapprove: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function DetailModal({ spot, onClose, onApprove, onUnapprove, onDelete }: DetailModalProps) {
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const mapUrl = spot.lat && spot.lng
    ? `https://maps.google.com/maps?q=${spot.lat},${spot.lng}&z=16`
    : spot.address
      ? `https://maps.google.com/maps?q=${encodeURIComponent(spot.address)}`
      : null

  const date = new Date(spot.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  // 모달 열릴 때 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          margin: '0 auto',
          maxHeight: '92dvh',
          overflowY: 'auto',
          background: '#FAF8F5',
          borderRadius: '16px 16px 0 0',
          scrollbarWidth: 'none',
        }}
      >
        {/* 핸들 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '32px', height: '3px', background: '#DED9D3', borderRadius: '2px' }} />
        </div>

        {/* 헤더 */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px 14px',
          background: '#FAF8F5',
          borderBottom: '1px solid #EDE9E4',
        }}>
          <span style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#C0BEBB', letterSpacing: '0.06em' }}>
            상세 검토
          </span>
          <span style={{
            fontFamily: FONT_UI, fontSize: '9px',
            color: spot.approved ? '#2A6040' : '#C0BEBB',
            letterSpacing: '0.08em',
            padding: '3px 8px',
            border: `1px solid ${spot.approved ? '#2A604033' : '#EDE9E4'}`,
            borderRadius: '2px',
          }}>
            {spot.approved ? '✓ 승인됨' : '검토 대기'}
          </span>
          <button
            onClick={onClose}
            style={{ color: '#B5B0AB', cursor: 'pointer', padding: '4px' }}
            aria-label="닫기"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12" /><line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* 카테고리 + 날짜 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: FONT_UI, fontSize: '10px',
              color: CATEGORY_COLOR[spot.category] ?? '#800020',
              letterSpacing: '0.12em',
              padding: '3px 8px',
              border: `1px solid ${CATEGORY_COLOR[spot.category] ?? '#800020'}33`,
              borderRadius: '2px',
            }}>
              {spot.category}
            </span>
            <span style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C8C4C0' }}>{date}</span>
          </div>

          {/* 제목 */}
          {spot.title && (
            <div>
              <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.14em', marginBottom: '6px' }}>제목</p>
              <p style={{ fontFamily: FONT_BRAND, fontSize: '20px', color: '#2A2520', lineHeight: 1.5 }}>{spot.title}</p>
            </div>
          )}

          {/* 닉네임 */}
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.14em', marginBottom: '6px' }}>닉네임</p>
              <p style={{ fontFamily: FONT_UI, fontSize: '14px', color: '#2A2520' }}>{spot.nickname || '—'}</p>
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: '#EDE9E4' }} />

          {/* 순간 기록 */}
          <div>
            <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.14em', marginBottom: '12px' }}>그곳에서의 순간</p>
            <p style={{
              fontFamily: FONT_UI, fontSize: '14px', color: '#2A2520',
              lineHeight: 2.0, wordBreak: 'keep-all', whiteSpace: 'pre-wrap',
            }}>
              {spot.moment}
            </p>
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: '#EDE9E4' }} />

          {/* 위치 정보 */}
          <div>
            <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.14em', marginBottom: '12px' }}>위치 정보</p>

            {/* 장소명 */}
            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.1em', marginBottom: '4px' }}>장소명</p>
              <p style={{ fontFamily: FONT_UI, fontSize: '15px', fontWeight: 500, color: '#2A2520' }}>{spot.placeName}</p>
            </div>

            {/* 주소 */}
            {spot.address && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.1em', marginBottom: '4px' }}>주소</p>
                <p style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560', lineHeight: 1.6 }}>{spot.address}</p>
              </div>
            )}

            {/* 좌표 */}
            {spot.lat && spot.lng && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.1em', marginBottom: '4px' }}>좌표</p>
                <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#B5B0AB' }}>
                  {spot.lat.toFixed(6)}, {spot.lng.toFixed(6)}
                </p>
              </div>
            )}

            {/* 지도 보기 버튼 */}
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontFamily: FONT_UI, fontSize: '11px', color: '#800020',
                  letterSpacing: '0.06em',
                  padding: '8px 14px',
                  border: '1px solid #80002022',
                  borderRadius: '4px',
                  background: '#FAF8F5',
                  textDecoration: 'none',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                지도에서 보기
              </a>
            )}
          </div>

          {/* 구분선 */}
          <div style={{ height: '1px', background: '#EDE9E4' }} />

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {spot.approved ? (
              <button
                disabled={busy}
                onClick={() => void run(async () => { await onUnapprove(spot.id); onClose() })}
                style={{
                  flex: 1, padding: '13px 0',
                  fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.06em',
                  color: '#C0BEBB', border: '1px solid #EDE9E4',
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                승인 취소
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={() => void run(async () => { await onApprove(spot.id); onClose() })}
                style={{
                  flex: 2, padding: '13px 0',
                  fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.06em',
                  color: '#FAF8F5', background: busy ? '#B5B0AB' : '#2A6040',
                  border: '1px solid transparent',
                  cursor: busy ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {busy ? '처리 중…' : '승인'}
              </button>
            )}
            <button
              disabled={busy}
              onClick={() => {
                if (!confirm('이 제보를 삭제할까요?')) return
                void run(async () => { await onDelete(spot.id); onClose() })
              }}
              style={{
                flex: 1, padding: '13px 0',
                fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.06em',
                color: '#C0392B', border: '1px solid #F0DADA',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              삭제
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────
   SpotCard
──────────────────────────────────────── */
interface SpotCardProps {
  spot: Spot
  onApprove: (id: string) => Promise<void>
  onUnapprove: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SpotCard({ spot, onApprove, onUnapprove, onDelete }: SpotCardProps) {
  const [busy, setBusy] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const date = new Date(spot.createdAt).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <>
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid #EDE9E4',
          background: spot.approved ? '#FAFDF8' : '#FAF8F5',
        }}
      >
        {/* 상단: 카테고리 배지 + 상태 + 날짜 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontFamily: FONT_UI, fontSize: '9px',
              color: CATEGORY_COLOR[spot.category] ?? '#800020',
              letterSpacing: '0.1em',
              padding: '2px 6px',
              border: `1px solid ${CATEGORY_COLOR[spot.category] ?? '#800020'}22`,
              borderRadius: '2px',
            }}>
              {spot.category}
            </span>
            <span style={{
              fontFamily: FONT_UI, fontSize: '8px',
              color: spot.approved ? '#2A6040' : '#C0BEBB',
              letterSpacing: '0.08em',
            }}>
              {spot.approved ? '✓ 승인됨' : '검토 대기'}
            </span>
          </div>
          <span style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C8C4C0' }}>{date}</span>
        </div>

        {/* 장소명 + 닉네임 */}
        <p style={{ fontFamily: FONT_UI, fontSize: '14px', fontWeight: 500, color: '#2A2520', marginBottom: '4px' }}>
          {spot.placeName}
          {spot.nickname && (
            <span style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', fontWeight: 400, marginLeft: '8px' }}>
              by {spot.nickname}
            </span>
          )}
        </p>

        {/* 주소 */}
        {spot.address && (
          <p style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', marginBottom: '6px' }}>
            {spot.address}
          </p>
        )}

        {/* 순간 미리보기 (2줄) */}
        <p style={{
          fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560',
          lineHeight: 1.7, marginBottom: '14px',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {spot.moment}
        </p>

        {/* 버튼 행 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* 상세보기 */}
          <button
            onClick={() => setDetailOpen(true)}
            style={{
              flex: 1, padding: '8px 0',
              fontFamily: FONT_UI, fontSize: '10px', letterSpacing: '0.04em',
              color: '#800020', border: '1px solid #80002022',
              cursor: 'pointer', transition: 'all 0.15s',
              background: '#FFF8F8',
            }}
          >
            상세보기
          </button>

          {/* 빠른 승인/취소 */}
          {spot.approved ? (
            <button
              disabled={busy}
              onClick={() => void run(() => onUnapprove(spot.id))}
              style={{
                flex: 1, padding: '8px 0',
                fontFamily: FONT_UI, fontSize: '10px',
                color: '#C0BEBB', border: '1px solid #EDE9E4',
                cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s',
              }}
            >
              승인 취소
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => void run(() => onApprove(spot.id))}
              style={{
                flex: 1, padding: '8px 0',
                fontFamily: FONT_UI, fontSize: '10px',
                color: '#FAF8F5', background: busy ? '#B5B0AB' : '#2A6040',
                border: '1px solid transparent',
                cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s',
              }}
            >
              승인
            </button>
          )}

          {/* 삭제 */}
          <button
            disabled={busy}
            onClick={() => {
              if (!confirm('이 제보를 삭제할까요?')) return
              void run(() => onDelete(spot.id))
            }}
            style={{
              flex: 1, padding: '8px 0',
              fontFamily: FONT_UI, fontSize: '10px',
              color: '#C0392B', border: '1px solid #F0DADA',
              cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s',
            }}
          >
            삭제
          </button>
        </div>
      </div>

      {/* 상세보기 모달 */}
      {detailOpen && (
        <DetailModal
          spot={spot}
          onClose={() => setDetailOpen(false)}
          onApprove={onApprove}
          onUnapprove={onUnapprove}
          onDelete={onDelete}
        />
      )}
    </>
  )
}

/* ────────────────────────────────────────
   메인 관리자 페이지
──────────────────────────────────────── */
export default function AdminPage() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/spots')
      const data: Spot[] = await res.json()
      setSpots(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const approve = async (id: string) => {
    await fetch(`/api/spots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true }),
    })
    setSpots((prev) => prev.map((s) => s.id === id ? { ...s, approved: true } : s))
  }

  const unapprove = async (id: string) => {
    await fetch(`/api/spots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: false }),
    })
    setSpots((prev) => prev.map((s) => s.id === id ? { ...s, approved: false } : s))
  }

  const remove = async (id: string) => {
    await fetch(`/api/spots/${id}`, { method: 'DELETE' })
    setSpots((prev) => prev.filter((s) => s.id !== id))
  }

  const pending = spots.filter((s) => !s.approved)
  const approved = spots.filter((s) => s.approved)

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#FAF8F5' }}>
      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: '#FAF8F5', borderBottom: '1px solid #EDE9E4',
      }}>
        <Link
          href="/"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontFamily: FONT_UI, fontSize: '12px', color: '#6B6560',
            minWidth: '44px', minHeight: '44px', padding: '0 6px',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="13,4 7,10 13,16" />
          </svg>
        </Link>
        <span style={{
          fontFamily: FONT_BRAND, fontSize: '13px', fontWeight: 600,
          color: '#800020', letterSpacing: '0.04em',
        }}>
          낭만여지도 · 관리자
        </span>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => void load()}
            style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0BEBB', cursor: 'pointer', minHeight: '44px' }}
          >
            새로고침
          </button>
          <button
            onClick={() => void logout()}
            style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#C0392B', cursor: 'pointer', minHeight: '44px' }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 통계 바 */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #EDE9E4' }}>
        {[
          { label: '전체', count: spots.length },
          { label: '검토 대기', count: pending.length },
          { label: '승인됨', count: approved.length },
        ].map((item) => (
          <div key={item.label} style={{
            flex: 1, padding: '14px 0', textAlign: 'center',
            borderRight: '1px solid #EDE9E4',
          }}>
            <p style={{ fontFamily: FONT_UI, fontSize: '18px', fontWeight: 600, color: '#2A2520' }}>{item.count}</p>
            <p style={{ fontFamily: FONT_UI, fontSize: '8px', color: '#C0BEBB', letterSpacing: '0.1em', marginTop: '2px' }}>{item.label}</p>
          </div>
        ))}
      </div>

      {/* 목록 */}
      <div style={{ padding: '0 0 40px' }}>
        {loading && (
          <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#C0BEBB', textAlign: 'center', padding: '40px 0' }}>
            불러오는 중…
          </p>
        )}
        {!loading && spots.length === 0 && (
          <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#C0BEBB', textAlign: 'center', padding: '40px 0' }}>
            접수된 제보가 없습니다.
          </p>
        )}
        {!loading && spots.map((spot) => (
          <SpotCard
            key={spot.id}
            spot={spot}
            onApprove={approve}
            onUnapprove={unapprove}
            onDelete={remove}
          />
        ))}
      </div>
    </div>
  )
}
