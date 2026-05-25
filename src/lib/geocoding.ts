/**
 * Nominatim (OpenStreetMap) 기반 지오코딩 유틸리티
 * 추후 네이버 지도 전환 시 이 파일만 교체하면 됩니다.
 */

const BASE = 'https://nominatim.openstreetmap.org'
const HEADERS: HeadersInit = {
  'Accept-Language': 'ko',
  'User-Agent': 'NangmanYeojido/1.0 (contact: map_romance)',
}

export interface GeoResult {
  lat: number
  lng: number
  address: string
}

/**
 * Nominatim display_name: "도로명, 동, 구, 시, 도, 대한민국" 순서
 * 역순으로 뒤집어 한국식 "도 시 구 도로명" 형태로 변환
 */
function toKoreanAddress(displayName: string): string {
  return displayName
    .split(', ')
    .reverse()
    .filter((p) => p !== '대한민국' && p !== 'South Korea')
    .slice(0, 5)
    .join(' ')
}

/** 주소 텍스트 → 좌표 */
export async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `${BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=kr`,
      { headers: HEADERS }
    )
    const data = (await res.json()) as Array<{
      lat: string
      lon: string
      display_name: string
    }>
    if (!data.length) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: toKoreanAddress(data[0].display_name),
    }
  } catch {
    return null
  }
}

/** 좌표 → 주소 텍스트 (역지오코딩) */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE}/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: HEADERS }
    )
    const data = (await res.json()) as { display_name?: string; error?: string }
    if (data.error || !data.display_name) return null
    return toKoreanAddress(data.display_name)
  } catch {
    return null
  }
}
