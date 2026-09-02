import path from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { debounce, getPlatform, isWin } from '@common/utils'
import { initWindowSize, minHeight, minWidth } from './utils'
import { mainSend } from '@common/mainIpc'
import { encodePath } from '@common/utils/electron'

// require('./event')
// require('./rendererEvent')

let browserWindow: Electron.BrowserWindow | null = null
let isWinBoundsUpdateing = false
let isTaskbarMode = false
let isScreenListenerAttached = false
let isTaskbarReanchoring = false
let taskbarReanchorTimer: NodeJS.Timeout | null = null
let taskbarMenuBounds: Electron.Rectangle | null = null
let isTaskbarMenuExpanded = false

const getTaskbarBounds = (requestedWidth = 520, anchor?: Electron.Point): Electron.Rectangle => {
  const display = anchor ? screen.getDisplayNearestPoint(anchor) : screen.getPrimaryDisplay()
  const { bounds, workArea } = display
  const gaps = {
    left: workArea.x - bounds.x,
    top: workArea.y - bounds.y,
    right: bounds.x + bounds.width - workArea.x - workArea.width,
    bottom: bounds.y + bounds.height - workArea.y - workArea.height,
  }
  const taskbarSide = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0][0]
  if (taskbarSide == 'left' || taskbarSide == 'right') {
    const width = Math.max(40, Math.max(gaps.left, gaps.right))
    return {
      x: taskbarSide == 'left' ? bounds.x : workArea.x + workArea.width,
      y: workArea.y + 60,
      width,
      height: Math.max(240, Math.min(requestedWidth, workArea.height - 60)),
    }
  }
  const taskbarHeight = Math.max(40, Math.max(gaps.top, gaps.bottom))
  return {
    x: workArea.x + 60,
    y: taskbarSide == 'top' ? bounds.y : workArea.y + workArea.height,
    width: Math.max(240, Math.min(requestedWidth, workArea.width - 60)),
    height: taskbarHeight,
  }
}

export const reanchorTaskbar = () => {
  if (!browserWindow || !isTaskbarMode || isTaskbarReanchoring || isTaskbarMenuExpanded) return
  isTaskbarReanchoring = true
  try {
    const currentBounds = browserWindow.getBounds()
    browserWindow.setBounds(getTaskbarBounds(global.lx.appSetting['desktopLyric.width'], {
      x: currentBounds.x + currentBounds.width / 2,
      y: currentBounds.y + currentBounds.height / 2,
    }), false)
    browserWindow.setAlwaysOnTop(true, 'screen-saver')
  } finally {
    isTaskbarReanchoring = false
  }
}

export const setTaskbarMenuVisible = (visible: boolean) => {
  if (!browserWindow || !isTaskbarMode) return
  if (visible) {
    if (isTaskbarMenuExpanded) return
    const bounds = browserWindow.getBounds()
    const display = screen.getDisplayNearestPoint({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    })
    const { bounds: displayBounds, workArea } = display
    const gaps = {
      left: workArea.x - displayBounds.x,
      top: workArea.y - displayBounds.y,
      right: displayBounds.x + displayBounds.width - workArea.x - workArea.width,
      bottom: displayBounds.y + displayBounds.height - workArea.y - workArea.height,
    }
    const side = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0][0]
    const expanded = { ...bounds }
    const menuSize = 280
    taskbarMenuBounds = bounds
    isTaskbarMenuExpanded = true
    if (side == 'bottom') {
      expanded.height = Math.max(bounds.height, menuSize)
      expanded.y -= expanded.height - bounds.height
    } else if (side == 'top') {
      expanded.height = Math.max(bounds.height, menuSize)
    } else if (side == 'left') {
      expanded.width = Math.max(bounds.width, menuSize)
    } else {
      expanded.width = Math.max(bounds.width, menuSize)
      expanded.x -= expanded.width - bounds.width
    }
    browserWindow.setBounds(expanded, false)
    return
  }
  if (!taskbarMenuBounds) return
  browserWindow.setBounds(taskbarMenuBounds, false)
  taskbarMenuBounds = null
  isTaskbarMenuExpanded = false
}

const saveBoundsConfig = debounce((config: Partial<LX.AppSetting>) => {
  global.lx.event_app.update_config(config)
  if (isWinBoundsUpdateing) isWinBoundsUpdateing = false
}, 500)

const winEvent = () => {
  if (!browserWindow) return
  const currentWindow = browserWindow

  // browserWindow.on('close', () => {
  //   if (global.lx.appSetting['desktopLyric.enable'] && !global.lx.mainWindowClosed) {
  //     browserWindow = null
  //     global.lx.event_app.update_config({ 'desktopLyric.enable': false })
  //   }
  // })

  browserWindow.on('closed', () => {
    if (browserWindow !== currentWindow) return
    if (isScreenListenerAttached) {
      screen.removeListener('display-metrics-changed', reanchorTaskbar)
      isScreenListenerAttached = false
    }
    if (taskbarReanchorTimer) {
      clearInterval(taskbarReanchorTimer)
      taskbarReanchorTimer = null
    }
    taskbarMenuBounds = null
    isTaskbarMenuExpanded = false
    browserWindow = null
  })

  if (isWin) {
    if (!isScreenListenerAttached) {
      screen.on('display-metrics-changed', reanchorTaskbar)
      isScreenListenerAttached = true
    }
    if (isTaskbarMode && !taskbarReanchorTimer) {
      taskbarReanchorTimer = setInterval(reanchorTaskbar, 2000)
    }
  }

  browserWindow.on('move', () => {
    if (isTaskbarMode && !isTaskbarReanchoring) {
      reanchorTaskbar()
      return
    }
    // bounds = browserWindow.getBounds()
    // console.log('move', isWinBoundsUpdateing)
    if (isWinBoundsUpdateing) {
      const bounds = browserWindow!.getBounds()
      saveBoundsConfig({
        'desktopLyric.x': bounds.x,
        'desktopLyric.y': bounds.y,
        'desktopLyric.width': bounds.width,
        'desktopLyric.height': bounds.height,
      })
    } else if (isWin) { // Linux 不允许将窗口设置出屏幕之外，MacOS未知，故只在Windows下执行强制设置
      // 非主动调整窗口触发的窗口位置变化将重置回设置值
      browserWindow!.setBounds({
        x: global.lx.appSetting['desktopLyric.x'] ?? 0,
        y: global.lx.appSetting['desktopLyric.y'] ?? 0,
        width: global.lx.appSetting['desktopLyric.width'],
        height: global.lx.appSetting['desktopLyric.height'],
      })
    }
  })

  browserWindow.on('resize', () => {
    if (isTaskbarMenuExpanded) {
      isWinBoundsUpdateing = false
      return
    }
    // bounds = browserWindow.getBounds()
    // console.log(bounds)
    isWinBoundsUpdateing = true
    const bounds = browserWindow!.getBounds()
    saveBoundsConfig({
      'desktopLyric.x': bounds.x,
      'desktopLyric.y': bounds.y,
      'desktopLyric.width': bounds.width,
      'desktopLyric.height': bounds.height,
    })
  })

  // browserWindow.on('restore', () => {
  //   browserWindow.webContents.send('restore')
  // })
  // browserWindow.on('focus', () => {
  //   browserWindow.webContents.send('focus')
  // })

  browserWindow.once('ready-to-show', () => {
    showWindow()
    // Luminous Harmonic: 歌词条模式 - 照抄 TaskbarLyrics 两步法: 先 Electron setAlwaysOnTop 再 SetWindowPos(HWND_TOPMOST) 双保险
    if (isTaskbarMode) {
      browserWindow!.setAlwaysOnTop(true, 'screen-saver')
      reanchorTaskbar()
    }
    if ((isTaskbarMode && !global.lx.appSetting['desktopLyric.taskbarInteractive']) || global.lx.appSetting['desktopLyric.isLock']) {
      browserWindow!.setIgnoreMouseEvents(true, { forward: false })
    }
    // linux下每次重开时貌似要重新设置置顶
    // if (isLinux && global.lx.appSetting['desktopLyric.isAlwaysOnTop']) {
    //   browserWindow!.setAlwaysOnTop(global.lx.appSetting['desktopLyric.isAlwaysOnTop'], 'screen-saver')
    // }
    if (global.lx.appSetting['desktopLyric.isAlwaysOnTop'] && global.lx.appSetting['desktopLyric.isAlwaysOnTopLoop']) alwaysOnTopTools.startLoop()
    browserWindow!.blur()
  })
}

export const createWindow = () => {
  if (isScreenListenerAttached) {
    screen.removeListener('display-metrics-changed', reanchorTaskbar)
    isScreenListenerAttached = false
  }
  if (taskbarReanchorTimer) {
    clearInterval(taskbarReanchorTimer)
    taskbarReanchorTimer = null
  }
  taskbarMenuBounds = null
  isTaskbarMenuExpanded = false
  closeWindow()
  if (!global.envParams.workAreaSize) return
  let x = global.lx.appSetting['desktopLyric.x']
  let y = global.lx.appSetting['desktopLyric.y']
  let width = global.lx.appSetting['desktopLyric.width']
  let height = global.lx.appSetting['desktopLyric.height']
  let isAlwaysOnTop = global.lx.appSetting['desktopLyric.isAlwaysOnTop']
  // let isLockScreen = global.lx.appSetting['desktopLyric.isLockScreen']
  let isShowTaskbar = global.lx.appSetting['desktopLyric.isShowTaskbar']
  // Luminous Harmonic: 歌词条模式 — 覆盖在任务栏闲置区(任务栏左下角), 像任务栏原生歌词
  isTaskbarMode = isWin && global.lx.appSetting['desktopLyric.mode'] == 'bar'
  if (isTaskbarMode) {
    const taskbarBounds = getTaskbarBounds(width || 520, {
      x: x ?? 0,
      y: y ?? 0,
    })
    x = taskbarBounds.x
    y = taskbarBounds.y
    width = taskbarBounds.width
    height = taskbarBounds.height
  }
  // let { width: screenWidth, height: screenHeight } = global.envParams.workAreaSize
  const winSize = isTaskbarMode
    ? { x: x ?? 0, y: y ?? 0, width: width ?? minWidth, height: height ?? minHeight }
    : initWindowSize(x, y, width, height)
  global.lx.event_app.update_config({
    'desktopLyric.x': winSize.x,
    'desktopLyric.y': winSize.y,
    'desktopLyric.width': winSize.width,
    'desktopLyric.height': winSize.height,
  })

  const { shouldUseDarkColors, theme } = global.lx.theme

  /**
   * Initial window options
   */
  browserWindow = new BrowserWindow({
    height: winSize.height,
    width: winSize.width,
    x: winSize.x,
    y: winSize.y,
    minWidth,
    minHeight,
    useContentSize: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    icon: path.join(global.staticPath, 'images/lx-music.ico'),
    // enableRemoteModule: false,
    resizable: isWin,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    roundedCorners: false,
    show: false,
    alwaysOnTop: isTaskbarMode || isAlwaysOnTop,
    skipTaskbar: isTaskbarMode || !isShowTaskbar,
    webPreferences: {
      contextIsolation: false,
      webSecurity: false,
      sandbox: false,
      nodeIntegration: true,
      enableWebSQL: false,
      webgl: false,
      spellcheck: false, // 禁用拼写检查器
      backgroundThrottling: false,
    },
  })

  // 歌词条模式: 用最高置顶层级, 确保覆盖在任务栏之上
  if (isTaskbarMode) browserWindow.setAlwaysOnTop(true, 'screen-saver')

  const winURL = process.env.NODE_ENV !== 'production' ? 'http://localhost:9081/lyric.html' : `file://${path.join(encodePath(__dirname), 'lyric.html')}`
  void browserWindow.loadURL(winURL + `?os=${getPlatform()}&dark=${shouldUseDarkColors}&theme=${encodeURIComponent(JSON.stringify(theme))}`)

  winEvent()
  // browserWindow.webContents.openDevTools()
  global.lx.event_app.desktop_lyric_window_created(browserWindow)
}
export const isExistWindow = (): boolean => !!browserWindow

export const closeWindow = () => {
  if (!browserWindow) return
  browserWindow.close()
}

export const showWindow = () => {
  if (!browserWindow) return
  browserWindow.show()
}

export const setResizeable = (isResizeable: boolean) => {
  if (!browserWindow) return
  browserWindow.setResizable(isResizeable)
}

export const sendEvent = <T = any>(name: string, params?: T) => {
  if (!browserWindow) return
  mainSend(browserWindow, name, params)
}

export const getBounds = (): Electron.Rectangle | null => {
  if (!browserWindow) return null
  return browserWindow.getBounds()
}

export const setBounds = (bounds: Electron.Rectangle) => {
  if (!browserWindow) return
  isWinBoundsUpdateing = true
  browserWindow.setBounds(bounds)
}


export const setIgnoreMouseEvents = (ignore: boolean, options?: Electron.IgnoreMouseEventsOptions) => {
  if (!browserWindow) return
  browserWindow.setIgnoreMouseEvents(ignore, options)
}

export const setSkipTaskbar = (skip: boolean) => {
  if (!browserWindow) return
  browserWindow.setSkipTaskbar(skip)
}

export const setAlwaysOnTop = (flag: boolean, level?: 'normal' | 'floating' | 'torn-off-menu' | 'modal-panel' | 'main-menu' | 'status' | 'pop-up-menu' | 'screen-saver' | undefined, relativeLevel?: number | undefined) => {
  if (!browserWindow) return
  browserWindow.setAlwaysOnTop(flag, level, relativeLevel)
}

export const getMainFrame = (): Electron.WebFrameMain | null => {
  if (!browserWindow) return null
  return browserWindow.webContents.mainFrame
}

interface AlwaysOnTopTools {
  timeout: NodeJS.Timeout | null
  setAlwaysOnTop: (isLoop: boolean) => void
  startLoop: () => void
  clearLoop: () => void
}
export const alwaysOnTopTools: AlwaysOnTopTools = {
  timeout: null,
  setAlwaysOnTop(isLoop) {
    this.clearLoop()
    setAlwaysOnTop(global.lx.appSetting['desktopLyric.isAlwaysOnTop'], 'screen-saver')
    // console.log(isLoop)
    if (isLoop) this.startLoop()
  },
  startLoop() {
    this.clearLoop()
    this.timeout = setInterval(() => {
      if (!isExistWindow()) {
        this.clearLoop()
        return
      }
      setAlwaysOnTop(true, 'screen-saver')
    }, 500)
  },
  clearLoop() {
    if (!this.timeout) return
    clearInterval(this.timeout)
    this.timeout = null
  },
}
