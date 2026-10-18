declare namespace LX {
  namespace DesktopLyric {
    interface Config {
      'desktopLyric.enable': LX.AppSetting['desktopLyric.enable']
      'desktopLyric.isLock': LX.AppSetting['desktopLyric.isLock']
      'desktopLyric.taskbarInteractive': LX.AppSetting['desktopLyric.taskbarInteractive']
      'desktopLyric.isAlwaysOnTop': LX.AppSetting['desktopLyric.isAlwaysOnTop']
      'desktopLyric.isAlwaysOnTopLoop': LX.AppSetting['desktopLyric.isAlwaysOnTopLoop']
      'desktopLyric.isShowTaskbar': LX.AppSetting['desktopLyric.isShowTaskbar']
      'desktopLyric.pauseHide': LX.AppSetting['desktopLyric.pauseHide']
      'desktopLyric.audioVisualization': LX.AppSetting['desktopLyric.audioVisualization']
      'desktopLyric.audioVisualizationStyle': LX.AppSetting['desktopLyric.audioVisualizationStyle']
      'desktopLyric.width': LX.AppSetting['desktopLyric.width']
      'desktopLyric.height': LX.AppSetting['desktopLyric.height']
      'desktopLyric.x': LX.AppSetting['desktopLyric.x']
      'desktopLyric.y': LX.AppSetting['desktopLyric.y']
      'desktopLyric.isLockScreen': LX.AppSetting['desktopLyric.isLockScreen']
      'desktopLyric.isDelayScroll': LX.AppSetting['desktopLyric.isDelayScroll']
      'desktopLyric.scrollAlign': LX.AppSetting['desktopLyric.scrollAlign']
      'desktopLyric.isHoverHide': LX.AppSetting['desktopLyric.isHoverHide']
      'desktopLyric.direction': LX.AppSetting['desktopLyric.direction']
      'desktopLyric.mode': LX.AppSetting['desktopLyric.mode']
      'desktopLyric.island.autoWidth': LX.AppSetting['desktopLyric.island.autoWidth']
      'desktopLyric.island.width': LX.AppSetting['desktopLyric.island.width']
      'desktopLyric.island.height': LX.AppSetting['desktopLyric.island.height']
      'desktopLyric.island.dock': LX.AppSetting['desktopLyric.island.dock']
      'desktopLyric.island.margin': LX.AppSetting['desktopLyric.island.margin']
      'desktopLyric.island.expandWidth': LX.AppSetting['desktopLyric.island.expandWidth']
      'desktopLyric.island.expandHeight': LX.AppSetting['desktopLyric.island.expandHeight']
      'desktopLyric.island.expandTrigger': LX.AppSetting['desktopLyric.island.expandTrigger']
      'desktopLyric.island.hoverDelay': LX.AppSetting['desktopLyric.island.hoverDelay']
      'desktopLyric.island.leaveDelay': LX.AppSetting['desktopLyric.island.leaveDelay']
      'desktopLyric.island.lyricLines': LX.AppSetting['desktopLyric.island.lyricLines']
      'desktopLyric.island.flowStrength': LX.AppSetting['desktopLyric.island.flowStrength']
      'desktopLyric.island.opacity': LX.AppSetting['desktopLyric.island.opacity']
      'desktopLyric.island.flowMode': LX.AppSetting['desktopLyric.island.flowMode']
      'desktopLyric.island.colorSource': LX.AppSetting['desktopLyric.island.colorSource']
      'desktopLyric.island.lyricFontSize': LX.AppSetting['desktopLyric.island.lyricFontSize']
      'desktopLyric.island.showCover': LX.AppSetting['desktopLyric.island.showCover']
      'desktopLyric.island.lyricAlign': LX.AppSetting['desktopLyric.island.lyricAlign']
      // 播放栏波浪进度条开关（灵动岛进度条样式与之同步）
      'common.playBarWave': LX.AppSetting['common.playBarWave']
      'desktopLyric.style.align': LX.AppSetting['desktopLyric.style.align']
      'desktopLyric.style.font': LX.AppSetting['desktopLyric.style.font']
      'desktopLyric.style.fontSize': LX.AppSetting['desktopLyric.style.fontSize']
      'desktopLyric.style.lineGap': LX.AppSetting['desktopLyric.style.lineGap']
      'desktopLyric.style.colorFollowDetail': LX.AppSetting['desktopLyric.style.colorFollowDetail']
      'desktopLyric.style.lyricUnplayColor': LX.AppSetting['desktopLyric.style.lyricUnplayColor']
      'desktopLyric.style.lyricPlayedColor': LX.AppSetting['desktopLyric.style.lyricPlayedColor']
      'desktopLyric.style.lyricShadowColor': LX.AppSetting['desktopLyric.style.lyricShadowColor']
      // 'desktopLyric.style.fontWeight': LX.AppSetting['desktopLyric.style.fontWeight']
      'desktopLyric.style.opacity': LX.AppSetting['desktopLyric.style.opacity']
      'desktopLyric.style.ellipsis': LX.AppSetting['desktopLyric.style.ellipsis']
      'desktopLyric.style.isFontWeightFont': LX.AppSetting['desktopLyric.style.isFontWeightFont']
      'desktopLyric.style.isFontWeightLine': LX.AppSetting['desktopLyric.style.isFontWeightLine']
      'desktopLyric.style.isFontWeightExtended': LX.AppSetting['desktopLyric.style.isFontWeightExtended']
      'desktopLyric.style.isZoomActiveLrc': LX.AppSetting['desktopLyric.style.isZoomActiveLrc']
      'common.langId': LX.AppSetting['common.langId']
      'player.isShowLyricTranslation': LX.AppSetting['player.isShowLyricTranslation']
      'player.isShowLyricRoma': LX.AppSetting['player.isShowLyricRoma']
      'player.isSwapLyricTranslationAndRoma': LX.AppSetting['player.isSwapLyricTranslationAndRoma']
      'player.isPlayLxlrc': LX.AppSetting['player.isPlayLxlrc']
      'player.playbackRate': LX.AppSetting['player.playbackRate']
    }

    /** Luminous Harmonic: 歌词窗可请求的播放动作；'seek' 时 data 为目标位置（毫秒） */
    type PlayerAction = 'play' | 'pause' | 'prev' | 'next' | 'toggle' | 'seek'
    type WinMainActions = 'get_info' | 'get_status' | 'get_analyser_data_array'
    | LyricAction<'player_action', { action: PlayerAction, data?: unknown }>

    interface LyricActionBase <A> {
      action: A
    }
    interface LyricActionData<A, D> extends LyricActionBase<A> {
      data: D
    }
    type LyricAction<A, D = undefined> = D extends undefined ? LyricActionBase<A> : LyricActionData<A, D>

    type LyricActions = LyricAction<'set_info', {
      id: string | null
      singer: string
      name: string
      album: string
      lrc: string | null
      tlrc: string | null
      rlrc: string | null
      lxlrc: string | null
      pic: string | null
      isPlay: boolean
      line: number
      played_time: number
      /** Luminous Harmonic: 总时长（毫秒），灵动岛进度条用 */
      max_time?: number
      /** Luminous Harmonic: 详情页那套强调色（--detail-accent-bright） */
      accent?: string
      /** Luminous Harmonic: 详情页中性高对比文字色（--detail-font-bright） */
      font_bright?: string
      /** Luminous Harmonic: 详情页歌词专用轻阴影（--detail-lyric-shadow） */
      lyric_shadow?: string
      /** Luminous Harmonic: 精简歌词行表（点歌词跳转需要起始时间） */
      lines?: { text: string, time: number }[]
    }>
    | LyricAction<'set_status', {
      isPlay: boolean
      line: number
      played_time: number
      /** Luminous Harmonic: 总时长（毫秒），灵动岛进度条用 */
      max_time?: number
    }>
    | LyricAction<'set_lyric', {
      lrc: string | null
      tlrc: string | null
      rlrc: string | null
      lxlrc: string | null
    }>
    | LyricAction<'set_offset', number>
    | LyricAction<'set_playbackRate', number>
    /** Luminous Harmonic: 带总时长，歌词窗据此画进度（兼容旧的裸毫秒数值） */
    | LyricAction<'set_play', number | { time: number, max_time?: number }>
    | LyricAction<'set_pause'>
    | LyricAction<'set_stop'>
    | LyricAction<'set_lyric_mode', boolean>
    | LyricAction<'send_analyser_data_array', Uint8Array>


    interface NewBounds {
      x: number
      y: number
      w: number
      h: number
    }
  }
}
