/**
 * Luminous Harmonic: 设置键注册表
 *
 * 用途：设置页的「已修改 N 项 / 全部恢复」提示条需要知道**每个分类/每个组件**涉及哪些设置键。
 * 集中在这里而不是散落在各组件里，好处是：
 *   1) 分类条与组件条共用同一份清单，不会出现"两处不一致"
 *   2) 新增设置项时只改一个地方
 *
 * 注意：只登记「用户可改」的键；派生/运行时键（如 desktopLyric.x/y 位置）不登记，
 * 否则拖动一下歌词窗就会让提示条出现。
 */
type Key = keyof LX.AppSetting

const general: Key[] = [
  'common.isShowAnimation',
  'common.randomAnimate',
  'common.startInFullscreen',
  'common.langId',
  'common.sourceNameType',
  'tray.enable',
  'tray.themeId',
]

const appearance: Key[] = [
  'theme.lightId',
  'theme.darkId',
  'common.windowSizeId',
  'common.fontSize',
  'common.font',
  'common.controlBtnPosition',
  'common.playBarProgressStyle',
  'common.playBarWave',
  'common.playBarVisualization',
  'common.transparentWindow',
]

const play: Key[] = [
  'common.apiSource',
  'player.startupAutoPlay',
  'player.powerSaveBlocker',
  'player.isSavePlayTime',
  'player.isAutoCleanPlayedList',
  'player.isShowLyricTranslation',
  'player.isShowLyricRoma',
  'player.isSwapLyricTranslationAndRoma',
  'player.autoSkipOnError',
  'player.autoSwitchSourceOnError',
  'player.sourceSwitch.sourceTimeout',
  'player.sourceSwitch.totalBudget',
  'player.maxConsecutiveFailures',
  'player.isS2t',
  'player.isPlayLxlrc',
  'player.isShowTaskProgess',
  'player.isShowStatusBarLyric',
  'player.playQuality',
  'player.songTransition',
  'player.isMaxOutputChannelCount',
  'player.isMediaDeviceRemovedStopPlay',
  'player.audioVisualization',
  'playDetail.backgroundMode',
  'playDetail.flowMode',
  'playDetail.isShowArtworkCenter',
  'playDetail.style.align',
  'playDetail.style.fontSize',
  'playDetail.style.lrcFontMode',
]

const desktopLyric: Key[] = [
  'desktopLyric.enable',
  'desktopLyric.mode',
  'desktopLyric.island.autoWidth',
  'desktopLyric.island.width',
  'desktopLyric.island.height',
  'desktopLyric.island.dock',
  'desktopLyric.island.margin',
  'desktopLyric.island.expandWidth',
  'desktopLyric.island.expandHeight',
  'desktopLyric.island.expandTrigger',
  'desktopLyric.island.hoverDelay',
  'desktopLyric.island.leaveDelay',
  'desktopLyric.island.lyricLines',
  'desktopLyric.island.flowStrength',
  'desktopLyric.island.opacity',
  'desktopLyric.island.flowMode',
  'desktopLyric.island.colorSource',
  'desktopLyric.island.lyricFontSize',
  'desktopLyric.island.showCover',
  'desktopLyric.island.lyricAlign',
  'desktopLyric.direction',
  'desktopLyric.isLock',
  'desktopLyric.taskbarInteractive',
  'desktopLyric.isAlwaysOnTop',
  'desktopLyric.isAlwaysOnTopLoop',
  'desktopLyric.isShowTaskbar',
  'desktopLyric.fullscreenHide',
  'desktopLyric.pauseHide',
  'desktopLyric.isHoverHide',
  'desktopLyric.isLockScreen',
  'desktopLyric.isDelayScroll',
  'desktopLyric.scrollAlign',
  'desktopLyric.audioVisualization',
  'desktopLyric.audioVisualizationStyle',
  'desktopLyric.style.align',
  'desktopLyric.style.font',
  'desktopLyric.style.fontSize',
  'desktopLyric.style.lineGap',
  'desktopLyric.style.opacity',
  'desktopLyric.style.ellipsis',
  'desktopLyric.style.colorFollowDetail',
  'desktopLyric.style.lyricUnplayColor',
  'desktopLyric.style.lyricPlayedColor',
  'desktopLyric.style.lyricShadowColor',
  'desktopLyric.style.isZoomActiveLrc',
]

const searchList: Key[] = [
  'search.isFocusSearchBox',
  'search.isShowHistorySearch',
  'search.isShowHotSearch',
  'list.actionButtonsVisible',
  'list.addMusicLocationType',
  'list.isClickPlayList',
  'list.isSaveScrollLocation',
  'list.isShowSource',
]

const download: Key[] = [
  'download.enable',
  'download.savePath',
  'download.fileName',
  'download.maxDownloadNum',
  'download.skipExistFile',
  'download.isUseOtherSource',
  'download.isDownloadLrc',
  'download.lrcFormat',
  'download.isDownloadTLrc',
  'download.isDownloadLxLrc',
  'download.isDownloadRLrc',
  'download.isEmbedLyric',
  'download.isEmbedLyricLx',
  'download.isEmbedLyricT',
  'download.isEmbedLyricR',
  'download.isEmbedPic',
  'download.isSavePathGroupByListName',
]

const service: Key[] = [
  'sync.enable',
  'sync.mode',
  'sync.server.port',
  'sync.client.host',
  'openAPI.enable',
  'openAPI.port',
  'network.proxy.enable',
  'network.proxy.host',
  'network.proxy.port',
]

/** 组件名 → 该组件涉及设置键（组件内按项判断「是否已改动」时用） */
export const SETTING_KEYS_BY_COMPONENT: Record<string, Key[]> = {
  SettingGeneral: general,
  SettingAppearance: appearance,
  SettingPlay: play,
  SettingPlayDetail: play,
  SettingDesktopLyric: desktopLyric,
  SettingSearch: searchList,
  SettingList: searchList,
  SettingDownload: download,
  SettingSync: service,
  SettingOpenAPI: service,
  SettingNetwork: service,
}
