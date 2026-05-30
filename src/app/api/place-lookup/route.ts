/**
 * GET /api/place-lookup?lat={lat}&lng={lng}
 *
 * 좌표 → 역지오코딩(주소) + Kakao 장소 검색(상호명) 통합 조회
 * Returns: { address, shortName, placeName? }
 */
import { NextResponse } from 'next/server'
import { reverseGeocode } from '@/lib/geocoding'

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
 * Kakao 키워드 검색 (좌표 + 반경 50m)
 * 가장 가까운 장소가 40m 이내면 상호명 반환
 */
async function findNearbyPlaceKakao(lat: number, lng: number, query: string): Promise<string | undefined> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key || !query || query === '주소 없음') return undefined

  try {
    const url =
      `https://dapi.kakao.com/v2/local/search/keyword.json` +
      `?query=${encodeURIComponent(query)}&x=${lng}&y=${lat}&radius=50&sort=distance&size=1`

    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) return undefined

    const data = await res.json() as {
      documents: Array<{ place_name: string; distance: string }>
    }

    if (!data.documents?.length) return undefined

    const nearest = data.documents[0]
    const dist = parseInt(nearest.distance ?? '999', 10)
    if (dist <= 40) return nearest.place_name

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

  const address = (await reverseGeocode(lat, lng)) ?? '주소 없음'
  const shortName = parseShortName(address)

  // 카카오 장소 검색: shortName을 query로 사용
  const placeName = await findNearbyPlaceKakao(lat, lng, shortName)

  return NextResponse.json({
    address,
    shortName,
    placeName: placeName ?? null,
  })
}
