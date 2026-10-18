// Luminous Harmonic: 「功能组件颜色」解析 — 歌词高亮 / 进度条 / 按钮的强调色来源。
//
// 从 PlayDetail/index.vue 原样抽出（逐字搬运，未改数值），目的有两个：
//   1. 详情页与桌面歌词/灵动岛共用同一套取色逻辑（用户要求「保持相同的取色逻辑」）
//   2. 让不带 DOM 的调用方（往歌词窗推送 accent 的步骤）也能算出同一个值
//
// 取色优先级（playDetail.uiAccent）：
//   'cover'   → 封面取色（保持封面色相，亮度归入可读区间）
//   'rgb(..)' → 用户选定的色板 / 调色盘颜色
//
// 可读性保证（Pure-music M3 思路）：背景流光永远偏暗，把强调色亮度归入
// [bgL + 0.28, 0.90] 区间 —— 保持色相与饱和，只提亮度 → 任何封面/所选颜色都清晰，
// 且不会被压成黑色（此前向黑调整导致取色变黑，用户反馈）。

/** 详情页不透明文字色（中性高对比，任何封面色下都清晰） */
export const DETAIL_FONT_BRIGHT = '#f4f5f7'
/** 详情页通用轻贴边影 */
export const DETAIL_FONT_SHADOW = '0 1px 2px rgb(0 0 0 / .30)'
/** 详情页歌词专用轻阴影（比通用更实一点，保证暗背景可读） */
export const DETAIL_LYRIC_SHADOW = '0 1px 2px rgb(0 0 0 / .4)'
/** 收尾蒙层透明度（流光层已预压暗，固定轻蒙层即可） */
export const DETAIL_SCRIM_OPACITY = 0.14

// 灵动岛卡片的收尾蒙层（IslandFlowBg 里的实测值）。控件取色要按它折算后的底做对比度兜底。
export const ISLAND_SCRIM_ALPHA = 0.70

const srgbToLinear = (v) => {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/** WCAG 相对亮度（0..1） */
export const relativeLuminance = ([r, g, b]) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)

/** WCAG 对比度（1..21） */
export const contrastRatio = (rgbA, rgbB) => {
  const la = relativeLuminance(rgbA)
  const lb = relativeLuminance(rgbB)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

const rgbToHsl = (r, g, b) => {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h, s, l]
}

const hslToRgb = (h, s, l) => {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v] }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(v => Math.round(v * 255))
}

/** 把 "r, g, b" / "rgb(r,g,b)" 解析为三元组；解析不出返回 null */
export const parseRgbTriple = (value) => {
  const m = String(value ?? '').match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/**
 * Luminous Harmonic: 控件专用取色 —— 「与详情页同源，且始终清晰可见」。
 *
 * 详情页的 accentBright 会被刻意压暗（让进度条在亮背景上清晰），放到灵动岛这张
 * 暗卡上就会出现「深色图标压在近黑背景上」的隐形问题。这里做一次兜底：
 * 在「保持色相与饱和」的前提下调整亮度，直到与卡片底的对比度达到目标值。
 *
 * 两个方向都试（亮底需要变暗、暗底需要变亮），优先选择「调整幅度更小」的那个，
 * 这样既保证可读性，又尽量贴近详情页的原色。
 *
 * @param {object} opts
 * @param {string} opts.accent  详情页 accentBright（形如 "rgb(r, g, b)"）
 * @param {string} opts.cardBackground  卡片底色（形如 "rgb(r, g, b)"）
 * @param {number} [opts.minRatio] 目标对比度，默认 4.5（WCAG AA 正文）
 * @returns {string} 可安全用于图标的颜色
 */
export const computeControlColor = ({ accent, cardBackground, minRatio = 4.5 } = {}) => {
  const fg = parseRgbTriple(accent)
  const bg = parseRgbTriple(cardBackground)
  // 解析不出（例如 accent 是 var(--color-primary)）就原样交给 CSS 回退
  if (!fg || !bg) return accent || 'var(--color-primary)'

  if (contrastRatio(fg, bg) >= minRatio) return `rgb(${fg.join(',')})`

  const [h, s, l] = rgbToHsl(fg[0], fg[1], fg[2])

  /** 沿一个方向按 0.04 步长找满足对比度的最小调整量 */
  const search = (dir) => {
    for (let step = 1; step <= 25; step++) {
      const nextL = l + dir * step * 0.04
      if (nextL < 0 || nextL > 1) return null
      const rgb = hslToRgb(h, s, nextL)
      if (contrastRatio(rgb, bg) >= minRatio) return { rgb, step, l: nextL }
    }
    return null
  }
  const brighter = search(1)
  // 往暗走时适当降饱和，避免暗色显得浑浊
  const darker = search(-1)

  const chosen = (() => {
    if (brighter && darker) return brighter.step <= darker.step ? brighter : darker
    return brighter || darker
  })()
  if (chosen) return `rgb(${chosen.rgb.join(',')})`

  // 两个方向都不行（极窄的中间灰底）：退到「与底色相反」的极端，保可读性优先
  const bgLum = relativeLuminance(bg)
  const fallback = bgLum > 0.5
    ? hslToRgb(h, Math.min(s, 0.25), 0.06)
    : hslToRgb(h, Math.min(s, 0.18), 0.97)
  return `rgb(${fallback.join(',')})`
}

/**
 * 计算详情页那套强调色（只算「功能组件颜色」— accent-bright）。
 *
 * 其余变量（font-bright / font-shadow / lyric-shadow / scrim-opacity）在主题模式下
 * 取值不同，调用方需按 backgroundMode 自行分支；本函数只负责强调色，避免把
 * 两种模式的行为混在一起。
 *
 * @param {object} opts
 * @param {string} opts.coverAccent  封面主色，形如 "102, 126, 255"
 * @param {string} opts.backgroundMode  playDetail.backgroundMode（'theme' | 'cover'）
 * @param {string} opts.uiAccent  playDetail.uiAccent（'cover' | "rgb(..)" 形式）
 * @returns {{accentBright: string, onAccent: string|null, accentColor: string|null, luminance: number}}
 *   accentColor 为 null 表示调用方应移除 --detail-accent-color（改用主题色变量）
 */
export const computeDetailAccent = ({ coverAccent, backgroundMode, uiAccent } = {}) => {
  const uiAccentMode = uiAccent || 'cover'
  // 主题配色模式 + 未自定义色：维持原有行为，主题色轻混白
  if (uiAccentMode === 'cover' && backgroundMode === 'theme') {
    return {
      accentBright: 'color-mix(in srgb, var(--color-primary) 82%, white)',
      onAccent: null,
      accentColor: null,
      luminance: 0,
    }
  }

  const parts = parseRgbTriple(coverAccent)
  if (!parts) {
    return { accentBright: 'var(--color-primary)', onAccent: null, accentColor: null, luminance: 0 }
  }

  const [r, g, b] = parts
  const luminance = (r * 299 + g * 587 + b * 114) / 1000
  // 背景流光亮度估计 (brightness .88 × 蒙层)
  const bgL = Math.min(0.62, (luminance / 255) * 0.72)

  // 亮度归入可读区间: 保持色相/饱和, L → clamp(bgL + 0.28, 0.66, 0.90);
  // 低饱和 (灰白系) 颜色同时补一点饱和 (×1.15) 避免和灰色背景融在一起
  const readableAccent = (rgb, allowDarken = false) => {
    const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2])
    // 封面取色永远向亮调整; 用户主动选择的颜色按"改动最小"的方向调整
    // (亮色微提亮 / 暗色微压暗), 乌漆麻黑这类深色在亮背景下可保持深色
    const targetL = allowDarken
      ? (l >= bgL ? Math.min(0.9, Math.max(0.66, bgL + 0.28)) : Math.max(0.1, Math.min(0.64, bgL - 0.28)))
      : Math.min(0.9, Math.max(0.66, bgL + 0.28))
    const s2 = targetL >= l ? Math.min(1, Math.max(s, 0.18) * 1.15) : Math.max(0, s * 0.9)
    return hslToRgb(h, s2, targetL)
  }

  const uiBase = uiAccentMode !== 'cover'
    ? (parseRgbTriple(uiAccentMode) || parts)
    : parts
  const finalRgb = readableAccent(uiBase, uiAccentMode !== 'cover')

  return {
    accentBright: `rgb(${finalRgb.join(',')})`,
    // 强调色上的文字对比色（Pure-music: luminance > 140 用黑, 否则白）
    onAccent: luminance > 140 ? '#111318' : '#ffffff',
    accentColor: `rgb(${parts.join(',')})`,
    luminance,
  }
}
