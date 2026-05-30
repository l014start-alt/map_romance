/**
 * GET /api/place-lookup?lat={lat}&lng={lng}&q={roadName}
 *
 * 카카오 키워드 검색으로 반경 50m 내 상호명 조회
 * q를 전달하면 역지오코딩 스킵 (클라이언트가 이미 처리한 경우)
 */
import { NextResponse } from 'next/server'
import { reverseGeocode } from '@/lib/geocoding'

function parseShortName(fullAddress: string): string {
  const parts = fullAddress.trim().split(' ')
  if (parts.length < 2) return fullAddress
  const roadIdx = parts.findIndex(p => /[로길]$/.test(p) || p.endsWith('대로'))
  if (roadIdx >= 0) return parts.slice(roadIdx).join(' ')
  const areaIdx = parts.findIndex(p => /[동가리읍면]$/.test(p))
  if (areaIdx >= 0) return parts.slice(areaIdx).join(' ')
  return parts.slice(-2).join(' ')
}

async function findNearbyPlaceKakao(lat: number, lng: number, query: string): Promise<string | undefined> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key || !query) return undefined

  try {
    const url =
      `https://dapi.kakao.com/v2/local/search/keyword.json` +
      `?query=${encodeURIComponent(query)}&x=${lng}&y=${lat}&radius=50&sort=distance&size=3`

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
    // 50m 이내면 클릭한 장소로 간주
    if (dist <= 50) return nearest.place_name

    return undefined
  } catch {
    return undefined
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')
  const q = searchParams.get('q')  // 클라이언트에서 전달한 도로명 (선택)

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
  }

  // q가 없으면 서버에서 역지오코딩
  let address: string | undefined
  let shortName: string

  if (q) {
    shortName = q
  } else {
    address = (await reverseGeocode(lat, lng)) ?? '주소 없음'
    shortName = parseShortName(address)
  }

  const placeName = await findNearbyPlaceKakao(lat, lng, shortName)

  return NextResponse.json({
    ...(address !== undefined && { address, shortName }),
    placeName: placeName ?? null,
  })
}
