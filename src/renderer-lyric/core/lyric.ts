import Lyric from '@common/utils/lyric-font-player'
import { markRawList } from '@common/utils/vueTools'
import { setLines, setOffset, setTempOffset, setText, setWordProgresses, lyrics, lyric } from '@lyric/store/lyric'
import { musicInfo, setting } from '@lyric/store/state'

let lrc: Lyric
let progressFrame: number | null = null
let progressBaseTime = 0
let progressBaseWallTime = 0

const getWordProgresses = (rawText: string, elapsed: number) => {
  const words = [...rawText.matchAll(/<(\d+),(\d+)>/g)]
  if (!words.length) return []
  const current = Math.max(0, elapsed)
  return words.map(word => {
    const start = Number(word[1])
    const duration = Number(word[2])
    if (duration <= 0) return current >= start ? 1 : 0
    return Math.max(0, Math.min(1, (current - start) / duration))
  })
}

const stopProgressLoop = () => {
  if (progressFrame != null) cancelAnimationFrame(progressFrame)
  progressFrame = null
}

const updateProgress = () => {
  progressFrame = requestAnimationFrame(updateProgress)
  const line = lyric.lines[lyric.line]
  if (!line) return
  const elapsed = progressBaseTime + (performance.now() - progressBaseWallTime) * setting['player.playbackRate'] - line.time
  setWordProgresses(getWordProgresses(line.rawText, elapsed))
}

const startProgressLoop = (time: number) => {
  progressBaseTime = time
  progressBaseWallTime = performance.now()
  stopProgressLoop()
  progressFrame = requestAnimationFrame(updateProgress)
}

export const init = () => {
  lrc = new Lyric({
    shadowContent: true,
    activeLineClassName: 'active',
    rate: setting['player.playbackRate'],
    isVertical: setting['desktopLyric.direction'] == 'vertical',
    // Luminous Harmonic: 桌面歌词跟随详情页的逐字/逐行高亮模式
    mode: setting['desktopLyric.style.isZoomActiveLrc'] ? 'font' : 'line',
    onPlay(line, text, curTime) {
      setText(text, Math.max(line, 0))
      progressBaseTime = curTime
      progressBaseWallTime = performance.now()
      setWordProgresses([])
      // console.log(line, text)
    },
    onSetLyric(lines, offset) { // listening lyrics seting event
      // console.log(lines) // lines is array of all lyric text
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
      setOffset(offset) // 歌词延迟
      setTempOffset(0) // 重置临时延迟
    },
    onUpdateLyric(lines) {
      setLines(markRawList([...lines]))
      setText(lines[0] ?? '', 0)
    },
  })
}

/**
 * Luminous Harmonic: 桌面歌词逐字/逐行模式切换（跟随详情页）。
 * setMode 内部会重建渲染并同步当前播放位置。
 */
export const setLyricMode = (mode: boolean) => {
  lrc.setMode(mode ? 'font' : 'line')
}

export const setLyricOffset = (offset: number) => {
  setTempOffset(offset)
  lrc.setOffset(offset)
}

export const setPlaybackRate = (rate: number) => {
  lrc.setPlaybackRate(rate)
}

export const setLyric = () => {
  if (!musicInfo.id) return
  const extendedLyrics = []
  if (setting['player.isShowLyricRoma'] && lyrics.rlyric) extendedLyrics.push(lyrics.rlyric)
  if (setting['player.isShowLyricTranslation'] && lyrics.tlyric) extendedLyrics.push(lyrics.tlyric)
  if (setting['player.isSwapLyricTranslationAndRoma']) extendedLyrics.reverse()
  lrc.setLyric(
    setting['player.isPlayLxlrc'] && lyrics.lxlyric ? lyrics.lxlyric : lyrics.lyric,
    extendedLyrics,
  )
}


export const play = (time: number) => {
  if (!lyrics.lyric) return
  lrc.play(time)
  startProgressLoop(time)
}

export const pause = () => {
  lrc.pause()
  stopProgressLoop()
}

export const stop = () => {
  stopProgressLoop()
  lrc.setLyric('')
  // setLines([])
  setText('', 0)
  setWordProgresses([])
}

export const setVertical = (isVertical: boolean) => {
  lrc.setVertical(isVertical)
}
