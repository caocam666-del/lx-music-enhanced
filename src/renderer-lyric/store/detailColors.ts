import { reactive } from '@common/utils/vueTools'

/**
 * Luminous Harmonic: 歌词窗侧的「详情页配色」与「精简歌词行表」。
 *
 * 主窗（core/lyric.ts）按详情页同一套取色逻辑算出强调色/文字色后随 set_info 推过来，
 * 这里落到 CSS 变量上 —— 这样灵动岛的歌词、进度条、按钮与歌词详情页完全同色。
 *
 * lines 是 [{text, time}] 的精简行表，只在 set_info 时更新（不是每帧），
 * 供「点歌词跳转到该行时间」使用。
 */

const DEFAULT_ACCENT = 'var(--color-primary)'
const DEFAULT_FONT_BRIGHT = 'var(--lyric-text, var(--color-font))'

export const detailColors = reactive({
  /** --detail-accent-bright：歌词高亮 / 进度条 / 按钮强调色 */
  accent: DEFAULT_ACCENT,
  /** --detail-font-bright：中性高对比文字色 */
  fontBright: DEFAULT_FONT_BRIGHT,
  /** --detail-lyric-shadow：歌词专用轻阴影 */
  lyricShadow: 'none',
})

export const lyricLines: { text: string, time: number }[] = reactive([])

const applyVar = (name: string, value: string | null | undefined, fallback: string) => {
  const root = document.documentElement
  if (value) root.style.setProperty(name, value)
  else root.style.setProperty(name, fallback)
}

export const setDetailColors = ({ accent, fontBright, lyricShadow }: {
  accent?: string
  fontBright?: string
  lyricShadow?: string
} = {}) => {
  if (accent) detailColors.accent = accent
  if (fontBright) detailColors.fontBright = fontBright
  if (lyricShadow !== undefined) detailColors.lyricShadow = lyricShadow || 'none'

  applyVar('--detail-accent-bright', detailColors.accent, DEFAULT_ACCENT)
  applyVar('--detail-font-bright', detailColors.fontBright, DEFAULT_FONT_BRIGHT)
  applyVar('--detail-lyric-shadow', detailColors.lyricShadow, 'none')
}

export const setLyricLines = (lines?: { text: string, time: number }[]) => {
  lyricLines.length = 0
  if (!Array.isArray(lines)) return
  for (const line of lines) {
    lyricLines.push({
      text: typeof line?.text == 'string' ? line.text : '',
      time: Number.isFinite(line?.time) ? Number(line.time) : 0,
    })
  }
}

/** 取出指定下标的行起始时间（毫秒）；无有效时间返回 null（表示不可跳转） */
export const getLineTime = (index: number): number | null => {
  const line = lyricLines[index]
  if (!line) return null
  return line.time > 0 ? line.time : null
}
