'use client'

import Image from 'next/image'

const REGION_IMAGES: Record<string, string> = {
  seoul:     '/나무_집.png',
  busan:     '/빗방울.png',
  daegu:     '/태양.png',
  jeju:      '/별.png',
  daejeon:   '/맥주.png',
  gyeongju:  '/번개.png',
  gangneung: '/커피컵.png',
}

const SVG_FALLBACK: Record<string, { path: string; fill: string; stroke: string }> = {
  gwangju: {
    path: 'M 10,38 L 28,12 L 58,8 L 84,18 L 92,44 L 82,70 L 58,84 L 28,82 L 10,66 Z',
    fill: '#EEE0FF',
    stroke: '#C090F0',
  },
}

interface RegionSilhouetteProps {
  regionId: string
  size?: number
}

export default function RegionSilhouette({ regionId, size = 68 }: RegionSilhouetteProps) {
  const imgSrc = REGION_IMAGES[regionId]

  if (imgSrc) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Image
          src={imgSrc}
          alt={regionId}
          width={size}
          height={size}
          style={{
            width: size,
            height: size,
            objectFit: 'contain',
            display: 'block',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.10))',
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
      style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
    >
      <path
        d={svg.path}
        fill={svg.fill}
        stroke={svg.stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
