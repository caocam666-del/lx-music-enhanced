import { onBeforeUnmount } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { musicInfo, playMusicInfo } from '@renderer/store/player/state'
import { setStop, isEmpty, getMsSinceResourceChange } from '@renderer/plugins/player'
import { playNext, setMusicUrl } from '@renderer/core/player'
import { setAllStatus, setPlayerError } from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { PLAY_ERROR, requestMsg } from '@renderer/utils/message'
import { getUserApiIds, switchUserApiSource } from '@renderer/core/apiSource'

export default () => {
  const t = useI18n()
  let retryNum = 0
  let sourceRetryMusicId: string | null = null
  const sourceRetryIds = new Set<string>()
  let sourceSwitching = false
  let prevTimeoutId: string | null = null
  // Luminous Harmonic: 「取URL阶段已判定本首歌放不了」的标记 —
  // 由 action.ts 的 setMusicUrl 失败路径写入 window.lx.urlExhaustedId,
  // handleError 读到后按 fatalUrl 上报（计入连续失败并按规则跳过）
  const isUrlExhausted = () => window.lx.urlExhaustedId != null && window.lx.urlExhaustedId == musicInfo.id
  const clearUrlExhausted = () => { window.lx.urlExhaustedId = null }

  let loadingTimeout: NodeJS.Timeout | null = null
  let delayNextTimeout: NodeJS.Timeout | null = null
  // 音频加载一级超时：先刷新一次 URL
  const getLoadTimeoutMs = () => Math.max(5000, (appSetting['player.loadTimeout'] ?? 25) * 1000)

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
    }, getLoadTimeoutMs())
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
    /**
     * 换源抖动期：刚替换 / 清空 src 的短暂时间里，Chromium 会对旧资源抛一次瞬时 error
     * （此时 audio.error 通常是 null 或 code=1 ABORTED）。
     *
     * 双击列表里的歌会连续两次替换 src —— 这条瞬时错误以前会被当成"这首歌唱不了"，
     * 于是几百毫秒后自动切下一首（用户反馈"双击后秒换下一首，再点一次又能播"）。
     *
     * 注意只屏蔽"换源抖动"这一类：真正加载失败会带 code 3/4（解码/格式不支持），
     * 那种要继续走换源与跳过逻辑，不能被吞掉。
     */
    if (getMsSinceResourceChange() < 600 && (errCode == null || errCode === 1)) return
    if (!isEmpty()) setStop()
    // 取URL阶段已判定「本首歌放不了」（换源预算耗尽/全部音源失败）：
    // 重试与再换源都无意义, 按 fatalUrl 上报 → 计入连续失败并按规则跳过
    if (isUrlExhausted()) {
      clearUrlExhausted()
      retryNum = 0
      setPlayerError(true)
      setAllStatus(requestMsg.sourceExhausted)
      window.app_event.error(errCode, PLAY_ERROR.fatalUrl)
      if (appSetting['player.autoSkipOnError']) {
        if (document.hidden) {
          void playNext(true)
        } else {
          addDelayNextTimeout()
        }
      }
      return
    }
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

    // 音频本身加载/解码失败且 URL 刷新已用尽 → fatalAudio：计入连续失败并按规则跳过
    setPlayerError(true)
    setAllStatus(requestMsg.audioLoadFailed)
    window.app_event.error(errCode, PLAY_ERROR.fatalAudio)
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
    clearUrlExhausted()
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
