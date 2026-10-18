import { computed } from '@common/utils/vueTools'
import { lyric } from '@lyric/store/lyric'
import { setting } from '@lyric/store/state'
import { lyricLines } from '@lyric/store/detailColors'

/**
 * Luminous Harmonic: 灵动岛展开态的滚动歌词窗口。
 *
 * 与「歌词条」（LyricBar）同源逻辑：
 *   - 逐字高亮：从 rawText 里抽 `<起始ms,时长ms>文本` 片段，配合 lyric.wordProgresses 得到每段进度
 *   - 逐行高亮：直接用整行文本（跟随设置「使用卡拉OK式歌词」）
 *
 * 行窗口始终以当前行为中心：上一行（淡）/ 当前行（亮、逐字）/ 下一行（淡）。
 * 行数由设置 lyricLines 控制（1 / 3 / 5），偶数行时多显示下一行。
 *
 * `time` 来自主窗推来的精简行表（store/detailColors.ts），用于「点歌词跳转」。
 */

interface Segment {
  text: string
  progress: number
}

interface LyricRow {
  /** -1 上一行 / 0 当前行 / 1 下一行，仅用于样式 */
  offset: number
  /** 该行在整首歌词里的下标（用于取 rawText / segments / time） */
  index: number
  text: string
  /** 起始时间（毫秒）；0 表示无有效时间（不可跳转） */
  time: number
  segments: Segment[]
  active: boolean
}

const FONT_TIME_EXP = /<(\d+),(\d+)>((?:(?!<\d+,\d+>)[\s\S])*)/g

/** 取某一行去掉字级时间戳后的纯文本 */
const plainTextOf = (index: number): string => {
  const raw = lyric.lines[index]?.rawText
  if (raw) return raw.replace(/<\d+,\d+>/g, '')
  return lyric.lines[index]?.text ?? ''
}

/** 取某一行的起始时间（毫秒）；主窗没推行表时退回歌词引擎的行时间 */
const lineTimeOf = (index: number): number => {
  const pushed = lyricLines[index]?.time
  if (typeof pushed == 'number' && pushed > 0) return pushed
  const engineTime = lyric.lines[index]?.time
  return typeof engineTime == 'number' && engineTime > 0 ? engineTime : 0
}

/** 取某一行拆成逐字片段（附带各自进度） */
const segmentsOf = (index: number, isCurrent: boolean): Segment[] => {
  const raw = lyric.lines[index]?.rawText ?? ''
  if (!raw || !raw.includes('<')) return []
  const matches = [...raw.matchAll(FONT_TIME_EXP)]
  if (!matches.length) return []
  return matches
    .map((match, i) => ({
      text: match[3],
      // 只有当前行才有实时逐字进度，其它行给 0（未播放状态）
      progress: isCurrent ? (lyric.wordProgresses[i] ?? 0) : 0,
    }))
    .filter(seg => seg.text)
}

export default function useIslandLyric() {
  /** 是否逐字高亮（跟随主窗设置，默认开启） */
  const isWordMode = computed(() => setting['desktopLyric.style.isZoomActiveLrc'] !== false)

  const totalLines = computed(() => lyric.lines.length)

  /** 环绕窗口：始终以当前行为中心 */
  const rows = computed<LyricRow[]>(() => {
    const lines = Math.max(1, setting['desktopLyric.island.lyricLines'] ?? 3)
    const half = Math.floor(lines / 2)
    const cur = lyric.line
    if (!totalLines.value || cur < 0) return []
    const out: LyricRow[] = []
    for (let offset = -half; offset <= lines - half - 1; offset++) {
      const index = cur + offset
      if (index < 0 || index >= totalLines.value) continue
      const isCurrent = offset === 0
      const text = plainTextOf(index)
      out.push({
        offset,
        index,
        text,
        time: lineTimeOf(index),
        segments: isCurrent && isWordMode.value ? segmentsOf(index, true) : [],
        active: isCurrent,
      })
    }
    // 末尾行不足时用空行补齐，保证高度稳定、当前行始终在中线
    const want = lines
    if (out.length && out.length < want) {
      const padTop = out[0].offset > -half
      const padCount = want - out.length
      const emptyRow = (offset: number): LyricRow => ({ offset, index: -1, text: '', time: 0, segments: [], active: false })
      const pads: LyricRow[] = []
      for (let i = 0; i < padCount; i++) {
        if (padTop) pads.push(emptyRow(out[0].offset - i - 1))
        else pads.push(emptyRow(out[out.length - 1].offset + i + 1))
      }
      out.unshift(...pads.filter(p => p.offset < out[0].offset).reverse())
      out.push(...pads.filter(p => p.offset > out[out.length - 1].offset))
    }
    return out
  })

  /** 收起态用的单行文本（无歌词时退化为歌名-歌手） */
  const currentLineText = computed(() => {
    const t = plainTextOf(lyric.line)
    return t || lyric.text || ''
  })

  /** 收起态的逐字片段（跟随逐字/逐行设置） */
  const currentSegments = computed<Segment[]>(() => (
    isWordMode.value ? segmentsOf(lyric.line, true) : []
  ))

  /** 当前行在整个歌里的相对位置（0..1），收起态细进度用 */
  const lineRatio = computed(() => {
    const total = totalLines.value
    if (!total) return 0
    return Math.max(0, Math.min(1, (lyric.line + (lyric.wordProgress || 0)) / total))
  })

  return {
    isWordMode,
    rows,
    currentLineText,
    currentSegments,
    lineRatio,
    totalLines,
  }
}
