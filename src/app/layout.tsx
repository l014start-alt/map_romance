import type { Metadata } from 'next'
import { Nanum_Brush_Script, Noto_Serif_KR } from 'next/font/google'
import './globals.css'

const nanumBrush = Nanum_Brush_Script({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-brand',
  display: 'swap',
})

const notoSerifKr = Noto_Serif_KR({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '낭만여지도',
  description: '우리들의 담백한 순간을 기록하는 지도.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`h-full ${nanumBrush.variable} ${notoSerifKr.variable}`}>
      <head>
        {/* Pretendard — UI 본문 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className="h-full overflow-hidden"
        style={{ background: '#D6D0C8', display: 'flex', justifyContent: 'center' }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            height: '100%',
            background: '#FAF8F5',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </body>
    </html>
  )
}
