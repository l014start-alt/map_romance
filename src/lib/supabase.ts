import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Spot, Category } from '@/types'

let _client: SupabaseClient | null = null

// Lazy-init so build-time module evaluation doesn't throw on missing env vars.
export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

// DB row (snake_case) → app Spot (camelCase)
export function rowToSpot(row: Record<string, unknown>): Spot {
  return {
    id: row.id as string,
    placeName: row.place_name as string,
    address: (row.address as string) ?? undefined,
    lat: (row.lat as number) ?? undefined,
    lng: (row.lng as number) ?? undefined,
    category: row.category as Category,
    moment: row.moment as string,
    nickname: (row.nickname as string) ?? undefined,
    approved: row.approved as boolean,
    createdAt: row.created_at as string,
  }
}
