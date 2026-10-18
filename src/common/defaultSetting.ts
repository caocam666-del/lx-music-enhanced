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
  // Luminous Harmonic: 切歌过渡 (复刻 pure-music): none 无缝衔接 / fade 淡入淡出 / crossfade 交叉淡化 / smart 智能衔接
  'player.songTransition': 'none',
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
  // Luminous Harmonic: 换源时限规则（秒）— 单个音源最多等多久 / 整轮换源最多等多久
  'player.sourceSwitch.sourceTimeout': 6,
  'player.sourceSwitch.totalBudget': 18,
  // 音频加载两级超时（秒）：第一次超时→刷新URL；第二次仍超时→按规则跳过
  'player.loadTimeout': 25,
  // 连续多少首失败后停止自动切歌
  'player.maxConsecutiveFailures': 3,
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
  // Luminous Harmonic: 流光背景动效 — dynamic 动态流光 / rhythm 节奏律动 (音频响应呼吸)
  'playDetail.flowMode': 'dynamic',
  // Luminous Harmonic: 功能组件颜色 — cover 封面取色 / rgb(r,g,b) 主题色板选择
  'playDetail.uiAccent': 'cover',

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
  'desktopLyric.width': 660,
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
  // Luminous Harmonic: 灵动岛（药丸形态）—— 尺寸与吸附边距
  // 胶囊宽度：autoWidth 为 true 时按内容自适应（此项仅作兜底/固定模式用）
  'desktopLyric.island.autoWidth': true,
  'desktopLyric.island.width': 320,
  'desktopLyric.island.height': 44,
  // 灵动岛默认固定在屏幕顶部中央（用户要求），边距压到最小以「紧贴顶端」
  'desktopLyric.island.dock': 'top',
  'desktopLyric.island.margin': 4,
  // 展开态（播放卡：左侧歌曲信息 + 右侧滚动歌词 + 通栏进度条）
  'desktopLyric.island.expandWidth': 460,
  'desktopLyric.island.expandHeight': 200,
  // 展开触发方式：hover（悬停，默认）| click（点击）
  'desktopLyric.island.expandTrigger': 'hover',
  // 悬停展开防抖 / 移出收起延时（毫秒）
  'desktopLyric.island.hoverDelay': 120,
  'desktopLyric.island.leaveDelay': 900,
  // 展开态歌词行数（1 / 3 / 5，奇数才能让当前行居中）
  'desktopLyric.island.lyricLines': 3,
  // 流光背景：none 纯净 / dynamic 动态流光 / rhythm 节奏律动（拾音器）
  'desktopLyric.island.flowMode': 'dynamic',
  // 流光强度 0-100：100 ≈ 与歌词详情页完全一致的亮度/蒙层；越低越暗、文字越清晰
  'desktopLyric.island.flowStrength': 100,
  // 灵动岛背景不透明度 0-100（只作用于背景层，文字始终不透明以保证可读）
  'desktopLyric.island.opacity': 100,
  // 取色来源：detail 跟随详情页（封面取色）/ theme 跟随主题色
  'desktopLyric.island.colorSource': 'detail',
  // 展开态歌词字号（px，滚轮可调 11–26）
  'desktopLyric.island.lyricFontSize': 15,
  // 收起态是否显示歌曲封面缩略图
  'desktopLyric.island.showCover': true,
  // 展开态歌词对齐：left / center / right
  'desktopLyric.island.lyricAlign': 'left',
  'desktopLyric.style.align': 'center',
  'desktopLyric.style.font': '',
  'desktopLyric.style.fontSize': 20,
  'desktopLyric.style.lineGap': 15,
  // 歌词颜色默认跟随详情页取色；用户手动改色后置 false，点「重置颜色」恢复 true
  'desktopLyric.style.colorFollowDetail': true,
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
