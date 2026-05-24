'use client'

interface SilhouetteData {
  path: string
  fill: string
  stroke: string
}

const SILHOUETTES: Record<string, SilhouetteData> = {
  seoul: {
    path: 'M 52,5 L 72,10 L 88,22 L 92,42 L 85,62 L 68,80 L 48,86 L 28,80 L 12,64 L 8,44 L 18,24 L 35,10 Z',
    fill: '#FFE8E0',
    stroke: '#F0A898',
  },
  busan: {
    path: 'M 50,4 L 66,10 L 80,22 L 86,40 L 84,60 L 76,76 L 58,88 L 40,88 L 24,76 L 16,60 L 18,38 L 28,20 Z',
    fill: '#E0EEFF',
    stroke: '#90B0F0',
  },
  daegu: {
    path: 'M 8,40 L 24,18 L 50,10 L 76,16 L 92,36 L 90,58 L 76,76 L 50,84 L 24,76 L 8,58 Z',
    fill: '#FFE0EC',
    stroke: '#F098B8',
  },
  jeju: {
    path: 'M 10,50 Q 18,24 45,16 Q 68,10 86,26 Q 96,42 88,62 Q 78,76 52,82 Q 26,82 12,68 Q 6,60 10,50 Z',
    fill: '#E0F8F0',
    stroke: '#7DD8C0',
  },
  daejeon: {
    path: 'M 50,8 L 72,16 L 86,36 L 84,60 L 68,78 L 44,82 L 20,70 L 10,48 L 20,26 L 40,10 Z',
    fill: '#FFF8E0',
    stroke: '#E8CC88',
  },
  gwangju: {
    path: 'M 10,38 L 28,12 L 58,8 L 84,18 L 92,44 L 82,70 L 58,84 L 28,82 L 10,66 Z',
    fill: '#EEE0FF',
    stroke: '#C090F0',
  },
  gyeongju: {
    path: 'M 50,5 L 72,14 L 85,32 L 85,55 L 72,74 L 55,88 L 38,88 L 22,74 L 14,52 L 18,28 L 32,12 Z',
    fill: '#E0F8FF',
    stroke: '#80C8E0',
  },
  gangneung: {
    path: 'M 42,5 L 58,8 L 72,22 L 78,44 L 76,66 L 62,82 L 44,86 L 28,74 L 20,52 L 22,30 Z',
    fill: '#FFE8D0',
    stroke: '#E8A878',
  },
}

interface RegionSilhouetteProps {
  regionId: string
  size?: number
}

export default function RegionSilhouette({ regionId, size = 68 }: RegionSilhouetteProps) {
  const data = SILHOUETTES[regionId]
  if (!data) return null

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={{ display: 'block', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
    >
      <path
        d={data.path}
        fill={data.fill}
        stroke={data.stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
