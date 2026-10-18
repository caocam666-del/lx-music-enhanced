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
let isIslandMode = false
let isScreenListenerAttached = false
let isTaskbarReanchoring = false
let taskbarReanchorTimer: NodeJS.Timeout | null = null
let taskbarMenuBounds: Electron.Rectangle | null = null
let isTaskbarMenuExpanded = false

/**
 * Luminous Harmonic: 灵动岛（药丸形态）几何。
 *
 * 设计依据（调研结论）：贴边吸附必须用 workArea（已排除任务栏），否则会吸到任务栏底下；
 * Display.bounds / workArea 都是 DIP，所以这里全部用 DIP 计算，不再做 scaleFactor 换算。
 */
const ISLAND_DOCK_MARGIN = () => Math.max(0, global.lx.appSetting['desktopLyric.island.margin'] ?? 16)

/**
 * 收起态（胶囊）内容实测宽度：由渲染层测量后上报（见 set_island_content_width）。
 *
 * 为什么需要：胶囊固定宽度会和内容脱节 —— 歌词短的时候右侧留一大片空白
 * （用户反馈"太长了"），歌词长的时候又被截断。
 * 改为「按内容自适应 + 上下限兜底」：既保证一行歌词完整显示，又不会空着。
 * 0 表示渲染层还没上报过，此时回落到设置里的固定宽度。
 */
let islandContentWidth = 0
const ISLAND_AUTO_MIN = 168
// 上限对齐原固定宽度：自适应只会让胶囊变短，不会比原来更长
const ISLAND_AUTO_MAX = 420

/** 收起态尺寸（胶囊）：autoWidth 开启时用内容实测宽度，否则用设置里的固定宽度 */
const getIslandCollapsedSize = () => {
  const fixed = Math.max(200, global.lx.appSetting['desktopLyric.island.width'] ?? 320)
  const auto = global.lx.appSetting['desktopLyric.island.autoWidth'] !== false
  const width = auto && islandContentWidth > 0
    ? Math.max(ISLAND_AUTO_MIN, Math.min(ISLAND_AUTO_MAX, Math.round(islandContentWidth)))
    : fixed
  return {
    width,
    height: Math.max(32, global.lx.appSetting['desktopLyric.island.height'] ?? 44),
  }
}

/** 展开态尺寸（播放卡：左侧歌曲信息 + 右侧滚动歌词 + 通栏进度条） */
const getIslandExpandedSize = () => ({
  width: Math.max(320, global.lx.appSetting['desktopLyric.island.expandWidth'] ?? 460),
  // 高度完全按用户设定（用户确认 140px 也能完整显示 3 行歌词，不要擅自抬高）
  height: Math.max(120, Number(global.lx.appSetting['desktopLyric.island.expandHeight']) || 200),
})

/** 按停靠边算出岛在指定显示器上的目标位置（只算 x/y，尺寸沿用设置） */
export const getIslandBounds = (opts?: { display?: Electron.Display, dock?: string, expanded?: boolean }): Electron.Rectangle => {
  const size = opts?.expanded ? getIslandExpandedSize() : getIslandCollapsedSize()
  const { width, height } = size
  const dock = opts?.dock ?? global.lx.appSetting['desktopLyric.island.dock'] ?? 'top'
  const display = opts?.display ?? screen.getPrimaryDisplay()
  const { workArea } = display
  const margin = ISLAND_DOCK_MARGIN()
  let x: number
  let y: number
  switch (dock) {
    case 'top':
      x = workArea.x + Math.round((workArea.width - width) / 2)
      y = workArea.y + margin
      break
    case 'left':
      x = workArea.x + margin
      y = workArea.y + Math.round((workArea.height - height) / 2)
      break
    case 'right':
      x = workArea.x + workArea.width - width - margin
      y = workArea.y + Math.round((workArea.height - height) / 2)
      break
    case 'bottom':
    default:
      x = workArea.x + Math.round((workArea.width - width) / 2)
      y = workArea.y + workArea.height - height - margin
      break
  }
  return { x, y, width, height }
}

/** 岛窗口当前所在的显示器（按窗口中心点判定；拔掉副屏时回落到主屏） */
const getCurrentDisplay = (): Electron.Display => {
  if (!browserWindow) return screen.getPrimaryDisplay()
  const bounds = browserWindow.getBounds()
  return screen.getDisplayNearestPoint({
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2),
  })
}

/** 把岛复位到当前显示器的停靠位置（右键菜单 / 拔屏回落都用它） */
export const resetIslandPosition = (opts?: { dock?: string, expanded?: boolean }) => {
  if (!browserWindow || !isIslandMode) return
  // 先停掉进行中的尺寸补间：否则补间会在本次 setBounds 之后继续按旧目标写，
  // 把窗口留在错误尺寸上（曾出现"展开后窗口只有几十像素、内容被压扁"）。
  stopIslandTween()
  // 默认沿用当前展开状态；不要默认按收起态摆放，
  // 否则展开时被任何一次复位打断都会变成"渲染层是卡片、窗口却是胶囊大小"。
  const expanded = opts?.expanded ?? isIslandExpanded
  const target = getIslandBounds({ display: getCurrentDisplay(), dock: opts?.dock, expanded })
  isWinBoundsUpdateing = true
  browserWindow.setBounds(target, false)
  browserWindow.setAlwaysOnTop(true, 'screen-saver')
  /**
   * 只记录位置，**不写** desktopLyric.width/height。
   *
   * 岛的宽高是由 island.width / autoWidth / 展开尺寸推出来的（且收起态与展开态不同），
   * 写进 desktopLyric.width 会直接覆盖掉「歌词条（bar）宽度」这个用户设置 ——
   * 表现为切一次灵动岛、歌词条的宽度就被重置成胶囊尺寸（用户反馈）。
   */
  global.lx.event_app.update_config({
    'desktopLyric.x': target.x,
    'desktopLyric.y': target.y,
  })
  // 窗口在屏幕外时的兜底：与所有显示器 workArea 都不相交就回主屏
  {
    const bounds = browserWindow.getBounds()
    const visible = screen.getAllDisplays().some(d => {
      const a = d.workArea
      return bounds.x < a.x + a.width && bounds.x + bounds.width > a.x &&
        bounds.y < a.y + a.height && bounds.y + bounds.height > a.y
    })
    if (!visible) {
      const primary = getIslandBounds({ display: screen.getPrimaryDisplay(), dock: opts?.dock, expanded })
      browserWindow.setBounds(primary, false)
      global.lx.event_app.update_config({
        'desktopLyric.x': primary.x,
        'desktopLyric.y': primary.y,
      })
    }
  }
}

const reanchorIsland = () => {
  if (!browserWindow || !isIslandMode) return
  // 显示器插拔/分辨率变化后，若窗口已不在任何显示器可见区内 → 复位
  const bounds = browserWindow.getBounds()
  const visible = screen.getAllDisplays().some(d => {
    const a = d.workArea
    return bounds.x < a.x + a.width && bounds.x + bounds.width > a.x &&
      bounds.y < a.y + a.height && bounds.y + bounds.height > a.y
  })
  if (!visible) resetIslandPosition()
}

// ============================ 灵动岛展开 / 收起 ============================
let isIslandExpanded = false
let islandCursorTimer: NodeJS.Timeout | null = null
let islandCursorMissCount = 0

/** 当前是否展开（供其它模块查询） */
export const getIslandExpanded = () => isIslandExpanded

/**
 * 切换灵动岛的展开/收起。
 *
 * 尺寸策略：横向宽度在对齐停靠边的前提下重算（顶部停靠即保持一致居中），
 * 纵向固定贴着停靠边（顶部停靠 → y 不变，向下“长出来”），
 * 这样展开动画看起来是从胶囊里生长，而不是整块跳位。
 */
/**
 * 灵动岛展开/收起的窗口尺寸补间。
 *
 * 为什么需要：透明窗没法用 CSS 过渡窗口大小，主进程 setBounds 是**瞬间**生效的，
 * 于是「44px 高 → 200px 高」会硬跳一下，内容淡入再顺也掩不住这个跳变（用户反馈"突兀"）。
 * 这里在主进程按 ~60fps 逐帧插值尺寸，让整块岛面真的"长开/缩回"。
 *
 * 平滑性要点：
 *  · 时长与渲染层 CSS 动画**完全一致**（ISLAND_MORPH_MS），否则两块动效会互相错位、看着"不自然"
 *  · 缓动改为 easeOutQuint：起步快、尾巴长，比 cubic 更像系统级"弹簧落位"
 *  · 用 setInterval(16) 贴近 60fps；每帧只 setBounds 一次（setBounds 会触发 reflow，别多做）
 */
const ISLAND_MORPH_MS = 300
let islandTweenTimer: NodeJS.Timeout | null = null

const stopIslandTween = () => {
  if (islandTweenTimer) {
    clearInterval(islandTweenTimer)
    islandTweenTimer = null
  }
}

/** easeOutQuint：与渲染层 CSS 的 cubic-bezier(.22,1,.36,1) 观感接近 */
const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

const tweenIslandBounds = (target: Electron.Rectangle, dock: string) => {
  if (!browserWindow) return
  stopIslandTween()
  const from = browserWindow.getBounds()
  const bottomFixed = dock == 'bottom'
  const fromBottom = from.y + from.height
  // 目标的 x 已由 getIslandBounds 按时驻边重新居中；补间期间同步插值 x，视觉上居中展开
  const startX = from.x
  const startW = from.width
  const startH = from.height
  const startY = from.y
  const startTs = Date.now()

  islandTweenTimer = setInterval(() => {
    if (!browserWindow || !isIslandMode) return stopIslandTween()
    const t = Math.min(1, (Date.now() - startTs) / ISLAND_MORPH_MS)
    const k = easeOutQuint(t)
    const width = Math.round(startW + (target.width - startW) * k)
    const height = Math.round(startH + (target.height - startH) * k)
    const x = Math.round(startX + (target.x - startX) * k)
    // 顶边停靠保持顶边不动；底边停靠保持底边不动
    const y = bottomFixed ? Math.round(fromBottom - height) : Math.round(startY + (target.y - startY) * k)
    isWinBoundsUpdateing = true
    browserWindow.setBounds({ x, y, width, height }, false)
    if (t >= 1) {
      stopIslandTween()
      isWinBoundsUpdateing = false
      // 收尾对齐到精确目标，避免四舍五入留下 1px 偏差
      browserWindow.setBounds(target, false)
    }
  }, 16)
}

/**
 * 渲染层上报胶囊内容实测宽度 → 调整收起态窗口宽度（保持停靠边、水平居中）。
 *
 * 只在收起态生效：展开态有独立的 expandWidth，不受影响。
 * 变化小于 2px 时忽略，避免歌词逐字高亮时反复 setBounds 造成抖动。
 */
export const setIslandContentWidth = (width: number) => {
  if (!Number.isFinite(width) || width <= 0) return
  const next = Math.max(ISLAND_AUTO_MIN, Math.min(ISLAND_AUTO_MAX, Math.round(width)))
  if (Math.abs(next - islandContentWidth) < 2) return
  islandContentWidth = next
  // 关掉自适应时不上报生效，避免和固定宽度互相拉扯
  if (global.lx.appSetting['desktopLyric.island.autoWidth'] === false) return
  if (!browserWindow || !isIslandMode || isIslandExpanded) return
  const dock = global.lx.appSetting['desktopLyric.island.dock'] ?? 'top'
  // 高度不变，只改宽度并按停靠边重新居中（此处必然处于收起态，不必显式指定）
  resetIslandPosition({ dock })
}

export const setIslandExpanded = (expanded: boolean) => {
  if (!browserWindow || !isIslandMode) return
  const display = getCurrentDisplay()
  const target = getIslandBounds({ display, expanded })
  const current = browserWindow.getBounds()
  /**
   * 自愈：不能只看缓存标志 isIslandExpanded，还要核对窗口**实际尺寸**。
   *
   * 曾经出现过「渲染层是卡片、窗口却只有几十像素」的压扁状态（用户截图）：
   * 补间被打断 / 状态曾经错开时，缓存标志仍为 true，于是 setIslandExpanded(true)
   * 直接 early-return，窗口再也不会被撑开 —— 必须用实际尺寸兜底重新落位。
   */
  const sizeMatches = Math.abs(current.height - target.height) <= 2 && Math.abs(current.width - target.width) <= 2
  if (isIslandExpanded === expanded && sizeMatches) return
  isIslandExpanded = expanded
  const dock = global.lx.appSetting['desktopLyric.island.dock'] ?? 'top'
  // 底部停靠时保持底边不动（向上长），其余保持顶边不动
  const y = dock == 'bottom'
    ? current.y + current.height - target.height
    : target.y
  tweenIslandBounds({ x: target.x, y, width: target.width, height: target.height }, dock)
  if (expanded) startIslandCursorWatch()
  else stopIslandCursorWatch()
}

/**
 * 把窗口尺寸强制对齐到当前展开状态（没有补间进行时才会动手）。
 *
 * 供光标轮询调用：成本极低（一次 getBounds），但能在任何"补间被打断 / 尺寸错位"
 * 的情况下把窗口拉回正确尺寸，避免长期停留在压扁状态。
 */
const reconcileIslandSize = () => {
  if (!browserWindow || !isIslandMode) return
  if (islandTweenTimer) return // 正在补间，别插一脚
  const target = getIslandBounds({ display: getCurrentDisplay(), expanded: isIslandExpanded })
  const cur = browserWindow.getBounds()
  if (Math.abs(cur.height - target.height) <= 2 && Math.abs(cur.width - target.width) <= 2) return
  isWinBoundsUpdateing = true
  browserWindow.setBounds(target, false)
}

/**
 * 展开期间轮询光标：一旦移出窗口范围就通知渲染层收起。
 *
 * 为什么需要它：窗口收起后尺寸变小，如果只依赖 DOM 的 mouseleave，
 * 「光标停在展开区域下部、窗口收起」这种情形会让窗口永远收不起来。
 * 连续 3 次（约 600ms）判定在外才通知，避免动画途中的抖动误判。
 * 注意：Wayland 不支持 screen.getCursorScreenPoint，届时本轮询自动失效，
 * 渲染层会退化为仅靠 DOM mouseleave + 点击外部收起。
 */
const startIslandCursorWatch = () => {
  stopIslandCursorWatch()
  islandCursorMissCount = 0
  islandCursorTimer = setInterval(() => {
    if (!browserWindow || !isIslandMode || !isIslandExpanded) {
      stopIslandCursorWatch()
      return
    }
    // 顺手校正尺寸：补间被打断等异常情况下把窗口拉回展开尺寸
    reconcileIslandSize()
    let point: Electron.Point
    try {
      point = screen.getCursorScreenPoint()
    } catch (_) {
      // 平台不支持（如 Wayland）→ 停掉轮询，交给渲染层
      stopIslandCursorWatch()
      return
    }
    const b = browserWindow.getBounds()
    const inside = point.x >= b.x && point.x <= b.x + b.width &&
      point.y >= b.y && point.y <= b.y + b.height
    if (inside) {
      islandCursorMissCount = 0
      return
    }
    islandCursorMissCount++
    if (islandCursorMissCount >= 3) {
      stopIslandCursorWatch()
      sendEvent('island_cursor_leave')
    }
  }, 200)
}

export const stopIslandCursorWatch = () => {
  if (islandCursorTimer) {
    clearInterval(islandCursorTimer)
    islandCursorTimer = null
  }
  islandCursorMissCount = 0
}

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
      // 任务栏歌词要「顶到最左」：横向任务栏从 workArea 左缘起，纵向任务栏从顶端起
      y: workArea.y,
      width,
      height: Math.max(240, Math.min(requestedWidth, workArea.height)),
    }
  }
  const taskbarHeight = Math.max(40, Math.max(gaps.top, gaps.bottom))
  return {
    // 原先 +60 的缩进导致没有顶到最左（用户反馈），改为紧贴 workArea 左缘
    x: workArea.x,
    y: taskbarSide == 'top' ? bounds.y : workArea.y + workArea.height,
    width: Math.max(240, Math.min(requestedWidth, workArea.width)),
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
      screen.removeListener('display-metrics-changed', reanchorIsland)
      isScreenListenerAttached = false
    }
    if (taskbarReanchorTimer) {
      clearInterval(taskbarReanchorTimer)
      taskbarReanchorTimer = null
    }
    taskbarMenuBounds = null
    isTaskbarMenuExpanded = false
    isIslandMode = false
    isIslandExpanded = false
    stopIslandCursorWatch()
    browserWindow = null
  })

  if (isWin || isIslandMode) {
    if (!isScreenListenerAttached) {
      screen.on('display-metrics-changed', reanchorTaskbar)
      // Luminous Harmonic: 拔副屏/改分辨率后岛若跑到屏幕外, 自动复位
      screen.on('display-metrics-changed', reanchorIsland)
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
    // Luminous Harmonic: 岛模式下窗口移动是用户拖动 → 只记录位置, 不强行拉回
    if (isIslandMode) {
      if (isWinBoundsUpdateing) {
        const bounds = browserWindow!.getBounds()
        // 只存位置：宽高是灵动岛自己算的（收起/展开尺寸不同），
        // 写进 desktopLyric.width/height 会把歌词条（bar）的宽度设置冲掉
        saveBoundsConfig({
          'desktopLyric.x': bounds.x,
          'desktopLyric.y': bounds.y,
        })
      } else {
        isWinBoundsUpdateing = true
      }
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
    /**
     * 歌词条 / 灵动岛的宽高**不是**用户手动拖出来的，而是由设置推导：
     *   · 歌词条宽度 = desktopLyric.width（用户设定，可能被工作区裁切）
     *   · 灵动岛宽高 = 收起/展开尺寸 + 内容自适应
     * 如果在这里把实际尺寸写回 desktopLyric.width/height，
     * 就会互相覆盖：进一次灵动岛、或岛展开一次，歌词条的宽度设置就被改成岛/卡片的宽度，
     * 切回歌词条时表现为"宽度被重置"（用户反馈）。
     * 只有常规歌词窗口（可自由拖动缩放的矩形窗）才需要持久化宽高。
     */
    isWinBoundsUpdateing = true
    if (isTaskbarMode || isIslandMode) return
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
  // Luminous Harmonic: 灵动岛模式 — 药丸形态, 由自己管理几何(贴边吸附 + 显示器跟随)
  isIslandMode = global.lx.appSetting['desktopLyric.mode'] == 'island'
  if (isTaskbarMode) {
    const taskbarBounds = getTaskbarBounds(width || 520, {
      x: x ?? 0,
      y: y ?? 0,
    })
    x = taskbarBounds.x
    y = taskbarBounds.y
    width = taskbarBounds.width
    height = taskbarBounds.height
  } else if (isIslandMode) {
    // 已有保存位置且该位置仍在某个显示器可见区内 → 沿用；否则复位到停靠位
    const savedVisible = x != null && y != null && screen.getAllDisplays().some(d => {
      const a = d.workArea
      const w = global.lx.appSetting['desktopLyric.island.width'] ?? 420
      const h = global.lx.appSetting['desktopLyric.island.height'] ?? 44
      return x! < a.x + a.width && x! + w > a.x && y! < a.y + a.height && y! + h > a.y
    })
    const islandBounds = getIslandBounds()
    if (!savedVisible) {
      x = islandBounds.x
      y = islandBounds.y
    }
    width = islandBounds.width
    height = islandBounds.height
  }
  // let { width: screenWidth, height: screenHeight } = global.envParams.workAreaSize
  const winSize = (isTaskbarMode || isIslandMode)
    ? { x: x ?? 0, y: y ?? 0, width: width ?? minWidth, height: height ?? minHeight }
    : initWindowSize(x, y, width, height)
  global.lx.event_app.update_config({
    'desktopLyric.x': winSize.x,
    'desktopLyric.y': winSize.y,
    // 歌词条 / 灵动岛的宽高由设置推导（或自身管理），**不能**用实际窗口尺寸回写：
    // 否则进一次灵动岛就会把 desktopLyric.width 改成胶囊宽度，切回歌词条时宽度被重置。
    ...(isTaskbarMode || isIslandMode
      ? {}
      : { 'desktopLyric.width': winSize.width, 'desktopLyric.height': winSize.height }),
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
    alwaysOnTop: isTaskbarMode || isIslandMode || isAlwaysOnTop,
    skipTaskbar: isTaskbarMode || isIslandMode || !isShowTaskbar,
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
  // Luminous Harmonic: 灵动岛 — 透明窗不能 resize, 且要保持最高置顶;
  // 即便用户没开「总是置顶」也必须置顶, 否则岛会被其他窗口盖住而失去意义
  if (isIslandMode) {
    browserWindow.setResizable(false)
    browserWindow.setAlwaysOnTop(true, 'screen-saver')
  }

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
