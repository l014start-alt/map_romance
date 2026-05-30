import { NextRequest, NextResponse } from 'next/server'
import { reverseGeocode, geocode } from '@/lib/geocoding'

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

  // 지오코딩: ?q=주소
  if (query) {
    const result = await geocode(query)
    return NextResponse.json(result ?? { error: 'not found' })
  }

  return NextResponse.json({ error: 'q or lat+lng required' }, { status: 400 })
}
