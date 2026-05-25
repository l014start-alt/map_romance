/** 이미지 파일을 최대 1024px / JPEG 72% 품질로 압축한 뒤 base64 문자열로 반환.
 *  canvas 초기화 실패 시 압축 없이 원본 DataURL을 그대로 반환. */
export function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) { reject(new Error('FileReader 실패')); return }

      const img = new Image()
      img.onerror = () => resolve(dataUrl)   // 이미지 파싱 실패 → 원본 사용
      img.onload = () => {
        try {
          const MAX = 1024
          let { width, height } = img
          if (width > MAX || height > MAX) {
            if (width >= height) { height = Math.round((height / width) * MAX); width = MAX }
            else { width = Math.round((width / height) * MAX); height = MAX }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(dataUrl); return }   // canvas 불가 환경 → 원본 사용
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.72))
        } catch {
          resolve(dataUrl)   // 예외 → 원본 사용
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}
