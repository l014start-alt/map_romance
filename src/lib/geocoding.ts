/**
 * Nominatim (OpenStreetMap) 기반 지오코딩 유틸리티
 * 추후 네이버 지도 전환 시 이 파일만 교체하면 됩니다.
 */

const BASE = 'https://nominatim.openstreetmap.org'
const HEADERS: HeadersInit = {
  'Accept-Language': 'ko',
  'User-Agent': 'NangmanYeojido/1.0',
}

export interface GeoResult {
  lat: number
  lng: number
  address: string
}

interface NominatimAddress {
  amenity?: string
  historic?: string
  building?: string
  house_number?: string
  road?: string
  quarter?: string
  suburb?: string
  borough?: string
  city?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
}

/**
 * 구조화된 address 객체 → 한국식 "시 구 동 도로명 번지" 형태로 조립
 * display_name 문자열 파싱 방식은 우편번호가 섞이는 버그가 있어 사용하지 않음
 */
function buildKoreanAddress(addr: NominatimAddress): string {
  const parts = [
    addr.city ?? addr.county ?? addr.state,
    addr.borough,
    addr.suburb ?? addr.quarter,
    addr.road,
    addr.house_number,
  ].filter((p): p is string => Boolean(p))
  return parts.join(' ')
}

/** 주소 텍스트 → 좌표 */
export async function geocode(query: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `${BASE}/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=kr&addressdetails=1`,
      { headers: HEADERS }
    )
    const data = (await res.json()) as Array<{
      lat: string
      lon: string
      address: NominatimAddress
    }>
    if (!data.length) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: buildKoreanAddress(data[0].address),
    }
  } catch {
    return null
  }
}

/** 좌표 → 주소 텍스트 (역지오코딩) */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: HEADERS }
    )
    const data = (await res.json()) as {
      address?: NominatimAddress
      error?: string
    }
    if (data.error || !data.address) return null
    return buildKoreanAddress(data.address) || null
  } catch {
    return null
  }
}
