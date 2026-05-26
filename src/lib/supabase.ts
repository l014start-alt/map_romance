import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Spot, Category } from '@/types'

let _client: SupabaseClient | null = null
let _adminClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return _client
}

// Service role client — bypasses RLS, server-side only
export function getAdminSupabase(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
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
    nickname: (row.nickname as string) ?? '',
    title: (row.title as string) ?? undefined,
    imageUrl: (row.image_url as string) ?? undefined,
    approved: row.approved as boolean,
    createdAt: row.created_at as string,
  }
}
