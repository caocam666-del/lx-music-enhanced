import { markRaw, reactive } from '@common/utils/vueTools'


export const lyrics = markRaw<{
  lyric: string
  tlyric: string | null
  rlyric: string | null
  lxlyric: string | null
}>({
  lyric: '',
  tlyric: '',
  rlyric: '',
  lxlyric: '',
})

interface Line {
  text: string
  rawText: string
  time: number
  extendedLyrics: string[]
  dom_line: HTMLDivElement
}

export const lyric = reactive<{
  lines: Line[]
  text: string
  line: number
  wordProgress: number
  wordProgresses: number[]
  offset: number // 歌词延迟
  tempOffset: number // 歌词临时延迟
}>({
  lines: [],
  text: '',
  line: 0,
  wordProgress: 0,
  wordProgresses: [],
  offset: 0, // 歌词延迟
  tempOffset: 0, // 歌词临时延迟
})

export const setLines = (lines: Line[]) => {
  if (!lines.length && !lyric.lines.length) return
  lyric.lines = lines
}
export const setText = (text: string, line: number) => {
  lyric.text = text
  lyric.line = line
}
export const setWordProgress = (progress: number) => {
  lyric.wordProgress = Math.max(0, Math.min(1, progress))
}
export const setWordProgresses = (progresses: number[]) => {
  lyric.wordProgresses = progresses
  setWordProgress(progresses.length ? progresses.reduce((total, progress) => total + progress, 0) / progresses.length : 0)
}
export const setOffset = (offset: number) => {
  lyric.offset = offset
}
export const setTempOffset = (offset: number) => {
  lyric.tempOffset = offset
}
