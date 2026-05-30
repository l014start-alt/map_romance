/**
 * 네이버 Geocoding / Reverse Geocoding API 유틸리티
 * Client Secret은 서버에서만 사용 — 브라우저에서는 /api/geocode 라우트를 경유
 */

export interface GeoResult {
  lat: number
  lng: number
  address: string
}

const NAVER_HEADERS = {
  'X-NCP-APIGW-API-KEY-ID': process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ?? '',
  'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET ?? '',
}

/** 주소 텍스트 → 좌표 (서버에서만 호출) */
export async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}`,
      { headers: NAVER_HEADERS }
    )
    const data = await res.json()
    const addr = data?.addresses?.[0]
    if (!addr) return null
    return {
      lat: parseFloat(addr.y),
      lng: parseFloat(addr.x),
      address: addr.roadAddress || addr.jibunAddress || query,
    }
  } catch {
    return null
  }
}

/** 좌표 → 주소 텍스트 (서버에서만 호출) */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-reversegeocode/v2/gc?coords=${lng},${lat}&output=json&orders=roadaddr,addr`,
      { headers: NAVER_HEADERS }
    )
    const data = await res.json()
    const results = data?.results
    if (!results?.length) return null

    // 도로명 우선, 없으면 지번
    const road = results.find((r: { name: string }) => r.name === 'roadaddr')
    const jibun = results.find((r: { name: string }) => r.name === 'addr')

    const target = road ?? jibun
    if (!target) return null

    const region = target.region
    const land = target.land

    const parts = [
      region?.area1?.name,
      region?.area2?.name,
      region?.area3?.name,
      land?.name ? `${land.name} ${land.number1 ?? ''}${land.number2 ? `-${land.number2}` : ''}`.trim() : null,
    ].filter(Boolean)

    return parts.join(' ') || null
  } catch {
    return null
  }
}
