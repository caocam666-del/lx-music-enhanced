import { onProvideMainWindowChannel } from '@lyric/utils/ipc'
import { onBeforeUnmount } from '@common/utils/vueTools'
import { setMusicInfo, setIsPlay } from '../store/action'
import { setDetailColors, setLyricLines } from '../store/detailColors'
import { syncTime, setRunning, setRate as setProgressRate, reset as resetProgress } from '../store/progress'
import { pause, play, setLyric, setLyricOffset, setPlaybackRate, setLyricMode, stop } from './lyric'
import { lyrics } from '@lyric/store/lyric'

let mainWindowPort: Electron.IpcRendererEvent['ports'][0] | null = null
export const sendDesktopLyricInfo = (info: LX.DesktopLyric.WinMainActions) => {
  if (mainWindowPort == null) return
  mainWindowPort.postMessage({ action: info })
}

export const sendPlayerAction = (action: LX.DesktopLyric.PlayerAction, data?: unknown) => {
  sendDesktopLyricInfo({ action: 'player_action', data: { action, data } })
}

const listeners: Array<(event: LX.DesktopLyric.LyricActions) => void> = []

const handleDesktopLyricMessage = (event: LX.DesktopLyric.LyricActions) => {
  switch (event.action) {
    case 'set_info':
      setMusicInfo({
        id: event.data.id,
        singer: event.data.singer,
        name: event.data.name,
        album: event.data.album,
        pic: event.data.pic,
      })
      lyrics.lyric = event.data.lrc ?? ''
      lyrics.tlyric = event.data.tlrc
      lyrics.rlyric = event.data.rlrc
      lyrics.lxlyric = event.data.lxlrc
      // Luminous Harmonic: 进度一律走本地时钟（单位毫秒，与主窗 played_time/max_time 一致）
      setDetailColors({
        accent: event.data.accent,
        fontBright: event.data.font_bright,
        lyricShadow: event.data.lyric_shadow,
      })
      setLyricLines(event.data.lines)
      syncTime(event.data.played_time, event.data.max_time)
      setRunning(Boolean(event.data.isPlay))
      setLyric()
      if (event.data.isPlay) {
        setImmediate(() => {
          getStatus()
        })
      }
      break
    case 'set_lyric':
      lyrics.lyric = event.data.lrc ?? ''
      lyrics.tlyric = event.data.tlrc
      lyrics.rlyric = event.data.rlrc
      lyrics.lxlyric = event.data.lxlrc
      setLyric()
      break
    case 'set_lyric_mode':
      setLyricMode(event.data)
      break
    case 'set_status':
      setIsPlay(event.data.isPlay)
      // 主窗推来的真实位置用于纠偏本地时钟（换行/seek/换歌后）
      syncTime(event.data.played_time, event.data.max_time)
      setRunning(Boolean(event.data.isPlay))
      if (event.data.isPlay) play(event.data.played_time)
      else pause()
      break
    case 'set_offset':
      setLyricOffset(event.data)
      break
    case 'set_playbackRate':
      setPlaybackRate(event.data)
      setProgressRate(event.data)
      break
    case 'set_pause':
      setIsPlay(false)
      setRunning(false)
      pause()
      break
    case 'set_play': {
      // 兼容两种载荷：裸毫秒（旧）与 { time, max_time }（新，歌词窗进度条需要总时长）
      const payload = event.data
      const time = typeof payload == 'number' ? payload : payload?.time
      const maxTime = typeof payload == 'number' ? undefined : payload?.max_time
      setIsPlay(true)
      play(time)
      syncTime(time, maxTime)
      setRunning(true)
      break
    }
    case 'set_stop':
      setIsPlay(false)
      resetProgress()
      stop()
      break
    default:
      for (const listener of listeners) {
        listener(event)
      }
      break
  }
}

export const init = () => {
  onProvideMainWindowChannel(({ event }) => {
    const [port] = event.ports
    mainWindowPort = port

    // ... register a handler to receive results ...
    port.onmessage = ({ data }) => {
      handleDesktopLyricMessage(data)
      // console.log('received result:', data)
    }
    // ... and start sending it work!

    port.onmessageerror = (event) => {
      console.log('onmessageerror', event)
    }

    getInfo()
  })
}

export const useEvent = (listener: (event: LX.DesktopLyric.LyricActions) => void) => {
  listeners.push(listener)

  onBeforeUnmount(() => {
    listeners.splice(listeners.indexOf(listener), 1)
  })
}

export const getInfo = () => {
  sendDesktopLyricInfo('get_info')
}

export const getAnalyserDataArray = () => {
  sendDesktopLyricInfo('get_analyser_data_array')
}

export const getStatus = () => {
  sendDesktopLyricInfo('get_status')
}
