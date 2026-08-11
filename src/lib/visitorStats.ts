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
const NOLOG_KEY   = 'map_romance_nolog'        // '1'이면 이 기기의 선택은 통계 수집에서 제외

/**
 * 이 기기의 통계 수집 제외 여부를 켜고/끈다.
 * (사장님 본인 기기·테스트용. 주소에 ?nolog=1 로 접속하면 켜짐 / ?nolog=0 으로 끔)
 */
export function setCollectionExcluded(excluded: boolean): void {
  try {
    if (excluded) localStorage.setItem(NOLOG_KEY, '1')
    else localStorage.removeItem(NOLOG_KEY)
  } catch { /* ignore */ }
}

/** 이 기기가 통계 수집에서 제외되어 있는지 */
export function isCollectionExcluded(): boolean {
  try {
    return localStorage.getItem(NOLOG_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 방문자 선택을 저장한다.
 * - CURRENT_KEY: 최근 선택 1건 (헤더 뱃지 등 화면 표시용)
 * - LOG_KEY:     누적 로그 배열 (나중에 "무엇이 가장 많이 선택됐나" 집계용)
 */
export function saveVisitorSelection(characterId: string, region: string): VisitorSelection {
  const entry: VisitorSelection = { characterId, region, at: new Date().toISOString() }

  // 이 기기가 통계 수집 제외(사장님 본인 기기)라면 → 화면 표시용 CURRENT_KEY만 남기고
  // 통계 로그·서버 전송은 건너뛴다.
  const excluded = isCollectionExcluded()

  try {
    // 1) 최근 선택 1건 저장 (헤더 뱃지 등 화면 표시용 — 제외 기기에서도 UI는 정상 동작)
    localStorage.setItem(CURRENT_KEY, JSON.stringify(entry))

    // 2) 통계용 누적 로그에 append (제외 기기는 생략)
    if (!excluded) {
      const raw = localStorage.getItem(LOG_KEY)
      const log: VisitorSelection[] = raw ? JSON.parse(raw) : []
      log.push(entry)
      localStorage.setItem(LOG_KEY, JSON.stringify(log))
    }
  } catch {
    /* 프라이빗 모드 등 localStorage 사용 불가 시 무시 */
  }

  // 3) 백엔드(Supabase)로도 전송 — 통계 집계용. 제외 기기는 전송하지 않음.
  if (!excluded) recordSelectionToBackend(entry)

  return entry
}

/** 방문자 선택을 서버(/api/visitor)로 전송 → Supabase visitor_selections 에 누적 */
function recordSelectionToBackend(entry: VisitorSelection): void {
  try {
    fetch('/api/visitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => { /* 네트워크 실패 무시 */ })
  } catch { /* ignore */ }
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
