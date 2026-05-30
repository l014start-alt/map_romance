/**
 * GET /api/place-lookup?lat={lat}&lng={lng}
 *
 * 좌표 → 역지오코딩(주소) + NCP Map Place Search(상호명) 통합 조회
 * Returns: { address, shortName, placeName? }
 */
import { NextResponse } from 'next/server'
import { reverseGeocode } from '@/lib/geocoding'

const NAVER_HEADERS = {
  'X-NCP-APIGW-API-KEY-ID': process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ?? '',
  'X-NCP-APIGW-API-KEY':    process.env.NAVER_CLIENT_SECRET ?? '',
}

/** "대구광역시 북구 중앙대로 484" → "중앙대로 484" */
function parseShortName(fullAddress: string): string {
  const parts = fullAddress.trim().split(' ')
  if (parts.length < 2) return fullAddress
  const roadIdx = parts.findIndex(p => /[로길]$/.test(p) || p.endsWith('대로'))
  if (roadIdx >= 0) return parts.slice(roadIdx).join(' ')
  const areaIdx = parts.findIndex(p => /[동가리읍면]$/.test(p))
  if (areaIdx >= 0) return parts.slice(areaIdx).join(' ')
  return parts.slice(-2).join(' ')
}

/**
 * NCP Map Place Search — 반경 50m 내 가장 가까운 장소명 반환
 * API 미활성화 / 오류 시 조용히 undefined 반환
 */
async function findNearbyPlace(lat: number, lng: number, query: string): Promise<string | undefined> {
  if (!query || query === '주소 없음') return undefined
  try {
    const url =
      `https://naveropenapi.apigw.ntruss.com/map-place/v1/search` +
      `?query=${encodeURIComponent(query)}&coordinate=${lng},${lat}&radius=50`

    const res = await fetch(url, {
      headers: NAVER_HEADERS,
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) return undefined

    const data = await res.json() as {
      places?: Array<{ name: string; distance?: string; x: string; y: string; bizName?: string }>
    }

    if (!data.places?.length) return undefined

    // distance는 미터(문자열). 40m 이내면 클릭한 장소로 간주
    const nearest = data.places[0]
    const dist = parseInt(nearest.distance ?? '999', 10)
    if (dist <= 40) return nearest.name

    return undefined
  } catch {
    return undefined
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  }

  // 역지오코딩 + 장소 검색 병렬 실행 (장소 검색은 shortName 추출 후 순차)
  const address = (await reverseGeocode(lat, lng)) ?? '주소 없음'
  const shortName = parseShortName(address)

  // shortName을 query로 장소 검색
  const placeName = await findNearbyPlace(lat, lng, shortName)

  return NextResponse.json({
    address,
    shortName,
    placeName: placeName ?? null,
  })
}
