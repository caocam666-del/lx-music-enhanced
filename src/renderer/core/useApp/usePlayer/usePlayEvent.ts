import { onBeforeUnmount } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { setStop, isEmpty } from '@renderer/plugins/player'
import { playNext, setMusicUrl } from '@renderer/core/player'
import { setAllStatus, setPlayerError } from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { getUserApiIds, switchUserApiSource } from '@renderer/core/apiSource'

export default () => {
  const t = useI18n()
  let retryNum = 0
  let sourceRetryMusicId: string | null = null
  const sourceRetryIds = new Set<string>()
  let sourceSwitching = false
  let prevTimeoutId: string | null = null

  let loadingTimeout: NodeJS.Timeout | null = null
  let delayNextTimeout: NodeJS.Timeout | null = null
  const startLoadingTimeout = () => {
    // console.log('start load timeout')
    clearLoadingTimeout()
    loadingTimeout = setTimeout(() => {
      if (window.lx.isPlayedStop) {
        prevTimeoutId = null
        setAllStatus('')
        return
      }

      // 如果加载超时，则尝试刷新URL
      if (prevTimeoutId == musicInfo.id) {
        prevTimeoutId = null
        void playNext(true)
      } else {
        prevTimeoutId = musicInfo.id
        if (playMusicInfo.musicInfo) setMusicUrl(playMusicInfo.musicInfo, true)
      }
    }, 25000)
  }
  const clearLoadingTimeout = () => {
    if (!loadingTimeout) return
    // console.log('clear load timeout')
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  const clearDelayNextTimeout = () => {
    // console.log(this.delayNextTimeout)
    if (!delayNextTimeout) return
    clearTimeout(delayNextTimeout)
    delayNextTimeout = null
  }
  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    delayNextTimeout = setTimeout(() => {
      if (window.lx.isPlayedStop) {
        setAllStatus('')
        return
      }
      void playNext(true)
    }, 5000)
  }

  const handleLoadstart = () => {
    if (window.lx.isPlayedStop) return
    clearDelayNextTimeout()
    setPlayerError(false)
    if (appSetting['player.autoSkipOnError']) startLoadingTimeout()
    setAllStatus(t('player__loading'))
  }

  const handleLoadeddata = () => {
    setPlayerError(false)
    setAllStatus(t('player__loading'))
  }

  const handlePlaying = () => {
    setPlayerError(false)
    setAllStatus('')
    clearLoadingTimeout()
  }

  const handleEmpied = () => {
    setPlayerError(false)
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  const handleWating = () => {
    setPlayerError(false)
    setAllStatus(t('player__buffering'))
  }

  const handleError = (errCode?: number) => {
    if (!musicInfo.id) return
    clearLoadingTimeout()
    if (window.lx.isPlayedStop) return
    if (!isEmpty()) setStop()
    const customSourceIds = getUserApiIds()
    if (appSetting['player.autoSwitchSourceOnError'] && errCode !== 1 && playMusicInfo.musicInfo && customSourceIds.length && !sourceSwitching) {
      const targetMusicInfo = playMusicInfo.musicInfo
      const musicId = targetMusicInfo.id
      if (sourceRetryMusicId !== musicId) {
        sourceRetryMusicId = musicId
        sourceRetryIds.clear()
      }
      const currentSource = appSetting['common.apiSource']
      sourceRetryIds.add(currentSource)
      sourceSwitching = true
      void (async() => {
        try {
          const sourceIds = getUserApiIds().filter(id => id !== currentSource && !sourceRetryIds.has(id))
          let switched = false
          for (const sourceId of sourceIds) {
            sourceRetryIds.add(sourceId)
            setAllStatus(`${t('toggle_source_try')} (${sourceRetryIds.size}/${customSourceIds.length})`)
            if (await switchUserApiSource(sourceId)) {
              sourceSwitching = false
              setPlayerError(false)
              setMusicUrl(targetMusicInfo, true, true)
              switched = true
              break
            }
          }
          if (switched) return
          setPlayerError(true)
          if (appSetting['player.autoSkipOnError']) {
            if (document.hidden) {
              console.warn('all custom sources failed, skip to next')
              void playNext(true)
            } else {
              setAllStatus('所有自定义源均无法播放，5 秒后切换下一首')
              addDelayNextTimeout()
            }
          } else {
            setAllStatus(t('player__error'))
          }
        } finally {
          sourceSwitching = false
        }
      })()
      return
    }
    if (playMusicInfo.musicInfo && errCode !== 1 && retryNum < 2) { // 若音频URL无效则尝试刷新2次URL
      // console.log(this.retryNum)
      retryNum++
      setPlayerError(false)
      setMusicUrl(playMusicInfo.musicInfo, true)
      setAllStatus(t('player__refresh_url'))
      return
    }

    setPlayerError(true)
    setAllStatus(t('player__error'))
    if (appSetting['player.autoSkipOnError']) {
      if (document.hidden) {
        console.warn('error skip to next')
        void playNext(true)
      } else {
        setTimeout(addDelayNextTimeout)
      }
    }
  }

  const handleRetry = () => {
    if (!playMusicInfo.musicInfo) return
    clearDelayNextTimeout()
    clearLoadingTimeout()
    retryNum = 0
    sourceRetryMusicId = null
    sourceRetryIds.clear()
    sourceSwitching = false
    setPlayerError(false)
    setAllStatus(t('player__refresh_url'))
    setMusicUrl(playMusicInfo.musicInfo, true, true)
  }

  const handleSetPlayInfo = () => {
    setPlayerError(false)
    retryNum = 0
    sourceRetryMusicId = null
    sourceRetryIds.clear()
    sourceSwitching = false
    prevTimeoutId = null
    clearDelayNextTimeout()
    clearLoadingTimeout()
  }

  // const handlePlayedStop = () => {
  //   clearDelayNextTimeout()
  //   clearLoadingTimeout()
  // }


  window.app_event.on('playerLoadstart', handleLoadstart)
  window.app_event.on('playerLoadeddata', handleLoadeddata)
  window.app_event.on('playerPlaying', handlePlaying)
  window.app_event.on('playerWaiting', handleWating)
  window.app_event.on('playerEmptied', handleEmpied)
  window.app_event.on('playerError', handleError)
  window.app_event.on('playerRetry', handleRetry)
  window.app_event.on('musicToggled', handleSetPlayInfo)

  onBeforeUnmount(() => {
    window.app_event.off('playerLoadstart', handleLoadstart)
    window.app_event.off('playerLoadeddata', handleLoadeddata)
    window.app_event.off('playerPlaying', handlePlaying)
    window.app_event.off('playerWaiting', handleWating)
    window.app_event.off('playerEmptied', handleEmpied)
    window.app_event.off('playerError', handleError)
    window.app_event.off('playerRetry', handleRetry)
    window.app_event.off('musicToggled', handleSetPlayInfo)
  })
}
