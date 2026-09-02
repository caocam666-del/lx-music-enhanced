// Luminous Harmonic: 壁纸应用 + 亮度自适应透明度
// 应用壁纸时对图做 32px 缩略采样, 按平均亮度写 --lx-wallpaper-opacity:
// 亮壁纸调低 (0.28) 防止内容区发白发虚, 暗壁纸可稍高 (0.5) 保持氛围 —
// 对标 Pure-music app_shell 的壁纸亮度自适应遮罩思路。
// (--lx-wallpaper-opacity 由 luminous.less 读取, 无壁纸时保持默认 0.4)

const applyLuminance = dataUrl => {
  const image = new window.Image()
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 32
      canvas.height = 32
      const context = canvas.getContext('2d', { willReadFrequently: true })
      context.drawImage(image, 0, 0, 32, 32)
      const { data } = context.getImageData(0, 0, 32, 32)
      let total = 0
      for (let i = 0; i < data.length; i += 4) {
        total += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000
      }
      const luminance = total / (data.length / 4)
      // 亮 (>170) 0.28 / 中 (85~170) 0.4 / 暗 (<85) 0.5
      const opacity = luminance > 170 ? 0.28 : (luminance < 85 ? 0.5 : 0.4)
      document.documentElement.style.setProperty('--lx-wallpaper-opacity', String(opacity))
    } catch {
      // 采样失败保持默认透明度
    }
  }
  image.src = dataUrl
}

export const applyWallpaper = dataUrl => {
  const el = document.getElementById('lx-wallpaper-bg')
  if (el) el.style.backgroundImage = dataUrl ? `url(${dataUrl})` : 'none'
  if (dataUrl) {
    applyLuminance(dataUrl)
  } else {
    document.documentElement.style.removeProperty('--lx-wallpaper-opacity')
  }
}
