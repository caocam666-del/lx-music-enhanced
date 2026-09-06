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
  if (el) {
    el.style.backgroundImage = dataUrl ? `url(${dataUrl})` : 'none'
    el.style.backgroundSize = ''
  }
  hideBackdrop()
  if (dataUrl) {
    applyLuminance(dataUrl)
  } else {
    document.documentElement.style.removeProperty('--lx-wallpaper-opacity')
  }
}

// Luminous Harmonic: 模糊底衬层开关 — 仅 WE 场景/web (方形预览图 contain 显示) 时启用
const hideBackdrop = () => {
  const bd = document.getElementById('lx-wallpaper-backdrop')
  if (bd) bd.style.backgroundImage = 'none'
  document.documentElement.style.removeProperty('--lx-wallpaper-backdrop-opacity')
}

const showBackdrop = url => {
  const bd = document.getElementById('lx-wallpaper-backdrop')
  if (bd) bd.style.backgroundImage = url ? `url(${url})` : 'none'
  document.documentElement.style.setProperty('--lx-wallpaper-backdrop-opacity', '1')
}

// Luminous Harmonic: Wallpaper Engine 壁纸支持 —
// 视频壁纸走 #lx-wallpaper-video 层 (静音循环播放), 其余走 #lx-wallpaper-bg 静态层。
// 选择持久化在 localStorage: lx-we-current (JSON: {id, kind, title})。
// 位置/尺寸/裁剪/圆角全部由 CSS 控制 (luminous.less / App.vue), 这里只管内容与显示切换。
//
// Luminous Harmonic: 显示策略 (修复"只显示一部分且非常模糊") —
// WE 的场景/web 壁纸只有一张正方形预览图 (如 800x800), 之前用 cover 铺满宽窗口:
// 放大到 ~1900px 宽 (2.4x 上采样 → 模糊) 且竖向只显示中间 ~55% (只显示一部分)。
// 现在: 图片壁纸用项目原文件 (mediaUrl, 通常全高清) + cover;
//       场景/web 壁纸用预览图 + contain 完整清晰显示 (两侧透出流光背景)。
// 同时 WE 壁纸不做亮度自适应遮罩 (--lx-wallpaper-opacity 固定 1), 与视频层观感一致。
export const applyWallpaperEngine = (item) => {
  const video = document.getElementById('lx-wallpaper-video')
  const bg = document.getElementById('lx-wallpaper-bg')
  if (!item || (!item.mediaUrl && !item.previewUrl)) {
    // 清除 WE 壁纸: 停视频 + 清静态层与底衬, 透明度交还给自定义壁纸的亮度自适应
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.style.display = 'none'
    }
    if (bg) {
      bg.style.backgroundImage = 'none'
      bg.style.backgroundSize = ''
    }
    hideBackdrop()
    document.documentElement.style.removeProperty('--lx-wallpaper-opacity')
    window.localStorage.removeItem('lx-we-current')
    return
  }
  window.localStorage.setItem('lx-we-current', JSON.stringify({
    id: item.id,
    kind: item.kind,
    title: item.title ?? '',
    mediaUrl: item.mediaUrl ?? '',
    previewUrl: item.previewUrl ?? '',
  }))
  document.documentElement.style.setProperty('--lx-wallpaper-opacity', '1')
  const hideVideo = () => {
    if (!video) return
    video.pause()
    video.removeAttribute('src')
    video.style.display = 'none'
  }
  if (item.kind == 'video' && item.mediaUrl) {
    // 视频壁纸: 隐藏静态层与底衬, 播放视频
    hideBackdrop()
    if (bg) {
      bg.style.backgroundImage = 'none'
      bg.style.backgroundSize = ''
    }
    if (video) {
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.style.display = 'block'
      video.src = item.mediaUrl
      video.play().catch(() => {})
    }
  } else {
    hideVideo()
    if (!bg) return
    if (item.mediaUrl) {
      // 图片壁纸: 项目原始全分辨率图片, cover 满幅
      hideBackdrop()
      bg.style.backgroundImage = `url(${item.mediaUrl})`
      bg.style.backgroundSize = 'cover'
    } else {
      // 场景/web 壁纸: 方形预览图 contain 完整清晰显示,
      // 两侧透出同图 cover 放大的模糊底衬 (视觉上仍满幅, 不空旷)
      showBackdrop(item.previewUrl)
      bg.style.backgroundImage = item.previewUrl ? `url(${item.previewUrl})` : 'none'
      bg.style.backgroundSize = item.previewUrl ? 'contain' : ''
    }
  }
}

export const restoreWallpaperEngine = () => {
  let saved = null
  try { saved = JSON.parse(window.localStorage.getItem('lx-we-current') ?? 'null') } catch (_) { return }
  if (saved?.id) applyWallpaperEngine(saved)
}
