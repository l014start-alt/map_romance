import { NextRequest, NextResponse } from 'next/server'
import { getAdminSupabase } from '@/lib/supabase'

/* 방문자 선택(캐릭터·지역) 통계 수집 — visitor_selections 테이블 */

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const region = (body.region as string | undefined)?.trim()
  if (!region) {
    return NextResponse.json({ error: 'region는 필수입니다.' }, { status: 400 })
  }
  // 캐릭터 선택은 폐지됨. character_id 컬럼(NOT NULL 대비)은 고정값으로 채운다.
  const row = {
    character_id: (body.characterId as string | undefined)?.trim() || '-',
    region,
    created_at: (body.at as string | undefined) || new Date().toISOString(),
  }
  const { error } = await getAdminSupabase().from('visitor_selections').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

/* 간단 집계 — 캐릭터별/지역별 선택 횟수 + 전체 건수 */
export async function GET() {
  const { data, error } = await getAdminSupabase()
    .from('visitor_selections')
    .select('character_id, region')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const characters: Record<string, number> = {}
  const regions: Record<string, number> = {}
  for (const r of data ?? []) {
    const c = (r as { character_id: string }).character_id
    const g = (r as { region: string }).region
    characters[c] = (characters[c] ?? 0) + 1
    regions[g] = (regions[g] ?? 0) + 1
  }
  return NextResponse.json({ total: (data ?? []).length, characters, regions })
}
