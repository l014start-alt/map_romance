'use client'

import Image from 'next/image'

/* ──────────────────────────────────────────────
   PNG 아이콘 경로
────────────────────────────────────────────── */
const REGION_IMAGES: Record<string, string> = {
  seoul:     '/나무_집.png',
  busan:     '/빗방울.png',
  daegu:     '/태양.png',
  jeju:      '/별.png',
  daejeon:   '/맥주.png',
  gyeongju:  '/번개.png',
  gangneung: '/커피컵.png',
}

/* ──────────────────────────────────────────────
   컬러 필터 설계
   원리: brightness(0) invert(1) → 검정→흰색 변환 (투명 영역 유지)
         sepia(1) → 흰색→연크림 HSL(60°,100%,97%)
         saturate(S) → 채도 조절 (S<1 : 톤다운)
         hue-rotate(θ) → θ = 목표색조 - 60° 로 색상 이동
         brightness(B) → B = 목표명도/97% 로 최종 밝기 조절
────────────────────────────────────────────── */
interface ColorDef {
  base:  string
  hover: string
}

// ★ 올바른 컬러라이즈 원리
//   검정 PNG를 색상으로 바꾸려면 먼저 "중간 갈색 베이스"를 만들어야 함
//   invert(60%)  → 검정(0)  → 중간회색(153,153,153)
//   sepia(1)     → 중간회색 → 웜 브라운 HSL(38°, 40%, 69%)  ← 이 지점이 발색의 출발점
//   hue-rotate(θ)→ θ = 목표색조 - 38° (0~360 범위)
//   saturate(S)  → 목표채도 / 40% 배율로 조절
//   brightness(B)→ 목표명도 / 69% 배율로 조절
const REGION_COLORS: Record<string, ColorDef> = {
  // 더스티 로즈 HSL(10°, 45%, 55%) — 도시의 따뜻한 벽돌·골목
  // θ = 10-38 = -28° → 332°,  S = 45/40 = 1.1,  B = 55/69 = 0.80
  seoul: {
    base:  'invert(60%) sepia(1) hue-rotate(332deg) saturate(1.1) brightness(0.80)',
    hover: 'invert(60%) sepia(1) hue-rotate(332deg) saturate(1.4) brightness(0.90) drop-shadow(0 4px 14px rgba(185,105,90,0.40))',
  },
  // 뮤트 스틸 블루 HSL(205°, 40%, 55%) — 바다·파도·빗방울
  // θ = 205-38 = 167°,  S = 40/40 = 1.0,  B = 55/69 = 0.80
  busan: {
    base:  'invert(60%) sepia(1) hue-rotate(167deg) saturate(1.0) brightness(0.80)',
    hover: 'invert(60%) sepia(1) hue-rotate(167deg) saturate(1.35) brightness(0.90) drop-shadow(0 4px 14px rgba(75,120,165,0.40))',
  },
  // 워밍 앰버 HSL(28°, 70%, 58%) — 뜨겁고 달콤한 여름
  // θ = 28-38 = -10° → 350°,  S = 70/40 = 1.75,  B = 58/69 = 0.84
  daegu: {
    base:  'invert(60%) sepia(1) hue-rotate(350deg) saturate(1.75) brightness(0.84)',
    hover: 'invert(60%) sepia(1) hue-rotate(350deg) saturate(2.20) brightness(0.95) drop-shadow(0 4px 14px rgba(210,135,60,0.40))',
  },
  // 딥 인디고 HSL(225°, 42%, 48%) — 제주 밤하늘·별·바람
  // θ = 225-38 = 187°,  S = 42/40 = 1.05,  B = 48/69 = 0.70
  jeju: {
    base:  'invert(60%) sepia(1) hue-rotate(187deg) saturate(1.05) brightness(0.70)',
    hover: 'invert(60%) sepia(1) hue-rotate(187deg) saturate(1.40) brightness(0.80) drop-shadow(0 4px 14px rgba(70,90,160,0.40))',
  },
  // 허니 골드 HSL(40°, 65%, 52%) — 느린 밤·맥주 한 잔
  // θ ≈ 2° → negligible,  S = 65/40 = 1.625,  B = 52/69 = 0.75
  daejeon: {
    base:  'invert(60%) sepia(1) saturate(1.62) brightness(0.75)',
    hover: 'invert(60%) sepia(1) saturate(2.10) brightness(0.85) drop-shadow(0 4px 14px rgba(195,155,55,0.40))',
  },
  // 딥 버건디 HSL(330°, 38%, 40%) — 천 년의 낭만·역사
  // θ = 330-38 = 292°,  S = 38/40 = 0.95,  B = 40/69 = 0.58
  gyeongju: {
    base:  'invert(60%) sepia(1) hue-rotate(292deg) saturate(0.95) brightness(0.58)',
    hover: 'invert(60%) sepia(1) hue-rotate(292deg) saturate(1.30) brightness(0.68) drop-shadow(0 4px 14px rgba(135,60,105,0.40))',
  },
  // 커피 브라운 HSL(20°, 40%, 42%) — 커피향이 파도처럼
  // θ = 20-38 = -18° → 342°,  S = 40/40 = 1.0,  B = 42/69 = 0.61
  gangneung: {
    base:  'invert(60%) sepia(1) hue-rotate(342deg) saturate(1.0) brightness(0.61)',
    hover: 'invert(60%) sepia(1) hue-rotate(342deg) saturate(1.35) brightness(0.72) drop-shadow(0 4px 14px rgba(125,80,48,0.40))',
  },
}

/* ──────────────────────────────────────────────
   SVG 폴백 (광주 — 이미지 없음)
────────────────────────────────────────────── */
const SVG_FALLBACK: Record<string, { path: string; fill: string; stroke: string; hoverFill: string }> = {
  gwangju: {
    path:      'M 10,38 L 28,12 L 58,8 L 84,18 L 92,44 L 82,70 L 58,84 L 28,82 L 10,66 Z',
    fill:      '#D4C5F0',
    stroke:    '#9B7FD4',
    hoverFill: '#C0AAEC',
  },
}

/* ──────────────────────────────────────────────
   컴포넌트
────────────────────────────────────────────── */
interface RegionSilhouetteProps {
  regionId: string
  size?:    number
  hovered?: boolean
}

export default function RegionSilhouette({ regionId, size = 68, hovered = false }: RegionSilhouetteProps) {
  const imgSrc   = REGION_IMAGES[regionId]
  const colorDef = REGION_COLORS[regionId]

  if (imgSrc && colorDef) {
    return (
      <div
        style={{
          width:       size,
          height:      size,
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'center',
          flexShrink:  0,
        }}
      >
        <Image
          src={imgSrc}
          alt={regionId}
          width={size}
          height={size}
          style={{
            width:      size,
            height:     size,
            objectFit:  'contain',
            display:    'block',
            filter:     hovered ? colorDef.hover : colorDef.base,
            transition: 'filter 0.28s ease',
          }}
        />
      </div>
    )
  }

  const svg = SVG_FALLBACK[regionId]
  if (!svg) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={{
        display:    'block',
        filter:     hovered ? 'drop-shadow(0 4px 10px rgba(120,80,200,0.30))' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))',
        transition: 'filter 0.28s ease',
      }}
    >
      <path
        d={svg.path}
        fill={hovered ? svg.hoverFill : svg.fill}
        stroke={svg.stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        style={{ transition: 'fill 0.28s ease' }}
      />
    </svg>
  )
}
