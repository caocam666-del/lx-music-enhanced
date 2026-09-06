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
  window.app_event.on('error', setPauseStatus)
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
