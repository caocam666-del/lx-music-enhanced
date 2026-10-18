import { reactive } from '@common/utils/vueTools'

export interface Line {
  text: string
  time: number
  extendedLyrics: string[]
  dom_line: HTMLDivElement
}

export const lyric = reactive<{
  lines: Line[]
  text: string
  line: number
  offset: number // 歌词延迟
  tempOffset: number // 歌词临时延迟
}>({
  lines: [],
  text: '',
  line: 0,
  offset: 0, // 歌词延迟
  tempOffset: 0, // 歌词临时延迟
})

export const setLines = (lines: Line[]) => {
  if (!lines.length && !lyric.lines.length) return
  lyric.lines = lines
}

/**
 * Luminous Harmonic: 防止「原始逐字歌词 JSON」漏到界面。
 *
 * 逐字歌词 (lxlyric) 本质是 `[{"text":"...","rawText":"<0,500>..."}, ...]` 这样的 JSON。
 * 正常情况下它会被歌词解析器解析成纯文本；但一旦上游给了未解析的 JSON、
 * 或解析失败后原样透传，播放栏/歌词窗就会把整段 JSON 当歌词显示出来。
 * 这里做最后一道闸：疑似原始 JSON 的文本一律不显示（宁可留空，也不把 JSON 糊到脸上）。
 *
 * 只拦「以 { 或 [ 开头且包含 text/rawText 字段」的形态，不误伤正常歌词（歌词可能含 { 但不以它开头）。
 */
const looksLikeRawLyricJson = (text: string): boolean => {
  if (typeof text != 'string' || !text) return false
  const head = text.trimStart()
  if (head.charAt(0) != '{' && head.charAt(0) != '[') return false
  return /"?(rawText|text|extendedLyrics)"?\s*:/.test(text)
}

/** 逐字歌词字级时间戳 `<0,500>`，展示前必须去掉 */
const fontTimeExp = /<\d+,\d+>/g

const sanitizeLyricText = (text: string): string => {
  if (typeof text != 'string') return ''
  if (looksLikeRawLyricJson(text)) return ''
  return text.replace(fontTimeExp, '')
}

export const setText = (text: string, line: number) => {
  lyric.text = sanitizeLyricText(text)
  lyric.line = line
}
export const setOffset = (offset: number) => {
  lyric.offset = offset
}
export const setTempOffset = (offset: number) => {
  lyric.tempOffset = offset
}
