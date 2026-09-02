import path from 'node:path'
import os from 'node:os'

const isMac = process.platform == 'darwin'
const isWin = process.platform == 'win32'

const defaultSetting: LX.AppSetting = {
  version: '2.1.0',

  'common.windowSizeId': 3,
  'common.fontSize': 16,
  'common.startInFullscreen': false,
  'common.langId': null,
  'common.apiSource': 'temp',
  'common.sourceNameType': 'alias',
  'common.font': '',
  'common.isShowAnimation': true,
  'common.randomAnimate': true,
  'common.isAgreePact': false,
  'common.controlBtnPosition': isMac ? 'left' : 'right',
  // Luminous Harmonic: 侧栏折叠态 (220px ↔ 72px 图标模式), 由侧栏上的切换按钮控制
  'common.asideCollapsed': false,
  'common.playBarProgressStyle': 'full', // Luminous Harmonic: 横跨整个底部 (Spotify 风)
  // Luminous Harmonic: 播放栏波浪进度条 (full/mini 使用与 middle 同款 SVG 正弦波; 关闭时 full 用 canvas 波形、mini 用胶囊条)
  'common.playBarWave': true,
  // Luminous Harmonic: 播放栏背景音频律动可视化 (主播放栏胶囊内的频谱背景)
  'common.playBarVisualization': true,
  'common.transparentWindow': !isMac,
  'common.tryAutoUpdate': true,
  'common.showChangeLog': true,

  'player.startupAutoPlay': false,
  'player.togglePlayMethod': 'listLoop',
  'player.playQuality': '128k',
  'player.isShowTaskProgess': true,
  'player.isShowStatusBarLyric': false,
  'player.volume': 1,
  'player.powerSaveBlocker': true,
  'player.isMute': false,
  'player.playbackRate': 1,
  'player.preservesPitch': true,
  'player.isMaxOutputChannelCount': false,
  'player.mediaDeviceId': 'default',
  'player.isMediaDeviceRemovedStopPlay': false,
  'player.isShowLyricTranslation': false,
  'player.isShowLyricRoma': false,
  'player.isSwapLyricTranslationAndRoma': false,
  'player.isS2t': false,
  'player.isPlayLxlrc': !isMac,
  'player.isSavePlayTime': false,
  'player.audioVisualization': false,
  'player.waitPlayEndStop': true,
  'player.waitPlayEndStopTime': '',
  'player.autoSkipOnError': true,
  'player.autoSwitchSourceOnError': false,
  'player.isAutoCleanPlayedList': false,
  'player.soundEffect.convolution.fileName': '',
  'player.soundEffect.convolution.mainGain': 10,
  'player.soundEffect.convolution.sendGain': 0,
  'player.soundEffect.biquadFilter.hz31': 0,
  'player.soundEffect.biquadFilter.hz62': 0,
  'player.soundEffect.biquadFilter.hz125': 0,
  'player.soundEffect.biquadFilter.hz250': 0,
  'player.soundEffect.biquadFilter.hz500': 0,
  'player.soundEffect.biquadFilter.hz1000': 0,
  'player.soundEffect.biquadFilter.hz2000': 0,
  'player.soundEffect.biquadFilter.hz4000': 0,
  'player.soundEffect.biquadFilter.hz8000': 0,
  'player.soundEffect.biquadFilter.hz16000': 0,
  'player.soundEffect.panner.enable': false,
  'player.soundEffect.panner.soundR': 5,
  'player.soundEffect.panner.speed': 25,
  'player.soundEffect.pitchShifter.playbackRate': 1,

  'playDetail.isZoomActiveLrc': false,
  'playDetail.isShowLyricProgressSetting': false,
  // Luminous Harmonic: 歌词模糊化 — true=已播放/未播放歌词带上下渐隐+柔影效果, false=清晰去模糊
  'playDetail.isLyricBlur': true,
  'playDetail.style.fontSize': 140,
  'playDetail.style.align': 'center',
  // Luminous Harmonic: 歌词高亮模式 — true=逐字 (字级别渐变高亮), false=逐行 (整行变色)
  'playDetail.style.lrcFontMode': true,
  // Luminous Harmonic: 延迟歌词滚动 — 默认 false（Luminous 改为换行立即平滑滚动），开启后恢复 600ms 延迟
  'playDetail.isDelayScroll': false,
  // Luminous Harmonic: 黑胶中心圆点 (部分封面中心有主体, 可关掉避免遮挡)
  'playDetail.isShowArtworkCenter': true,
  'playDetail.backgroundMode': 'cover',

  'desktopLyric.enable': false,
  'desktopLyric.isLock': false,
  'desktopLyric.taskbarInteractive': false,
  'desktopLyric.isAlwaysOnTop': false,
  'desktopLyric.isAlwaysOnTopLoop': false,
  'desktopLyric.isShowTaskbar': false,
  'desktopLyric.audioVisualization': false,
  'desktopLyric.audioVisualizationStyle': 'wave',
  'desktopLyric.fullscreenHide': true,
  'desktopLyric.pauseHide': true,
  'desktopLyric.width': 450,
  'desktopLyric.height': 300,
  'desktopLyric.x': null,
  'desktopLyric.y': null,
  'desktopLyric.isLockScreen': isWin,
  'desktopLyric.isDelayScroll': true,
  'desktopLyric.scrollAlign': 'center',
  'desktopLyric.isHoverHide': false,
  'desktopLyric.direction': 'horizontal',
  // Luminous Harmonic: 歌词条模式（bar = 左下角胶囊条：左封面/歌名/歌手 + 右当前行/下一行）
  'desktopLyric.mode': 'normal',
  'desktopLyric.style.align': 'center',
  'desktopLyric.style.font': '',
  'desktopLyric.style.fontSize': 20,
  'desktopLyric.style.lineGap': 15,
  'desktopLyric.style.lyricUnplayColor': 'rgba(255, 255, 255, 1)',
  'desktopLyric.style.lyricPlayedColor': 'rgba(7, 197, 86, 1)',
  'desktopLyric.style.lyricShadowColor': 'rgba(0, 0, 0, 0.18)',
  // 'desktopLyric.style.fontWeight': false,
  'desktopLyric.style.opacity': 95,
  'desktopLyric.style.ellipsis': false,
  'desktopLyric.style.isZoomActiveLrc': false,
  'desktopLyric.style.isFontWeightFont': true,
  'desktopLyric.style.isFontWeightLine': true,
  'desktopLyric.style.isFontWeightExtended': true,

  'list.isClickPlayList': false,
  'list.isShowSource': true,
  'list.isSaveScrollLocation': true,
  'list.addMusicLocationType': 'top',
  'list.actionButtonsVisible': false,

  'download.enable': false,
  'download.isSavePathGroupByListName': false,
  'download.savePath': path.join(os.homedir(), 'Desktop'),
  'download.fileName': '歌名 - 歌手',
  'download.maxDownloadNum': 3,
  'download.skipExistFile': true,
  'download.isDownloadLrc': false,
  'download.isDownloadLxLrc': true,
  'download.isDownloadTLrc': false,
  'download.isDownloadRLrc': false,
  'download.lrcFormat': 'utf8',
  'download.isEmbedPic': true,
  'download.isEmbedLyric': false,
  'download.isEmbedLyricLx': true,
  'download.isEmbedLyricT': false,
  'download.isEmbedLyricR': false,
  'download.isUseOtherSource': false,

  'search.isShowHotSearch': false,
  'search.isShowHistorySearch': false,
  'search.isFocusSearchBox': false,

  'network.proxy.enable': false,
  'network.proxy.host': '',
  'network.proxy.port': '',

  'tray.enable': false,
  // 'tray.isToTray': false,
  'tray.themeId': 0,

  'sync.mode': 'server',
  'sync.enable': false,
  'sync.server.port': '23332',
  'sync.server.maxSsnapshotNum': 5,
  'sync.client.host': '',

  'openAPI.enable': false,
  'openAPI.port': '23330',
  'openAPI.bindLan': false,

  // 'theme.id': 'blue_plus',
  'theme.id': 'auto', // Luminous Harmonic: 默认跟随系统深浅色无缝切换
  'theme.lightId': 'luminous_light',
  'theme.darkId': 'luminous_dark',

  'odc.isAutoClearSearchInput': false,
  'odc.isAutoClearSearchList': false,

}


// 使用新年皮肤
if (new Date().getMonth() < 2) {
  defaultSetting['theme.id'] = 'happy_new_year'
  defaultSetting['desktopLyric.style.lyricPlayedColor'] = 'rgba(255, 57, 71, 1)'
}


export default defaultSetting
