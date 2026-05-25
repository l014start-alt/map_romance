'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      })
      if (res.ok) {
        router.push('/admin')
        router.refresh()
      } else {
        const data = await res.json()
        setError((data as { error?: string }).error ?? '오류가 발생했습니다.')
      }
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAF8F5',
        padding: '0 32px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '22px',
          color: '#800020',
          marginBottom: '8px',
          letterSpacing: '0.04em',
        }}
      >
        낭만여지도
      </p>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          color: '#C0BEBB',
          marginBottom: '40px',
          letterSpacing: '0.08em',
        }}
      >
        관리자
      </p>

      <form onSubmit={submit} style={{ width: '100%', maxWidth: '280px' }}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          style={{
            width: '100%',
            padding: '12px 14px',
            fontFamily: 'var(--font-sans)',
            fontSize: '13px',
            color: '#2A2520',
            background: '#fff',
            border: '1px solid #EDE9E4',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '12px',
          }}
        />

        {error && (
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '11px',
              color: '#C0392B',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !pw}
          style={{
            width: '100%',
            padding: '12px 0',
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: '#FAF8F5',
            background: loading || !pw ? '#C0BEBB' : '#800020',
            border: 'none',
            cursor: loading || !pw ? 'not-allowed' : 'pointer',
            letterSpacing: '0.06em',
            transition: 'background 0.15s',
          }}
        >
          {loading ? '확인 중…' : '입장'}
        </button>
      </form>
    </div>
  )
}
