import { registerRendererEvents as common } from '@main/modules/commonRenderers/common'
import { mainOn, mainHandle } from '@common/mainIpc'
import { WIN_LYRIC_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { buildLyricConfig, getLyricWindowBounds } from './utils'
import { sendNewDesktopLyricClient } from '@main/modules/winMain'
import { getBounds, getMainFrame, sendEvent, setBounds, setResizeable, setTaskbarMenuVisible, resetIslandPosition, setIslandExpanded, setIslandContentWidth } from './main'
import { MessageChannelMain } from 'electron'
import { mouseCheckTools } from './mouseCheckTools'


export default () => {
  // mainOn(WIN_LYRIC_RENDERER_EVENT_NAME.get_lyric_info, ({ params: action }) => {
  //   sendMainEvent(WIN_MAIN_RENDERER_EVENT_NAME.get_lyric_info, {
  //     name: WIN_LYRIC_RENDERER_EVENT_NAME.set_lyric_info,
  //     modal: 'lyricWindow',
  //     action,
  //   })
  // })
  common(sendEvent)

  mainHandle<Partial<LX.AppSetting>>(WIN_LYRIC_RENDERER_EVENT_NAME.set_config, async({ params: config }) => {
    global.lx.event_app.update_config(config)
  })

  mainHandle<LX.DesktopLyric.Config>(WIN_LYRIC_RENDERER_EVENT_NAME.get_config, async() => {
    return buildLyricConfig(global.lx.appSetting) as LX.DesktopLyric.Config
  })

  mainOn<LX.DesktopLyric.NewBounds>(WIN_LYRIC_RENDERER_EVENT_NAME.set_win_bounds, ({ params: options }) => {
    setBounds(getLyricWindowBounds(getBounds()!, options))
  })

  mainOn<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.set_win_resizeable, ({ params: resizable }) => {
    setResizeable(resizable)
  })

  mainOn<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.set_taskbar_menu_visible, ({ params: visible }) => {
    setTaskbarMenuVisible(visible)
  })

  // Luminous Harmonic: 灵动岛复位位置（右键菜单触发；多屏插拔后也靠它兜底）
  // 可选带上 dock / expanded：切换停靠边时若正处于展开态，需要按展开尺寸重新落位
  mainOn<{ dock?: string, expanded?: boolean } | undefined>(WIN_LYRIC_RENDERER_EVENT_NAME.reset_island_position, ({ params }) => {
    resetIslandPosition(params ?? undefined)
  })

  // Luminous Harmonic: 灵动岛展开/收起（渲染层悬停或点击时请求切换窗口尺寸）
  mainOn<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.set_island_expanded, ({ params: expanded }) => {
    setIslandExpanded(!!expanded)
  })

  // 渲染层上报胶囊内容实测宽度 → 收起态窗口自适应收窄（避免固定宽度留白/截断）
  mainOn<number>(WIN_LYRIC_RENDERER_EVENT_NAME.set_island_content_width, ({ params: width }) => {
    setIslandContentWidth(Number(width))
  })

  mainOn(WIN_LYRIC_RENDERER_EVENT_NAME.request_main_window_channel, ({ event }) => {
    if (event.senderFrame !== getMainFrame()) return
    // Create a new channel ...
    const { port1, port2 } = new MessageChannelMain()
    // ... send one end to the worker ...
    sendNewDesktopLyricClient(port1)
    // ... and the other end to the main window.
    event.senderFrame?.postMessage(WIN_LYRIC_RENDERER_EVENT_NAME.provide_main_window_channel, null, [port2])
    // Now the main window and the worker can communicate with each other
    // without going through the main process!
    console.log('request_main_window_channel')
  })

  mainOn<boolean>(WIN_LYRIC_RENDERER_EVENT_NAME.mouse_enter_leave, ({ params: isEnter }) => {
    if (isEnter) {
      mouseCheckTools.setMouseInWindow(true)
      mouseCheckTools.runCheck(sendMouseLeave)
    } else {
      mouseCheckTools.setMouseInWindow(false)
      mouseCheckTools.cacnelCheck()
    }
  })
}

export const sendConfigChange = (setting: Partial<LX.DesktopLyric.Config>) => {
  sendEvent(WIN_LYRIC_RENDERER_EVENT_NAME.on_config_change, setting)
}

export const sendMainWindowInitedEvent = () => {
  sendEvent(WIN_LYRIC_RENDERER_EVENT_NAME.main_window_inited)
}

export const sendMouseLeave = () => {
  sendEvent(WIN_LYRIC_RENDERER_EVENT_NAME.mouse_enter_leave, false)
}
