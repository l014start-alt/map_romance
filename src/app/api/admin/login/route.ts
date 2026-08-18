import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const input = typeof password === 'string' ? password.trim() : ''
  const adminPassword = process.env.ADMIN_PASSWORD?.trim()

  if (!adminPassword || input !== adminPassword) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('admin_session', adminPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // strict는 로그인 직후 이동/인앱브라우저에서 쿠키 미전송으로 튕김 → lax
    maxAge: 60 * 60 * 24 * 7, // 7일
    path: '/',
  })
  return res
}
