import { rendererSend, rendererInvoke, rendererOn, rendererOff } from '@common/rendererIpc'
import { CMMON_EVENT_NAME, WIN_LYRIC_RENDERER_EVENT_NAME } from '@common/ipcNames'

type RemoveListener = () => void

export const getSetting = async() => {
  return rendererInvoke<LX.DesktopLyric.Config>(WIN_LYRIC_RENDERER_EVENT_NAME.get_config)
}
export const updateSetting = async(setting: Partial<LX.DesktopLyric.Config>) => {
  await rendererInvoke(WIN_LYRIC_RENDERER_EVENT_NAME.set_config, setting)
}
export const onSettingChanged = (listener: LX.IpcRendererEventListenerParams<Partial<LX.DesktopLyric.Config>>): RemoveListener => {
  rendererOn<Partial<LX.DesktopLyric.Config>>(WIN_LYRIC_RENDERER_EVENT_NAME.on_config_change, listener)
  return () => {
    rendererOff(WIN_LYRIC_RENDERER_EVENT_NAME.on_config_change, listener)
  }
}
export const setWindowBounds = (bounds: LX.DesktopLyric.NewBounds) => {
  rendererSend<LX.DesktopLyric.NewBounds>(WIN_LYRIC_RENDERER_EVENT_NAME.set_win_bounds, bounds)
}
export const setTaskbarMenuVisible = (visible: boolean) => {
  rendererSend<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.set_taskbar_menu_visible, visible)
}
/** Luminous Harmonic: 请求主进程把灵动岛复位到停靠位置（可指定停靠边，并按当前展开态取尺寸） */
export const resetIslandPosition = (opts?: { dock?: string, expanded?: boolean }) => {
  rendererSend(WIN_LYRIC_RENDERER_EVENT_NAME.reset_island_position, opts)
}
/** Luminous Harmonic: 请求主进程切换灵动岛尺寸（展开/收起） */
export const setIslandExpanded = (expanded: boolean) => {
  rendererSend<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.set_island_expanded, expanded)
}
/** 上报胶囊内容实测宽度：主进程据此自适应收窄窗口（保证一行歌词完整且右侧不留白） */
export const setIslandContentWidth = (width: number) => {
  rendererSend<number>(WIN_LYRIC_RENDERER_EVENT_NAME.set_island_content_width, width)
}
/** Luminous Harmonic: 主进程轮询判定光标已移出岛范围时通知（用于收起） */
export const onIslandCursorLeave = (listener: LX.IpcRendererEventListener): RemoveListener => {
  rendererOn(WIN_LYRIC_RENDERER_EVENT_NAME.island_cursor_leave, listener)
  return () => {
    rendererOff(WIN_LYRIC_RENDERER_EVENT_NAME.island_cursor_leave, listener)
  }
}
let previousResizable: boolean | null = null
export const setWindowResizeable = (resizable: boolean) => {
  if (previousResizable === resizable) return
  previousResizable = resizable
  // https://github.com/electron/electron/issues/48352
  // rendererSend<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.set_win_resizeable, resizable)
}

export const sendConnectMainWindowEvent = () => {
  rendererSend(WIN_LYRIC_RENDERER_EVENT_NAME.request_main_window_channel)
}
export const onProvideMainWindowChannel = (listener: LX.IpcRendererEventListener): RemoveListener => {
  rendererOn(WIN_LYRIC_RENDERER_EVENT_NAME.provide_main_window_channel, listener)
  return () => {
    rendererOff(WIN_LYRIC_RENDERER_EVENT_NAME.provide_main_window_channel, listener)
  }
}
export const onMainWindowInited = (listener: LX.IpcRendererEventListener): RemoveListener => {
  rendererOn(WIN_LYRIC_RENDERER_EVENT_NAME.main_window_inited, listener)
  return () => {
    rendererOff(WIN_LYRIC_RENDERER_EVENT_NAME.main_window_inited, listener)
  }
}

export const sendMouseEnterLeave = (isEnter: boolean) => {
  rendererSend(WIN_LYRIC_RENDERER_EVENT_NAME.mouse_enter_leave, isEnter)
}
export const onMouseEnterLeave = (listener: LX.IpcRendererEventListenerParams<boolean>): RemoveListener => {
  rendererOn<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.mouse_enter_leave, listener)
  return () => {
    rendererOff(WIN_LYRIC_RENDERER_EVENT_NAME.mouse_enter_leave, listener)
  }
}

/**
 * On Theme Change
 * @param listener LX.IpcRendererEventListenerParams<shouldUseDarkColors: boolean>
 * @returns RemoveListener Fn
 */
export const onThemeChange = (listener: LX.IpcRendererEventListenerParams<LX.ThemeSetting>): RemoveListener => {
  rendererOn(CMMON_EVENT_NAME.theme_change, listener)
  return () => {
    rendererOff(CMMON_EVENT_NAME.theme_change, listener)
  }
}
