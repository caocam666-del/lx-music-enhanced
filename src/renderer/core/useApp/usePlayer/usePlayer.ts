import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { setTitle } from '@renderer/utils'

import {
  getCurrentTime,
  getDuration,
  setPause, setStop,
  setSongTransition,
} from '@renderer/plugins/player'

import useMediaSessionInfo from './useMediaSessionInfo'
import usePlayProgress from './usePlayProgress'
import usePlayEvent from './usePlayEvent'

import {
  musicInfo,
  playMusicInfo,
  playedList,
} from '@renderer/store/player/state'
import {
  setPlay,
  setAllStatus,
  addPlayedList,
  clearPlayedList,
  // resetPlayerMusicInfo,
} from '@renderer/store/player/action'

import { appSetting } from '@renderer/store/setting'
import { isPlay, isPlayerError } from '@renderer/store/player/state'
import { PLAY_ERROR } from '@renderer/utils/message'

import useLyric from './useLyric'
import useVolume from './useVolume'
import useWatchList from './useWatchList'
import { HOTKEY_PLAYER } from '@common/hotKey'
import { playNext, pause, playPrev, togglePlay, collectMusic, uncollectMusic, dislikeMusic } from '@renderer/core/player'
import usePlaybackRate from './usePlaybackRate'
import useSoundEffect from './useSoundEffect'
import useMaxOutputChannelCount from './useMaxOutputChannelCount'
import { setPowerSaveBlocker } from '@renderer/core/player/utils'
import usePreloadNextMusic from './usePreloadNextMusic'


export default () => {
  const t = useI18n()

  usePlayProgress()
  useMediaSessionInfo()
  usePlayEvent()
  useLyric()
  useVolume()
  useMaxOutputChannelCount()
  useSoundEffect()
  usePlaybackRate()
  useWatchList()
  usePreloadNextMusic()

  const handlePlayNext = () => {
    void playNext()
  }
  const handlePlayPrev = () => {
    void playPrev()
  }

  const addPowerSaveBlocker = () => {
    setPowerSaveBlocker(true)
  }
  const removePowerSaveBlocker = () => {
    setPowerSaveBlocker(false)
  }

  const setPlayStatus = () => {
    setPlay(true)
  }
  const setPauseStatus = () => {
    setPlay(false)
    if (window.lx.isPlayedStop) pause()
    removePowerSaveBlocker()
  }

  const handleUpdatePlayInfo = () => {
    setTitle(musicInfo.id ? `${musicInfo.name} - ${musicInfo.singer}` : null)
  }

  const handleCanplay = () => {
    if (window.lx.isPlayedStop) {
      setPause()
    }
  }
  const handleEnded = () => {
    // setTimeout(() => {
    setAllStatus(t('player__end'))
    if (window.lx.isPlayedStop) {
      console.log('played stop')
      return
    }
    // resetPlayerMusicInfo()
    // window.app_event.stop()
    void playNext(true)
    // })
  }

  const handleSpaceTogglePlay = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if ((event.key != ' ' && event.code != 'Space') || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || window.lx.isEditingHotKey) return
    const isPlayerToggle = Boolean(target?.closest?.('[data-player-toggle]'))
    if (target && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || (target.tagName == 'BUTTON' && !isPlayerToggle))) return
    event.preventDefault()
    togglePlay()
  }

  const setProgress = (time: number) => {
    window.app_event.setProgress(time)
  }
  const handleSeekforward = () => {
    const seekOffset = 5
    const curTime = getCurrentTime()
    const time = Math.min(getCurrentTime() + seekOffset, getDuration())
    if (Math.trunc(curTime) == Math.trunc(time)) return
    setProgress(time)
  }
  const handleSeekbackward = () => {
    const seekOffset = 5
    const curTime = getCurrentTime()
    const time = Math.max(getCurrentTime() - seekOffset, 0)
    if (Math.trunc(curTime) == Math.trunc(time)) return
    setProgress(time)
  }

  const setStopStatus = () => {
    setPlay(false)
    setTitle(null)
    setAllStatus('')
    setStop()
    removePowerSaveBlocker()
  }

  // 切歌过渡模式同步到播放引擎 (复刻 pure-music 切歌过渡)
  watch(() => appSetting['player.songTransition'], newValue => {
    setSongTransition(newValue)
  }, { immediate: true })

  watch(() => appSetting['player.togglePlayMethod'], newValue => {
    // setLoopPlay(newValue == 'singleLoop')
    if (playedList.length) clearPlayedList()
    if (newValue == 'random' && playMusicInfo.musicInfo && !playMusicInfo.isTempPlay) addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })
  })

  // setLoopPlay(appSetting['player.togglePlayMethod'] == 'singleLoop')


  window.key_event.on(HOTKEY_PLAYER.next.action, handlePlayNext)
  window.key_event.on(HOTKEY_PLAYER.prev.action, handlePlayPrev)
  window.key_event.on(HOTKEY_PLAYER.toggle_play.action, togglePlay)
  window.key_event.on(HOTKEY_PLAYER.music_love.action, collectMusic)
  window.key_event.on(HOTKEY_PLAYER.music_unlove.action, uncollectMusic)
  window.key_event.on(HOTKEY_PLAYER.music_dislike.action, dislikeMusic)
  window.key_event.on(HOTKEY_PLAYER.seekbackward.action, handleSeekbackward)
  window.key_event.on(HOTKEY_PLAYER.seekforward.action, handleSeekforward)
  window.addEventListener('keydown', handleSpaceTogglePlay)

  window.app_event.on('play', setPlayStatus)
  window.app_event.on('pause', setPauseStatus)
  // Luminous Harmonic: 播放失败自动切歌规则（与换源时限规则配合）——
  //   · 只有「本首歌确实放不了」（换源预算耗尽 / 所有音源失败）才计入连续失败
  //   · 服务器繁忙 / 断网 / 单源超时属非致命错误, 不在计数范围内（已由取URL层做有限重试）
  //   · 连续失败达到 player.maxConsecutiveFailures（默认3）即停止, 避免整列表被跳过
  //   · 任一音频真正播放成功（onPlaying）即清零
  let consecutivePlayErrors = 0
  const resetPlayErrorCount = () => { consecutivePlayErrors = 0 }
  window.app_event.on('error', (errCode?: number, kind?: string) => {
    setPauseStatus()
    // 非致命（服务器繁忙/断网/单源超时）与用户主动中断：不计入连续失败, 也不触发跳过
    if (kind === PLAY_ERROR.none || kind === PLAY_ERROR.transient || errCode === 1) {
      console.log('[播放失败] 非致命, 不计入跳过计数:', kind, errCode)
      return
    }
    const maxFailures = Math.max(1, appSetting['player.maxConsecutiveFailures'] ?? 3)
    consecutivePlayErrors++
    console.log(`[播放失败] 连续第 ${consecutivePlayErrors}/${maxFailures} 首 (${kind ?? 'unknown'})`)
    if (consecutivePlayErrors > maxFailures) {
      setAllStatus(t('player__error_skip_stopped'))
      return
    }
    if (window.lx.isPlayedStop) return
    // 自动切歌要保守：等一会儿，并且要求"确实仍处于错误态"。
    // 之前只看 600ms 后 !isPlay 就切 —— 双击同一首时 src 竞争会短暂让 isPlay 为 false，
    // 于是明明能播也被跳掉（用户反馈"双击后秒换下一首，再点一次就好"）。
    const failedMusicId = musicInfo.id
    setTimeout(() => {
      if (isPlay.value) return
      if (!isPlayerError.value) return // 已经自己恢复了（加载成功/被用户重新播放）
      if (musicInfo.id !== failedMusicId) return // 期间已经换了别的歌
      void playNext(true)
    }, 1500)
  })
  // 真正出声即视为成功（onPlaying 才会触发 app_event.play）
  window.app_event.on('play', resetPlayErrorCount)
  // 停止（含用户手动切歌）视为用户接管, 计数清零
  window.app_event.on('stop', resetPlayErrorCount)
  window.app_event.on('stop', setStopStatus)
  window.app_event.on('musicToggled', handleUpdatePlayInfo)
  window.app_event.on('playerCanplay', handleCanplay)
  window.app_event.on('playerPlaying', addPowerSaveBlocker)
  window.app_event.on('playerEmptied', removePowerSaveBlocker)

  window.app_event.on('playerEnded', handleEnded)


  onBeforeUnmount(() => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
    window.key_event.off(HOTKEY_PLAYER.next.action, handlePlayNext)
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    window.key_event.off(HOTKEY_PLAYER.prev.action, handlePlayPrev)
    window.key_event.off(HOTKEY_PLAYER.toggle_play.action, togglePlay)
    window.key_event.off(HOTKEY_PLAYER.music_love.action, collectMusic)
    window.key_event.off(HOTKEY_PLAYER.music_unlove.action, uncollectMusic)
    window.key_event.off(HOTKEY_PLAYER.music_dislike.action, dislikeMusic)
    window.key_event.off(HOTKEY_PLAYER.seekbackward.action, handleSeekbackward)
    window.key_event.off(HOTKEY_PLAYER.seekforward.action, handleSeekforward)
    window.removeEventListener('keydown', handleSpaceTogglePlay)


    window.app_event.off('play', setPlayStatus)
    window.app_event.off('pause', setPauseStatus)
    window.app_event.off('error', setPauseStatus)
    window.app_event.off('stop', setStopStatus)
    window.app_event.off('musicToggled', handleUpdatePlayInfo)
    window.app_event.off('playerPlaying', addPowerSaveBlocker)
    window.app_event.off('playerEmptied', removePowerSaveBlocker)
    window.app_event.off('playerCanplay', handleCanplay)

    window.app_event.off('playerEnded', handleEnded)
  })
}
