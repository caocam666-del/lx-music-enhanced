import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { debounce } from '@common/utils/common'
// import { setDesktopLyricInfo, onGetDesktopLyricInfo } from '@renderer/utils/ipc'
// import { musicInfo } from '@renderer/store/player/state'
import {
  pause,
  play,
  setLyric,
  stop,
  init,
  sendInfo,
  setPlaybackRate,
  syncPlayPosition,
} from '@renderer/core/lyric'
import { appSetting } from '@renderer/store/setting'
import { isPlay } from '@renderer/store/player/state'

const handleApplyPlaybackRate = debounce(setPlaybackRate, 300)

export default () => {
  init()

  const setPlayInfo = () => {
    stop()
    sendInfo()
  }

  // Luminous Harmonic: 播放真正开始时(而非切歌瞬间)同步歌词 — 自动切歌时
  // setLyric 执行于 stop() 之后/新歌 play 事件之前, 那一刻既非 isPlay 也非
  // 音频播放中, 时间源也不可靠; 等 isPlay 变 true (新歌已实际开始播放)
  // 再同步一次, 用真实 currentTime 定位, 这是自动切歌歌词跟随的可靠保证.
  watch(isPlay, (playing) => {
    if (playing) play()
  })

  watch(() => appSetting['player.isShowLyricTranslation'], setLyric)
  watch(() => appSetting['player.isShowLyricRoma'], setLyric)
  watch(() => appSetting['player.isSwapLyricTranslationAndRoma'], setLyric)
  watch(() => appSetting['player.isPlayLxlrc'], setLyric)

  // Luminous Harmonic: 新歌就绪/开始播放时按真实位置再同步一次 — 此时
  // audio.currentTime 必然属于新音源, 是换曲歌词定位最可靠的时点
  window.app_event.on('playerLoadeddata', syncPlayPosition)
  window.app_event.on('playerCanplay', syncPlayPosition)
  window.app_event.on('playerPlaying', syncPlayPosition)
  window.app_event.on('play', play)
  window.app_event.on('pause', pause)
  window.app_event.on('stop', stop)
  window.app_event.on('error', pause)
  window.app_event.on('musicToggled', setPlayInfo)
  window.app_event.on('lyricUpdated', setLyric)
  window.app_event.on('setPlaybackRate', handleApplyPlaybackRate)

  onBeforeUnmount(() => {
    window.app_event.off('playerLoadeddata', syncPlayPosition)
    window.app_event.off('playerCanplay', syncPlayPosition)
    window.app_event.off('playerPlaying', syncPlayPosition)
    window.app_event.off('play', play)
    window.app_event.off('pause', pause)
    window.app_event.off('stop', stop)
    window.app_event.off('error', pause)
    window.app_event.off('musicToggled', setPlayInfo)
    window.app_event.off('lyricUpdated', setLyric)
    window.app_event.off('setPlaybackRate', handleApplyPlaybackRate)
  })
}
