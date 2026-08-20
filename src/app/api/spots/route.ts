import { NextRequest, NextResponse } from 'next/server'
import { Category } from '@/types'
import { getSupabase, rowToSpot } from '@/lib/supabase'
import { notifyNewSpot } from '@/lib/notify'

const CATEGORIES: Category[] = ['낭만', '젊음', '사랑']

export async function GET(req: NextRequest) {
  const approvedOnly = req.nextUrl.searchParams.get('approved') === 'true'
  const sb = getSupabase()

  let query = sb.from('spots').select('*').order('created_at', { ascending: false })
  if (approvedOnly) query = query.eq('approved', true)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(rowToSpot))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { id, placeName, address, lat, lng, category, moment, nickname, title, sns, password } = body

  if (!placeName?.trim()) {
    return NextResponse.json({ error: '장소명은 필수입니다.' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: '카테고리가 올바르지 않습니다.' }, { status: 400 })
  }
  if (!moment?.trim()) {
    return NextResponse.json({ error: '사연을 입력해주세요.' }, { status: 400 })
  }
  // 글자수 제한 없음(사실상). 악성 초대용량만 방어하는 넉넉한 상한.
  if ((moment as string).trim().length > 20000) {
    return NextResponse.json({ error: '사연이 너무 깁니다.' }, { status: 400 })
  }

  const row = {
    // 클라이언트가 보낸 id 우선 사용(로컬 사본과 동일 id → 중복 방지). 없으면 생성.
    id: (id as string | undefined)?.trim() || `spot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    place_name: (placeName as string).trim(),
    address: (address as string | undefined)?.trim() || null,
    lat: (lat as number | undefined) ?? null,
    lng: (lng as number | undefined) ?? null,
    category: category as Category,
    moment: (moment as string).trim(),
    nickname: (nickname as string | undefined)?.trim() || null,
    title: (title as string | undefined)?.trim() || null,
    sns: (sns as string | undefined)?.trim() || null,
    // 작성자 수정용 4자리 비밀번호 서버 저장 (GET엔 노출 안 함 — rowToSpot 제외)
    password: (password as string | undefined)?.trim() || null,
    approved: false,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabase().from('spots').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 새 제보 알림(디스코드/슬랙 웹훅) — 실패해도 저장에는 영향 없음
  await notifyNewSpot({
    placeName: row.place_name, category: row.category, moment: row.moment,
    nickname: row.nickname, title: row.title, sns: row.sns,
  })

  return NextResponse.json(rowToSpot(data), { status: 201 })
}
