import Link from 'next/link'

const FONT_UI = 'var(--font-sans)'
const FONT_SERIF = 'var(--font-serif)'

export default function Footer() {
  return (
    <footer style={{ padding: '40px 24px 36px' }}>
      {/* 브랜드명 — 명조 세리프 */}
      <p
        style={{
          fontFamily: FONT_SERIF,
          fontSize: '16px',
          fontWeight: 700,
          color: '#2A2520',
          letterSpacing: '0.04em',
          marginBottom: '10px',
        }}
      >
        낭만젊음사랑
      </p>

      {/* 슬로건 */}
      <p
        style={{
          fontFamily: FONT_UI,
          fontSize: '10px',
          color: '#B5B0AB',
          lineHeight: '1.9',
          marginBottom: '16px',
          wordBreak: 'keep-all',
        }}
      >
        우리가 머물렀던 담백한 순간들이 지도가 됩니다.
      </p>

      {/* 주소 + 카피라이트 */}
      <p
        style={{
          fontFamily: FONT_UI,
          fontSize: '9px',
          color: '#C8C4C0',
          lineHeight: '1.9',
          letterSpacing: '0.02em',
        }}
      >
        대구 중구 국채보상로 634 2층
        <br />
        © Since 2022 낭만젊음사랑. All rights reserved.
      </p>

      {/* 유틸 링크 */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '20px',
        }}
      >
        <Link
          href="/contribute"
          style={{
            fontFamily: FONT_UI,
            fontSize: '9px',
            color: '#C0BEBB',
            letterSpacing: '0.06em',
            borderBottom: '1px solid #EDE9E4',
            paddingBottom: '1px',
          }}
        >
          낭만 제보하기
        </Link>
        <Link
          href="/admin"
          style={{
            fontFamily: FONT_UI,
            fontSize: '9px',
            color: '#D4D0CB',
            letterSpacing: '0.06em',
          }}
        >
          관리자
        </Link>
      </div>
    </footer>
  )
}
