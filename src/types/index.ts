export type Category = '낭만' | '젊음' | '사랑'

/** 작성자 구분 — 대구에 사는 사람(현지인) / 대구에 놀러 온 사람(관광객) */
export type VisitorType = '현지인' | '관광객'

/** 구분별로 다르게 묻는 대구 질문 */
export const DAEGU_QUESTION: Record<VisitorType, string> = {
  현지인: '나에게 대구란?',
  관광객: '내가 바라본 대구는?',
}

export interface Spot {
  id: string
  nickname: string
  password?: string         // 4자리 비밀번호, localStorage 전용
  placeName: string
  address?: string
  lat?: number
  lng?: number
  title?: string           // 신규 작성에선 안 받음(기존 사연 표시용으로만 유지)
  category: Category
  visitorType?: VisitorType // 현지인 / 관광객
  daeguAnswer?: string      // DAEGU_QUESTION[visitorType]에 대한 답
  moment: string            // 사연 본문(길이 제한 없음)
  sns?: string              // 인스타/블로그 등 SNS 아이디 또는 링크(선택)
  imageUrl?: string         // base64 data URL(업로드) 또는 외부 URL(목업), localStorage 전용
  approved: boolean
  createdAt: string
}

/** 카드·상세에 크게 보여줄 한 줄 — 제목(구버전) → 대구 한마디 → 사연 앞부분 */
export function storyHeadline(spot: Spot): string {
  const t = spot.title?.trim()
  if (t) return t
  const d = spot.daeguAnswer?.trim()
  if (d) return d
  const m = spot.moment.trim().replace(/\s+/g, ' ')
  if (!m) return '무제'
  return m.length > 26 ? `${m.slice(0, 26)}…` : m
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
