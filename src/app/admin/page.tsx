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
        </Link>
        <span
          style={{
            fontFamily: FONT_BRAND,
            fontSize: '13px',
            fontWeight: 600,
            color: '#800020',
            letterSpacing: '0.04em',
          }}
        >
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
      <div
        style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid #EDE9E4',
        }}
      >
        {[
          { label: '전체', count: spots.length },
          { label: '검토 대기', count: pending.length },
          { label: '승인됨', count: approved.length },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              padding: '14px 0',
              textAlign: 'center',
              borderRight: '1px solid #EDE9E4',
            }}
          >
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

interface SpotCardProps {
  spot: Spot
  onApprove: (id: string) => Promise<void>
  onUnapprove: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function SpotCard({ spot, onApprove, onUnapprove, onDelete }: SpotCardProps) {
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn() } finally { setBusy(false) }
  }

  const date = new Date(spot.createdAt).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
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
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '9px',
              color: CATEGORY_COLOR[spot.category] ?? '#800020',
              letterSpacing: '0.1em',
              padding: '2px 6px',
              border: `1px solid ${CATEGORY_COLOR[spot.category] ?? '#800020'}22`,
              borderRadius: '2px',
            }}
          >
            {spot.category}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '8px',
              color: spot.approved ? '#2A6040' : '#C0BEBB',
              letterSpacing: '0.08em',
            }}
          >
            {spot.approved ? '✓ 승인됨' : '검토 대기'}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: '8px', color: '#C8C4C0' }}>{date}</span>
      </div>

      {/* 장소명 + 닉네임 */}
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500, color: '#2A2520', marginBottom: '4px' }}>
        {spot.placeName}
        {spot.nickname && (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: '#C0BEBB', fontWeight: 400, marginLeft: '8px' }}>
            by {spot.nickname}
          </span>
        )}
      </p>

      {/* 주소 */}
      {spot.address && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '9px', color: '#C0BEBB', marginBottom: '8px' }}>
          {spot.address}
        </p>
      )}

      {/* 순간 기록 */}
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: '#6B6560',
          lineHeight: '1.8',
          wordBreak: 'keep-all',
          marginBottom: '14px',
        }}
      >
        {spot.moment}
      </p>

      {/* 버튼 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {spot.approved ? (
          <button
            disabled={busy}
            onClick={() => void run(() => onUnapprove(spot.id))}
            style={{
              flex: 1,
              padding: '8px 0',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              color: '#C0BEBB',
              border: '1px solid #EDE9E4',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            승인 취소
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => void run(() => onApprove(spot.id))}
            style={{
              flex: 1,
              padding: '8px 0',
              fontFamily: 'var(--font-sans)',
              fontSize: '10px',
              color: '#FAF8F5',
              background: '#2A6040',
              border: '1px solid #2A6040',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            승인
          </button>
        )}
        <button
          disabled={busy}
          onClick={() => void run(() => onDelete(spot.id))}
          style={{
            flex: 1,
            padding: '8px 0',
            fontFamily: 'var(--font-sans)',
            fontSize: '10px',
            color: '#C0392B',
            border: '1px solid #F0DADA',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          삭제
        </button>
      </div>
    </div>
  )
}
