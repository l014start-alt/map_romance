export type Category = '낭만' | '젊음' | '사랑'

export interface Spot {
  id: string
  placeName: string
  address?: string
  lat?: number
  lng?: number
  category: Category
  moment: string
  nickname?: string
  approved: boolean
  createdAt: string
}
