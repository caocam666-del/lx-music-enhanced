import Lyric from '@common/utils/lyric-font-player'
import { getAnalyser, getCurrentTime as getPlayerCurrentTime } from '@renderer/plugins/player'
import { lyric, setLines, setOffset, setTempOffset, setText } from '@renderer/store/player/lyric'
import { isPlay, musicInfo } from '@renderer/store/player/state'
import { setStatusText } from '@renderer/store/player/action'
import { markRawList } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { onNewDesktopLyricProcess } from '@renderer/utils/ipc'
import { pause as pausePlayer, play as playPlayer, playNext, playPrev, togglePlay } from '@renderer/core/player'

const getCurrentTime = () => {
  return getPlayerCurrentTime() * 1000
}

let lrc: Lyric
let desktopLyricPort: Electron.IpcRendererEvent['ports'][0] | null = null
const analyserTools: {
  dataArray: Uint8Array
  bufferLength: number
  analyser: AnalyserNode | null
  sendDataArray: () => void
} = {
  dataArray: new Uint8Array(),
  bufferLength: 0,
  analyser: null,
  sendDataArray() {
    if (this.analyser == null) {
      this.analyser = getAnalyser()
      // console.log(this.analyser)
      if (!this.analyser) return
      this.bufferLength = this.analyser.frequencyBinCount
    }
    const dataArray = new Uint8Array(this.bufferLength)
    this.analyser.getByteFrequencyData(dataArray)
    sendDesktopLyricInfo({
      action: 'send_analyser_data_array',
      data: dataArray,
    }, [dataArray.buffer])
  },
}

export const sendDesktopLyricInfo = (info: LX.DesktopLyric.LyricActions, transferList?: Transferable[]) => {
  if (desktopLyricPort == null) return
  if (transferList) desktopLyricPort.postMessage(info, transferList)
  else desktopLyricPort.postMessage(info)
}
const handleDesktopLyricMessage = (action: LX.DesktopLyric.WinMainActions) => {
  if (typeof action != 'string' && action.action == 'player_action') {
    switch (action.data.action) {
      case 'play':
        playPlayer()
        break
      case 'pause':
        pausePlayer()
        break
      case 'prev':
        void playPrev()
        break
      case 'next':
        void playNext()
        break
      case 'toggle':
        togglePlay()
        break
    }
    return
  }
  switch (action) {
    case 'get_info':
      sendDesktopLyricInfo({
        action: 'set_info',
        data: {
          id: musicInfo.id,
          singer: musicInfo.singer,
          name: musicInfo.name,
          album: musicInfo.album,
          lrc: musicInfo.lrc,
          tlrc: musicInfo.tlrc,
          rlrc: musicInfo.rlrc,
          lxlrc: musicInfo.lxlrc,
          pic: musicInfo.pic,
          isPlay: isPlay.value,
          line: lyric.line,
          played_time: getCurrentTime(),
        },
      })
      break
    case 'get_status':
      sendDesktopLyricInfo({
        action: 'set_status',
        data: {
          isPlay: isPlay.value,
          line: lyric.line,
          played_time: getCurrentTime(),
        },
      })
      break
    case 'get_analyser_data_array':
      analyserTools.sendDataArray()
      break
    default:
      break
  }
}
export const init = () => {
  lrc = new Lyric({
    shadowContent: false,
    // Luminous Harmonic: 歌词高亮模式 (用户可在设置切换: 逐字/逐行)
    mode: appSetting['playDetail.style.lrcFontMode'] === false ? 'line' : 'font',
    onPlay(line, text) {
      setText(text, Math.max(line, 0))
      setStatusText(text)
      window.app_event.lyricLinePlay(text, line)
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
    rate: appSetting['player.playbackRate'],
    // offset: 80,
  })

  onNewDesktopLyricProcess(({ event }) => {
    console.log('onNewDesktopLyricProcess')
    const [port] = event.ports
    desktopLyricPort = port

    port.onmessage = ({ data }) => {
      handleDesktopLyricMessage(data.action)
      // The event data can be any serializable object (and the event could even
      // carry other MessagePorts with it!)
      // const result = doWork(event.data)
      // port.postMessage(result)
    }

    port.onmessageerror = (event) => {
      console.log('onmessageerror', event)
    }
  })

  // 封面通常在播放开始后异步获取，更新后同步到歌词窗口。
  window.app_event.on('picUpdated', sendInfo)
}

export const setLyricOffset = (offset: number) => {
  const tempOffset = offset - lyric.offset
  setTempOffset(tempOffset)
  lrc.setOffset(tempOffset)
  sendDesktopLyricInfo({
    action: 'set_offset',
    data: tempOffset,
  })

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime() * 1000
      sendDesktopLyricInfo({
        action: 'set_play',
        data: time,
      })
      lrc.play(time)
    })
  }
}

export const setPlaybackRate = (rate: number) => {
  lrc.setPlaybackRate(rate)

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime() * 1000
      lrc.play(time)
    })
  }
}

export const setLyric = () => {
  if (!musicInfo.id) return
  if (musicInfo.lrc) {
    const extendedLyrics = []
    if (appSetting['player.isShowLyricRoma'] && musicInfo.rlrc) extendedLyrics.push(musicInfo.rlrc)
    if (appSetting['player.isShowLyricTranslation'] && musicInfo.tlrc) extendedLyrics.push(musicInfo.tlrc)
    if (appSetting['player.isSwapLyricTranslationAndRoma']) extendedLyrics.reverse()

    lrc.setLyric(
      appSetting['player.isPlayLxlrc'] && musicInfo.lxlrc ? musicInfo.lxlrc : musicInfo.lrc,
      extendedLyrics,
    )
    sendDesktopLyricInfo({
      action: 'set_lyric',
      data: {
        lrc: musicInfo.lrc,
        tlrc: musicInfo.tlrc,
        rlrc: musicInfo.rlrc,
        lxlrc: musicInfo.lxlrc,
      },
    })
  }

  if (isPlay.value) {
    setTimeout(() => {
      const time = getCurrentTime() * 1000
      sendDesktopLyricInfo({ action: 'set_play', data: time })
      lrc.play(time)
    })
  }
}

/**
 * 歌词高亮模式切换（true=逐字, false=逐行）。
 * 立即重建歌词引擎（不重新拉取歌词），并同步当前播放位置，保证切换后立即生效、
 * 切歌/跳转后逐字高亮不失效。同时同步桌面歌词窗口的逐字/逐行模式与设置。
 */
export const setLyricMode = (mode: boolean) => {
  // Luminous Harmonic: 高亮模式切换 — Lyric.setMode 内部已重建行字体并同步当前播放位置,
  // 不再外层重复 play (原实现 setTimeout 后再 lrc.play(time) 与 setMode 内建重建叠加,
  // 导致任务栏歌词引擎状态错乱 → 切换后停止播放, 必须调整进度才刷新)
  lrc.setMode(mode ? 'font' : 'line')
  // 桌面歌词窗口同步逐字/逐行
  sendDesktopLyricInfo({ action: 'set_lyric_mode', data: mode })
  void updateSetting({ 'desktopLyric.style.isZoomActiveLrc': mode })
}

export const setDisabledAutoPause = (disabledAutoPause: boolean) => {
  lrc.setDisabledAutoPause(disabledAutoPause)
}

let sources = new Map<string, boolean>()
let prevDisabled = false
export const setDisableAutoPauseBySource = (disabled: boolean, source: string) => {
  sources.set(source, disabled)
  const currentDisabled = Array.from(sources.values()).some(e => e)
  if (prevDisabled == currentDisabled) return
  prevDisabled = currentDisabled
  setDisabledAutoPause(currentDisabled)
}


export const play = (time?: number) => {
  // if (!musicInfo.lrc) return
  // 歌词引擎内部按毫秒（lines[].time 为毫秒）；传入的 time 为秒，需转毫秒，
  // 否则 seek 后 _findCurLineNum 用秒比较毫秒永远命中第一行（歌词从第一个字开始）
  // Luminous Harmonic: 未显式传时间时优先取播放元素「实时」时间 —
  // 此前优先用 playProgress.nowPlayTime（store 残留值）, 播放完自动切歌时它是
  // 旧歌最后一次 timeupdate 的末尾时间, 新歌词会先跳到末尾再跳回开头 (乱跳)。
  // 播放元素的 currentTime 在任何切歌路径下都是准确的当前播放位置。
  const currentTimeMs = (time ?? getPlayerCurrentTime()) * 1000
  lrc.play(currentTimeMs)
  sendDesktopLyricInfo({ action: 'set_play', data: currentTimeMs })
}

export const pause = () => {
  lrc.pause()
  sendDesktopLyricInfo({ action: 'set_pause' })
}

export const stop = () => {
  lrc.setLyric('')
  sendDesktopLyricInfo({ action: 'set_stop' })
  // Clear the rendered lyric state together with the lyric engine so an open
  // detail page cannot keep displaying the previous song after a song switch.
  setLines([])
  setText('', 0)
}

export const sendInfo = () => {
  sendDesktopLyricInfo({
    action: 'set_info',
    data: {
      id: musicInfo.id,
      singer: musicInfo.singer,
      name: musicInfo.name,
      album: musicInfo.album,
      lrc: musicInfo.lrc,
      tlrc: musicInfo.tlrc,
      rlrc: musicInfo.rlrc,
      lxlrc: musicInfo.lxlrc,
      pic: musicInfo.pic,
      isPlay: isPlay.value,
      line: lyric.line,
      played_time: getCurrentTime() * 1000,
    },
  })
}
