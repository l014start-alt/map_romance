/**
 * 네이버 Geocoding / Reverse Geocoding API 유틸리티
 * Client Secret은 서버에서만 사용 — 브라우저에서는 /api/geocode 라우트를 경유
 */

import { DAEGU_BOUNDS, isNearDaegu } from '@/types'

export interface GeoResult {
  lat: number
  lng: number
  address: string
}

export interface GeoResultItem {
  lat: number
  lng: number
  address: string
  placeName?: string
  roadAddress?: string
  jibunAddress?: string
}

const NAVER_HEADERS = {
  'X-NCP-APIGW-API-KEY-ID': process.env.NEXT_PUBLIC_NAVER_CLIENT_ID ?? '',
  'X-NCP-APIGW-API-KEY': process.env.NAVER_CLIENT_SECRET ?? '',
}

/** 주소·상호명 → 대구(경산·군위 포함) 안의 결과만 (Kakao 우선 → Naver → Nominatim 폴백) */
export async function geocodeMultiple(query: string): Promise<GeoResultItem[]> {
  const kakaoResults = (await geocodeKakao(query)).filter(inDaegu)
  if (kakaoResults.length > 0) return kakaoResults
  const naverResults = (await geocodeNaverMultiple(query)).filter(inDaegu)
  if (naverResults.length > 0) return naverResults
  return (await geocodeNominatim(query)).filter(inDaegu)
}

/** 좌표 범위(사각형)에 영천·칠곡 등 맞닿은 시군이 일부 걸리므로 주소로 한 번 더 거른다 (군위는 '대구 군위군') */
function inDaegu(r: GeoResultItem): boolean {
  return isNearDaegu(r) && /대구|경산/.test(`${r.address} ${r.roadAddress ?? ''} ${r.jibunAddress ?? ''}`)
}

// 카카오 rect = 좌하단 경도,위도,우상단 경도,위도 — 대구 범위 안에서만 찾는다
const DAEGU_RECT = `${DAEGU_BOUNDS.minLng},${DAEGU_BOUNDS.minLat},${DAEGU_BOUNDS.maxLng},${DAEGU_BOUNDS.maxLat}`

/** Kakao 키워드 검색 → 상호명·주소 통합 결과 */
export async function geocodeKakao(query: string): Promise<GeoResultItem[]> {
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) return []
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10&rect=${DAEGU_RECT}`
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
    })
    if (!res.ok) return []
    const data = await res.json() as {
      documents: Array<{
        place_name: string
        road_address_name: string
        address_name: string
        x: string   // 경도
        y: string   // 위도
      }>
    }
    return (data.documents ?? []).map(d => ({
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
      address: d.road_address_name || d.address_name,
      placeName: d.place_name,
      roadAddress: d.road_address_name,
      jibunAddress: d.address_name,
    }))
  } catch {
    return []
  }
}

async function geocodeNaverMultiple(query: string): Promise<GeoResultItem[]> {
  try {
    const res = await fetch(
      `https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}&count=5`,
      { headers: NAVER_HEADERS }
    )
    const data = await res.json() as { addresses?: Array<{ y: string; x: string; roadAddress: string; jibunAddress: string }> }
    const addresses = data?.addresses ?? []
    return addresses.slice(0, 5).map(addr => ({
      lat: parseFloat(addr.y),
      lng: parseFloat(addr.x),
      address: addr.roadAddress || addr.jibunAddress || query,
      roadAddress: addr.roadAddress,
      jibunAddress: addr.jibunAddress,
    }))
  } catch {
    return []
  }
}

async function geocodeNominatim(query: string): Promise<GeoResultItem[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=kr&accept-language=ko&viewbox=${DAEGU_RECT}&bounded=1`,
      { headers: { 'User-Agent': 'map-romance/1.0 (l014start@gmail.com)' } }
    )
    const data = await res.json() as Array<{ lat: string; lon: string; display_name: string; name: string; type: string }>
    if (!Array.isArray(data)) return []
    return data.slice(0, 5).map(item => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      address: item.display_name,
      placeName: item.name && item.name !== item.display_name ? item.name : undefined,
    }))
  } catch {
    return []
  }
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
