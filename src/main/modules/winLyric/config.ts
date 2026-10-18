import { isLinux } from '@common/utils'
import { closeWindow, createWindow, getBounds, isExistWindow, alwaysOnTopTools, reanchorTaskbar, resetIslandPosition, setBounds, setIgnoreMouseEvents, setSkipTaskbar } from './main'
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
    // 灵动岛几何相关设置变更 → 重新摆放窗口。
    // 之前这些键只被推给渲染层，主进程从不重新 setBounds，
    // 所以设置页改「停靠边 / 收起态宽度 / 高度 / 边距」全都没反应（用户反馈"完全是摆设"）。
    if (
      keys.includes('desktopLyric.island.dock') ||
      keys.includes('desktopLyric.island.width') ||
      keys.includes('desktopLyric.island.height') ||
      keys.includes('desktopLyric.island.margin') ||
      keys.includes('desktopLyric.island.autoWidth') ||
      // 歌词行数 / 字号直接决定卡片需要多高，改了必须重新落位，否则歌词区被压掉一行
      keys.includes('desktopLyric.island.lyricLines') ||
      keys.includes('desktopLyric.island.lyricFontSize')
    ) {
      // 不强制收起：沿用当前展开状态。
      // 强制 { expanded: false } 会在展开时把窗口缩成胶囊，而渲染层仍显示卡片
      // → 表现为"展开后内容被压扁"。
      if (global.lx.appSetting['desktopLyric.mode'] == 'island') resetIslandPosition()
    }
    // 歌词条（任务栏歌词）宽度变更 → 重新贴到任务栏并应用新宽度。
    // 之前只有灵动岛的键会触发重排，改「歌词条宽度」滑块完全没反应。
    if (keys.includes('desktopLyric.width')) {
      if (global.lx.appSetting['desktopLyric.mode'] == 'bar') reanchorTaskbar()
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
