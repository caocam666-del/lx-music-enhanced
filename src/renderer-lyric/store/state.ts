import { ref, reactive, shallowReactive } from '@common/utils/vueTools'

export const setting = shallowReactive<LX.DesktopLyric.Config>({
  'desktopLyric.enable': false,
  'desktopLyric.isLock': false,
  'desktopLyric.taskbarInteractive': false,
  'desktopLyric.isAlwaysOnTop': false,
  'desktopLyric.isAlwaysOnTopLoop': false,
  'desktopLyric.isShowTaskbar': true,
  'desktopLyric.pauseHide': false,
  'desktopLyric.audioVisualization': false,
  'desktopLyric.audioVisualizationStyle': 'wave',
  'desktopLyric.width': 660,
  'desktopLyric.height': 300,
  'desktopLyric.x': null,
  'desktopLyric.y': null,
  'desktopLyric.isLockScreen': true,
  'desktopLyric.isDelayScroll': true,
  'desktopLyric.scrollAlign': 'center',
  'desktopLyric.isHoverHide': false,
  'desktopLyric.direction': 'horizontal',
  'desktopLyric.mode': 'normal',
  // Luminous Harmonic: 灵动岛（收起态胶囊 + 展开态播放卡）
  'desktopLyric.island.autoWidth': true,
  'desktopLyric.island.width': 320,
  'desktopLyric.island.height': 44,
  'desktopLyric.island.dock': 'top',
  'desktopLyric.island.margin': 16,
  'desktopLyric.island.expandWidth': 460,
  'desktopLyric.island.expandHeight': 200,
  'desktopLyric.island.expandTrigger': 'hover',
  'desktopLyric.island.hoverDelay': 120,
  'desktopLyric.island.leaveDelay': 900,
  'desktopLyric.island.lyricLines': 3,
  'desktopLyric.island.flowStrength': 100,
  'desktopLyric.island.opacity': 100,
  'desktopLyric.island.flowMode': 'dynamic',
  'desktopLyric.island.colorSource': 'detail',
  'desktopLyric.island.lyricFontSize': 15,
  'desktopLyric.island.showCover': true,
  'desktopLyric.island.lyricAlign': 'left',
  'common.playBarWave': true,
  'desktopLyric.style.align': 'center',
  'desktopLyric.style.colorFollowDetail': true,
  'desktopLyric.style.lyricUnplayColor': 'rgba(255, 255, 255, 1)',
  'desktopLyric.style.lyricPlayedColor': 'rgba(7, 197, 86, 1)',
  'desktopLyric.style.lyricShadowColor': 'rgba(0, 0, 0, 0.14)',
  'desktopLyric.style.font': '',
  'desktopLyric.style.fontSize': 20,
  'desktopLyric.style.lineGap': 15,
  // 'desktopLyric.style.fontWeight': true,
  'desktopLyric.style.opacity': 95,
  'desktopLyric.style.ellipsis': false,
  'desktopLyric.style.isFontWeightFont': false,
  'desktopLyric.style.isFontWeightLine': false,
  'desktopLyric.style.isFontWeightExtended': false,
  'desktopLyric.style.isZoomActiveLrc': true,
  'common.langId': 'zh-cn',
  'player.isShowLyricTranslation': false,
  'player.isShowLyricRoma': false,
  'player.isSwapLyricTranslationAndRoma': false,
  'player.isPlayLxlrc': false,
  'player.playbackRate': 1,
})

// export const themeList = markRaw([
//   {
//     id: 0,
//     className: 'green',
//   },
//   {
//     id: 1,
//     className: 'yellow',
//   },
//   {
//     id: 2,
//     className: 'blue',
//   },
//   {
//     id: 3,
//     className: 'red',
//   },
//   {
//     id: 4,
//     className: 'pink',
//   },
//   {
//     id: 5,
//     className: 'purple',
//   },
//   {
//     id: 6,
//     className: 'orange',
//   },
//   {
//     id: 7,
//     className: 'grey',
//   },
//   {
//     id: 8,
//     className: 'ming',
//   },
//   {
//     id: 9,
//     className: 'blue2',
//   },
// ])

// export type Status = 'playing' | 'paused' | 'stopped'

// export const status = ref<Status>('stopped')
export const isPlay = ref(false)

/**
 * Luminous Harmonic: 播放进度（灵动岛展开态进度条用）。
 * 主窗通过 set_info / set_status 推过来，歌词窗自己不做计时。
 */
export const playProgress = reactive({
  nowPlayTime: 0,
  maxPlayTime: 0,
  progress: 0,
})

export const setProgress = (currentTime: number, totalTime?: number) => {
  playProgress.nowPlayTime = Math.max(0, currentTime || 0)
  if (totalTime != null && totalTime > 0) playProgress.maxPlayTime = totalTime
  playProgress.progress = playProgress.maxPlayTime
    ? Math.max(0, Math.min(1, playProgress.nowPlayTime / playProgress.maxPlayTime))
    : 0
}

export const musicInfo = shallowReactive<{
  id: string | null
  name: string
  singer: string
  album: string | null
  pic: string | null
}>({
  id: null,
  name: '^',
  singer: '^',
  album: null,
  pic: null,
})
