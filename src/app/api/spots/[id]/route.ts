import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase, rowToSpot } from '@/lib/supabase'
import { Category } from '@/types'

const CATEGORIES: Category[] = ['낭만', '젊음', '사랑']

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const sb = getAdminSupabase()
  const isAdmin = req.cookies.get('admin_session')?.value === process.env.ADMIN_PASSWORD?.trim()

  // 내용 수정 필드가 하나라도 있으면 '수정' 처리, 아니면 승인 토글
  const hasContent = ['title', 'moment', 'category', 'placeName', 'sns'].some(k => body[k] !== undefined)

  if (!hasContent) {
    // ── 승인 토글 (관리자) ──
    if (typeof body.approved !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    const { data, error } = await sb.from('spots').update({ approved: body.approved }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(rowToSpot(data))
  }

  // ── 내용 수정 (관리자 쿠키 or 작성자 4자리 비밀번호) ──
  if (!isAdmin) {
    const { data: cur, error: curErr } = await sb.from('spots').select('password').eq('id', id).single()
    if (curErr || !cur) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const pw = typeof body.password === 'string' ? body.password.trim() : ''
    const stored = (cur as { password: string | null }).password
    if (!stored || pw !== stored) {
      return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 403 })
    }
  }

  const upd: Record<string, unknown> = {}
  if (typeof body.title === 'string') upd.title = body.title.trim() || null
  if (typeof body.sns === 'string') upd.sns = body.sns.trim() || null
  if (typeof body.placeName === 'string') {
    if (!body.placeName.trim()) return NextResponse.json({ error: '장소명은 비울 수 없습니다.' }, { status: 400 })
    upd.place_name = body.placeName.trim()
  }
  if (typeof body.category === 'string') {
    if (!CATEGORIES.includes(body.category as Category)) return NextResponse.json({ error: '카테고리가 올바르지 않습니다.' }, { status: 400 })
    upd.category = body.category
  }
  if (typeof body.moment === 'string') {
    const m = body.moment.trim()
    if (!m) return NextResponse.json({ error: '사연을 입력해주세요.' }, { status: 400 })
    if (m.length > 20000) return NextResponse.json({ error: '사연이 너무 깁니다.' }, { status: 400 })
    upd.moment = m
  }
  if (Object.keys(upd).length === 0) return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 })

  const { data, error } = await sb.from('spots').update(upd).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rowToSpot(data))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const { error } = await getAdminSupabase().from('spots').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
