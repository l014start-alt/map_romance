/* ══════════════════════════════════════════════════════════════
   새 제보 알림 — 디스코드/슬랙 웹훅으로 메시지 전송
   ----------------------------------------------------------------
   · 환경변수 NOTIFY_WEBHOOK_URL 에 웹훅 주소를 넣으면 동작.
     (없으면 조용히 아무 것도 안 함 → 배포는 항상 안전)
   · URL 에 'discord' 가 들어가면 디스코드 형식({content}),
     아니면 슬랙 형식({text}) 으로 보냄.
   ══════════════════════════════════════════════════════════════ */

interface NewSpotInfo {
  placeName: string
  category: string
  moment: string
  nickname?: string | null
  title?: string | null
  sns?: string | null
}

const ADMIN_URL = 'https://map-romance.vercel.app/admin'

/** 새 제보가 들어왔을 때 웹훅으로 알림. 실패해도 절대 throw 하지 않음(제보 저장에 영향 X). */
export async function notifyNewSpot(spot: NewSpotInfo): Promise<void> {
  const url = process.env.NOTIFY_WEBHOOK_URL
  if (!url) return // 웹훅 미설정 → 아무 것도 안 함

  const moment = spot.moment.length > 140 ? `${spot.moment.slice(0, 140)}…` : spot.moment
  const lines = [
    '🌟 **새 낭만여지도 제보가 도착했어요!**',
    `· 제목: ${spot.title?.trim() || '(없음)'}`,
    `· 글쓴이: ${spot.nickname?.trim() || '익명'}`,
    `· 장소: ${spot.placeName} (${spot.category})`,
    `· 내용: ${moment}`,
    `· 인스타: ${spot.sns?.trim() || '-'}`,
    `\n검토하기 → ${ADMIN_URL}`,
  ]
  const message = lines.join('\n')

  // 디스코드는 {content}, 슬랙은 {text}. 두 키를 모두 넣어도 각자 자기 것만 사용.
  const isDiscord = url.includes('discord')
  const payload = isDiscord ? { content: message } : { text: message }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch {
    /* 네트워크 실패·타임아웃 무시 */
  } finally {
    clearTimeout(timer)
  }
}
