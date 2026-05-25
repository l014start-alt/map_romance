export type Category = '낭만' | '젊음' | '사랑'

export interface Spot {
  id: string
  nickname: string
  password?: string         // 4자리 비밀번호, localStorage 전용
  placeName: string
  address?: string
  lat?: number
  lng?: number
  title?: string
  category: Category
  moment: string            // 최대 500자
  imageUrl?: string         // base64 data URL(업로드) 또는 외부 URL(목업), localStorage 전용
  approved: boolean
  createdAt: string
}

// 같은 장소(placeName 기준)에 쌓인 사연 묶음
export interface LocationGroup {
  key: string
  placeName: string
  address?: string
  lat?: number
  lng?: number
  spots: Spot[]
}
