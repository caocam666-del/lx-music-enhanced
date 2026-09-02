import { isLinux } from '@common/utils'
import { closeWindow, createWindow, getBounds, isExistWindow, alwaysOnTopTools, reanchorTaskbar, setBounds, setIgnoreMouseEvents, setSkipTaskbar } from './main'
import { sendConfigChange, sendMouseLeave } from './rendererEvent'
import { buildLyricConfig, getLyricWindowBounds, initWindowSize, watchConfigKeys } from './utils'
import { mouseCheckTools } from './mouseCheckTools'

let isLock: boolean
let isEnable: boolean
let isAlwaysOnTop: boolean
let isAlwaysOnTopLoop: boolean
let isShowTaskbar: boolean
let isTaskbarInteractive: boolean
let isLockScreen: boolean
let isHoverHide: boolean
let isMode: LX.AppSetting['desktopLyric.mode']

const updateMouseEvents = () => {
  const setting = global.lx.appSetting
  const shouldIgnore = (setting['desktopLyric.mode'] == 'bar' && !setting['desktopLyric.taskbarInteractive']) || setting['desktopLyric.isLock']
  if (shouldIgnore) {
    setIgnoreMouseEvents(true, { forward: false })
    mouseCheckTools.runCheck(sendMouseLeave)
  } else {
    setIgnoreMouseEvents(false, { forward: !isLinux && setting['desktopLyric.mode'] != 'bar' && setting['desktopLyric.isHoverHide'] })
    mouseCheckTools.cacnelCheck()
  }
}

export const setLrcConfig = (keys: Array<keyof LX.AppSetting>, setting: Partial<LX.AppSetting>) => {
  if (!watchConfigKeys.some(key => keys.includes(key))) return

  if (isExistWindow()) {
    sendConfigChange(buildLyricConfig(setting))
    if (keys.includes('desktopLyric.taskbarInteractive') && isTaskbarInteractive != global.lx.appSetting['desktopLyric.taskbarInteractive']) {
      isTaskbarInteractive = global.lx.appSetting['desktopLyric.taskbarInteractive']
      updateMouseEvents()
    }
    if (keys.includes('desktopLyric.isLock') && isLock != global.lx.appSetting['desktopLyric.isLock']) {
      isLock = global.lx.appSetting['desktopLyric.isLock']
      updateMouseEvents()
    }
    if (keys.includes('desktopLyric.isHoverHide') && isHoverHide != global.lx.appSetting['desktopLyric.isHoverHide']) {
      isHoverHide = global.lx.appSetting['desktopLyric.isHoverHide']
      updateMouseEvents()
    }
    if (keys.includes('desktopLyric.isAlwaysOnTop') && isAlwaysOnTop != global.lx.appSetting['desktopLyric.isAlwaysOnTop']) {
      isAlwaysOnTop = global.lx.appSetting['desktopLyric.isAlwaysOnTop']
      if (global.lx.appSetting['desktopLyric.mode'] == 'bar') {
        reanchorTaskbar()
      } else alwaysOnTopTools.setAlwaysOnTop(global.lx.appSetting['desktopLyric.isAlwaysOnTopLoop'])
      if (isAlwaysOnTop && global.lx.appSetting['desktopLyric.isAlwaysOnTopLoop']) {
        alwaysOnTopTools.startLoop()
      } else alwaysOnTopTools.clearLoop()
    }
    if (keys.includes('desktopLyric.isShowTaskbar') && isShowTaskbar != global.lx.appSetting['desktopLyric.isShowTaskbar']) {
      isShowTaskbar = global.lx.appSetting['desktopLyric.isShowTaskbar']
      setSkipTaskbar(global.lx.appSetting['desktopLyric.mode'] == 'bar' || !global.lx.appSetting['desktopLyric.isShowTaskbar'])
    }
    if (keys.includes('desktopLyric.isAlwaysOnTopLoop') && isAlwaysOnTopLoop != global.lx.appSetting['desktopLyric.isAlwaysOnTopLoop']) {
      isAlwaysOnTopLoop = global.lx.appSetting['desktopLyric.isAlwaysOnTopLoop']
      if (!global.lx.appSetting['desktopLyric.isAlwaysOnTop']) return
      if (isAlwaysOnTopLoop) {
        alwaysOnTopTools.startLoop()
      } else {
        alwaysOnTopTools.clearLoop()
      }
    }
    if (keys.includes('desktopLyric.isLockScreen') && isLockScreen != global.lx.appSetting['desktopLyric.isLockScreen']) {
      isLockScreen = global.lx.appSetting['desktopLyric.isLockScreen']
      if (global.lx.appSetting['desktopLyric.isLockScreen']) {
        setBounds(getLyricWindowBounds(getBounds()!, {
          x: 0,
          y: 0,
          w: global.lx.appSetting['desktopLyric.width'],
          h: global.lx.appSetting['desktopLyric.height'],
        }))
      }
    }
    if (keys.includes('desktopLyric.x') && setting['desktopLyric.x'] == null) {
      setBounds(initWindowSize(
        global.lx.appSetting['desktopLyric.x'],
        global.lx.appSetting['desktopLyric.y'],
        global.lx.appSetting['desktopLyric.width'],
        global.lx.appSetting['desktopLyric.height'],
      ))
    }
  }
  if (keys.includes('desktopLyric.mode') && isMode != global.lx.appSetting['desktopLyric.mode']) {
    isMode = global.lx.appSetting['desktopLyric.mode']
    isTaskbarInteractive = global.lx.appSetting['desktopLyric.taskbarInteractive']
    updateMouseEvents()
    // Luminous Harmonic: 歌词条模式与常规模式窗口尺寸/定位不同, 直接重建
    if (global.lx.appSetting['desktopLyric.enable'] && isExistWindow()) {
      createWindow()
    }
  }
  if (keys.includes('desktopLyric.enable') && isEnable != global.lx.appSetting['desktopLyric.enable']) {
    isEnable = global.lx.appSetting['desktopLyric.enable']
    if (global.lx.appSetting['desktopLyric.enable']) {
      createWindow()
    } else {
      alwaysOnTopTools.clearLoop()
      mouseCheckTools.cacnelCheck()
      closeWindow()
    }
  }
}
