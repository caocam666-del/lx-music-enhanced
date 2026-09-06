import { ref } from '@common/utils/vueTools'
import { rendererInvoke } from '@common/rendererIpc'
import { setWindowBounds } from '@renderer/utils/ipc'
import { WIN_MAIN_RENDERER_EVENT_NAME } from '@common/ipcNames'
import { windowSizeList } from '@common/config'
import { appSetting } from '@renderer/store/setting'

// Luminous Harmonic: 原生最大化/还原 —
// 窗口已开启 resizable/maximizable (此前 false 导致只能 setWindowBounds 伪最大化,
// 最大化后四周因 body padding 留白), 现走系统原生 maximize/unmaximize:
// 完全覆盖工作区无留白, 且拖动区双击最大化(系统行为)与本状态保持一致。
// isMaximized 由窗口尺寸变化维护, 供最大化按钮 icon 与 maximized 布局样式共用。
const isMaximized = ref(false)

const applyMaximizedClass = (v) => {
  document.documentElement.classList.toggle('lx-maximized', v)
}

const refreshMaximized = () => {
  // 原生最大化时窗口宽度 == 工作区宽度 (frameless 无边框无标题栏占位)
  const maximized = window.innerWidth >= window.screen.availWidth - 2
  if (isMaximized.value != maximized) {
    isMaximized.value = maximized
    applyMaximizedClass(maximized)
  }
}

let inited = false
const initMaximizeWatcher = () => {
  if (inited) return
  inited = true
  window.addEventListener('resize', refreshMaximized)
  refreshMaximized()
}

const getPreset = () => {
  const id = appSetting['common.windowSizeId']
  return windowSizeList.find(s2 => s2.id === id) ?? windowSizeList[3]
}

const centerBounds = (w, h) => {
  const sw = window.screen.availWidth || 1707
  const sh = window.screen.availHeight || 1019
  return {
    x: Math.max(0, Math.round((sw - w) / 2)),
    y: Math.max(0, Math.round((sh - h) / 2)),
    width: w,
    height: h,
  }
}

export const useWindowMaximize = () => {
  initMaximizeWatcher()
  const toggleMaximize = () => {
    if (isMaximized.value) {
      // 原生 unmaximize 在透明无边框窗口上不可靠, 显式还原到 preset 尺寸居中
      const preset = getPreset()
      setWindowBounds(centerBounds(preset.width, preset.height))
    } else {
      // 最大化走原生 maximize(): 完全覆盖工作区, 无 padding 留白
      rendererInvoke(WIN_MAIN_RENDERER_EVENT_NAME.max_toggle).catch(() => {})
    }
  }

  return { isMaximized, toggleMaximize }
}
