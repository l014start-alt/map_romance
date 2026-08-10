'use client'

import { useEffect, useState } from 'react'
import QR from 'qrcode'

/* URL 등을 QR 이미지로 렌더 — 오프라인(키오스크)에서도 동작하도록 클라이언트에서 로컬 생성. */
export default function QRCode({
  value,
  size = 132,
  fg = '#1A1614',
  bg = '#FFFFFF',
}: { value: string; size?: number; fg?: string; bg?: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    if (!value) return
    let alive = true
    QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: fg, light: bg } })
      .then((url) => { if (alive) setSrc(url) })
      .catch(() => {})
    return () => { alive = false }
  }, [value, size, fg, bg])

  if (!src) return <div style={{ width: size, height: size, borderRadius: 8, background: bg }} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="QR 코드" width={size} height={size} style={{ display: 'block', borderRadius: 8 }} />
  )
}
