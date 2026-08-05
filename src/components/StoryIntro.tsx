/* ══════════════════════════════════════════════════════════════
   요구사항 4 — 두 번째 페이지 콘텐츠 레이아웃 (담백/여백 중심 템플릿)
   ----------------------------------------------------------------
   · 꾸밈 최소화 + 넉넉한 여백(White space)으로 텍스트에 집중.
   · 아래 [여기에 …] 부분에 실제 텍스트/이미지를 넣으면 됩니다.
   · 이미지: /public/story/ 에 파일을 두고 src 경로만 바꾸세요.
     (예: public/story/photo-1.jpg → src="/story/photo-1.jpg")
   ══════════════════════════════════════════════════════════════ */

const FONT_BRAND = 'var(--font-brand)'
const FONT_SERIF = 'var(--font-serif)'
const FONT_UI    = 'var(--font-sans)'

/* 재사용 블록: 본문 문단 */
function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontFamily: FONT_UI, fontSize: '15px', lineHeight: 2.1, color: '#2A2520', wordBreak: 'keep-all', margin: '0 0 24px' }}>
      {children}
    </p>
  )
}

/* 재사용 블록: 이미지 (caption 선택) — 실제 이미지 경로로 교체하세요.
   지금은 경로가 비어 있으면 '이미지 자리' 플레이스홀더를 보여줍니다. */
function StoryImage({ src, caption, alt = '' }: { src?: string; caption?: string; alt?: string }) {
  return (
    <figure style={{ margin: '40px 0' }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '10px' }} />
      ) : (
        // 플레이스홀더 (실제 이미지 넣으면 자동으로 사라짐)
        <div style={{ width: '100%', aspectRatio: '3 / 2', borderRadius: '10px', background: '#F2EEE9', border: '1px dashed #DBD4CC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: FONT_UI, fontSize: '12px', color: '#B5B0AB', letterSpacing: '0.04em' }}>이미지 자리 · src=&quot;/story/파일명.jpg&quot;</span>
        </div>
      )}
      {caption && (
        <figcaption style={{ fontFamily: FONT_UI, fontSize: '11px', color: '#B5B0AB', textAlign: 'center', marginTop: '10px', letterSpacing: '0.02em' }}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

export default function StoryIntro() {
  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#FAF8F5' }} className="no-scrollbar">
      {/* 중앙 정렬 · 좁은 본문 폭 · 넉넉한 상하 여백 */}
      <article style={{ maxWidth: '640px', margin: '0 auto', padding: '96px 24px 120px' }}>

        {/* ── 제목 블록 ── */}
        <header style={{ marginBottom: '64px' }}>
          {/* 눈에 띄지 않는 소제목(eyebrow) */}
          <p style={{ fontFamily: FONT_UI, fontSize: '11px', letterSpacing: '0.22em', color: '#B5B0AB', marginBottom: '20px' }}>
            {/* 여기에 소제목 (예: NANGMAN YEOJIDO) */}낭만여지도
          </p>
          {/* 메인 타이틀 — 붓글씨체 */}
          <h1 style={{ fontFamily: FONT_BRAND, fontSize: '40px', lineHeight: 1.25, color: '#800020', wordBreak: 'keep-all', margin: 0 }}>
            {/* 여기에 제목 */}담백한 순간이 지도가 되기까지
          </h1>
          {/* 부제 */}
          <p style={{ fontFamily: FONT_SERIF, fontSize: '15px', color: '#8A8480', lineHeight: 1.9, marginTop: '20px', wordBreak: 'keep-all' }}>
            {/* 여기에 부제/리드 문장 */}우리가 머물렀던 자리를 천천히 되짚어 봅니다.
          </p>
        </header>

        {/* ── 본문 ── */}
        <section>
          <Paragraph>{/* 여기에 첫 번째 문단 */}여기에 첫 번째 문단이 들어갑니다. 억지스러운 장식 없이, 텍스트가 편하게 읽히도록 줄 간격과 여백을 넉넉히 두었습니다.</Paragraph>
          <Paragraph>{/* 여기에 두 번째 문단 */}두 번째 문단입니다. 문단 사이의 간격, 좌우 여백, 본문 폭(약 640px)이 읽기 흐름을 방해하지 않도록 조정돼 있습니다.</Paragraph>
        </section>

        {/* ── 이미지 (실제 파일 경로로 교체) ── */}
        <StoryImage /* src="/story/photo-1.jpg" */ caption="사진 설명을 여기에 (선택)" />

        <section>
          <Paragraph>{/* 여기에 세 번째 문단 */}이미지 아래 이어지는 문단입니다. 이미지와 텍스트가 번갈아 나오며 자연스러운 리듬을 만듭니다.</Paragraph>
        </section>

        {/* 필요하면 위 <StoryImage /> 와 <Paragraph> 를 복사해 섹션을 늘리세요. */}

      </article>
    </div>
  )
}
