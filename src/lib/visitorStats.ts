/* ══════════════════════════════════════════════════════════════
   방문자 선택(캐릭터 · 지역) 저장 — 통계용 뼈대
   ----------------------------------------------------------------
   · 지금 바로 동작: 브라우저 LocalStorage 에 저장 (서버 불필요)
   · 나중에 확장:   recordSelectionToBackend() 로 Firebase/DB 수집
   ══════════════════════════════════════════════════════════════ */

export interface VisitorSelection {
  characterId: string // 선택한 캐릭터 id (예: 'beer')
  region: string      // 선택한 출신 지역 (예: '대구')
  at: string          // 선택 시각 (ISO 문자열)
}

const CURRENT_KEY = 'map_romance_visitor'      // 가장 최근 선택 1건
const LOG_KEY     = 'map_romance_visitor_log'  // 통계용 누적 로그(배열)

/**
 * 방문자 선택을 저장한다.
 * - CURRENT_KEY: 최근 선택 1건 (헤더 뱃지 등 화면 표시용)
 * - LOG_KEY:     누적 로그 배열 (나중에 "무엇이 가장 많이 선택됐나" 집계용)
 */
export function saveVisitorSelection(characterId: string, region: string): VisitorSelection {
  const entry: VisitorSelection = { characterId, region, at: new Date().toISOString() }

  try {
    // 1) 최근 선택 1건 저장
    localStorage.setItem(CURRENT_KEY, JSON.stringify(entry))

    // 2) 통계용 누적 로그에 append
    const raw = localStorage.getItem(LOG_KEY)
    const log: VisitorSelection[] = raw ? JSON.parse(raw) : []
    log.push(entry)
    localStorage.setItem(LOG_KEY, JSON.stringify(log))
  } catch {
    /* 프라이빗 모드 등 localStorage 사용 불가 시 무시 */
  }

  // 3) (선택) 백엔드로도 전송 — 아래 스켈레톤 참고. 지금은 비활성.
  // recordSelectionToBackend(entry)

  return entry
}

/** 최근 선택 1건 읽기 (없으면 null) */
export function loadVisitorSelection(): VisitorSelection | null {
  try {
    const raw = localStorage.getItem(CURRENT_KEY)
    return raw ? (JSON.parse(raw) as VisitorSelection) : null
  } catch {
    return null
  }
}

/**
 * 로컬 누적 로그를 집계한다.
 * 반환: 캐릭터별/지역별 선택 횟수 + 전체 건수.
 * (관리자 화면 등에서 "가장 많이 선택된 캐릭터/지역"을 뽑을 때 사용)
 */
export function tallyVisitorLog(): {
  characters: Record<string, number>
  regions: Record<string, number>
  total: number
} {
  const characters: Record<string, number> = {}
  const regions: Record<string, number> = {}
  let total = 0
  try {
    const raw = localStorage.getItem(LOG_KEY)
    const log: VisitorSelection[] = raw ? JSON.parse(raw) : []
    for (const e of log) {
      characters[e.characterId] = (characters[e.characterId] ?? 0) + 1
      regions[e.region] = (regions[e.region] ?? 0) + 1
      total++
    }
  } catch {
    /* ignore */
  }
  return { characters, regions, total }
}

/* ──────────────────────────────────────────────────────────────
   [백엔드 연동 뼈대] — 지금은 주석 처리. 실제 수집을 시작할 때 사용하세요.

   ▶ 옵션 A) 자체 Next.js API 라우트로 저장 (이미 Supabase 를 쓰고 있으니 권장)
      1) src/app/api/visitor/route.ts 파일을 만들고,
         POST 로 받은 { characterId, region, at } 을 DB 에 insert.
      2) 아래 함수 주석을 해제하고,
         위 saveVisitorSelection() 안의 recordSelectionToBackend(entry) 호출도 해제.

   export async function recordSelectionToBackend(entry: VisitorSelection): Promise<void> {
     try {
       await fetch('/api/visitor', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(entry),
       })
     } catch {
       // 네트워크 실패는 조용히 무시 (LocalStorage 에는 이미 저장돼 있음)
     }
   }

   ▶ 옵션 B) Firebase Firestore 로 직접 저장 (firebase 패키지 설치 필요)
      npm i firebase  후:

   // import { getFirestore, collection, addDoc } from 'firebase/firestore'
   // export async function recordSelectionToBackend(entry: VisitorSelection) {
   //   const db = getFirestore()               // firebase 앱 초기화가 선행돼야 함
   //   await addDoc(collection(db, 'visitor_selections'), entry)
   // }
   ────────────────────────────────────────────────────────────── */
