import { NextRequest, NextResponse } from 'next/server'
import { Category } from '@/types'
import { getSupabase, rowToSpot } from '@/lib/supabase'

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
  const { placeName, address, lat, lng, category, moment, nickname, title } = body

  if (!placeName?.trim()) {
    return NextResponse.json({ error: '장소명은 필수입니다.' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category as Category)) {
    return NextResponse.json({ error: '카테고리가 올바르지 않습니다.' }, { status: 400 })
  }
  if (!moment?.trim() || (moment as string).trim().length > 500) {
    return NextResponse.json({ error: '순간은 500자 이내로 입력해주세요.' }, { status: 400 })
  }

  const row = {
    id: `spot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    place_name: (placeName as string).trim(),
    address: (address as string | undefined)?.trim() || null,
    lat: (lat as number | undefined) ?? null,
    lng: (lng as number | undefined) ?? null,
    category: category as Category,
    moment: (moment as string).trim(),
    nickname: (nickname as string | undefined)?.trim() || null,
    title: (title as string | undefined)?.trim() || null,
    approved: false,
    created_at: new Date().toISOString(),
  }

  const { data, error } = await getSupabase().from('spots').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(rowToSpot(data), { status: 201 })
}
