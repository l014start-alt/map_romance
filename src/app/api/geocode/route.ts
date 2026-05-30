import { NextRequest, NextResponse } from 'next/server'
import { reverseGeocode, geocode, geocodeMultiple } from '@/lib/geocoding'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const query = searchParams.get('q')
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  // 역지오코딩: ?lat=&lng=
  if (!isNaN(lat) && !isNaN(lng)) {
    const address = await reverseGeocode(lat, lng)
    return NextResponse.json({ address })
  }

  // 지오코딩: ?q=주소 (상호명·랜드마크 포함, Nominatim 폴백)
  if (query) {
    const results = await geocodeMultiple(query)
    if (results.length > 0) return NextResponse.json({ results })
    // 단건 폴백 (구버전 호환)
    const single = await geocode(query)
    return NextResponse.json(single ? { results: [single] } : { error: 'not found' })
  }

  return NextResponse.json({ error: 'q or lat+lng required' }, { status: 400 })
}
