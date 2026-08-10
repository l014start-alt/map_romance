import Link from 'next/link'

const FONT_UI = 'var(--font-sans)'
const FONT_LOGO = "'Yoon Dokrip', var(--font-brand), serif"  // 낭젊사 로고 글씨체(윤독립)

/* ══════════════════════════════════════════════════════════
   변경: 하단 2단 좌/우 위치 교체
   - 좌측 열: 나머지 정보(슬로건 · 카피라이트 · 링크) — 좌측 정렬
   - 우측 열: 상호명(낭만젊음사랑) + 주소 — 우측 정렬
   - justify-content: space-between 으로 남는 공간을 좌우로 배분
   ══════════════════════════════════════════════════════════ */
export default function Footer() {
  return (
    <footer
      style={{
        padding: '28px 40px',
        display: 'flex',
        justifyContent: 'space-between', // 좌/우 열을 양 끝으로 분할
        alignItems: 'center',            // 좌우 열 세로 중앙 정렬 → 균형
        gap: '40px',
        flexWrap: 'wrap',                // 좁은 화면에서는 자동 줄바꿈
        borderTop: '1px solid #EDE9E4',
      }}
    >
      {/* ── 좌측 열 — 슬로건 · 카피라이트 · 유틸 링크 (좌측 정렬) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', alignItems: 'flex-start', textAlign: 'left' }}>
        {/* 슬로건 */}
        <p style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#A8A39E', lineHeight: '1.9', wordBreak: 'keep-all', maxWidth: '280px' }}>
          우리가 머물렀던 담백한 순간들이 지도가 됩니다.
        </p>
        {/* 카피라이트 */}
        <p style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C8C4C0', lineHeight: '1.9', letterSpacing: '0.02em' }}>
          © Since 2022 낭만젊음사랑. All rights reserved.
        </p>
        {/* 유틸 링크 */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <Link href="/contribute" style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#C0BEBB', letterSpacing: '0.06em', borderBottom: '1px solid #EDE9E4', paddingBottom: '1px' }}>
            낭만 제보하기
          </Link>
          <Link href="/admin" style={{ fontFamily: FONT_UI, fontSize: '9px', color: '#D4D0CB', letterSpacing: '0.06em' }}>
            관리자
          </Link>
        </div>
      </div>

      {/* ── 우측 열 — 상호명(윤독립 로고체) + 주소 (우측 정렬) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0, alignItems: 'flex-end', textAlign: 'right' }}>
        <p style={{ fontFamily: FONT_LOGO, fontSize: '30px', color: '#2A2520', lineHeight: 1, letterSpacing: '0.02em' }}>
          낭만젊음사랑
        </p>
        <p style={{ fontFamily: FONT_UI, fontSize: '10px', color: '#B5B0AB', lineHeight: '1.9', letterSpacing: '0.02em' }}>
          대구 중구 국채보상로 634 2층
        </p>
      </div>
    </footer>
  )
}
