import { NextRequest } from 'next/server'

/** 관리자 로그인 쿠키가 맞는지 — 승인·삭제·미승인 목록 조회는 이게 true일 때만 */
export function isAdminRequest(req: NextRequest): boolean {
  const pw = process.env.ADMIN_PASSWORD?.trim()
  return !!pw && req.cookies.get('admin_session')?.value === pw
}
