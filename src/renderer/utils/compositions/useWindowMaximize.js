import { ref, shallowRef } from '@common/utils/vueTools'
import { setWindowBounds } from '@renderer/utils/ipc'
import { appSetting } from '@renderer/store/setting'
import { windowSizeList } from '@common/config'

// Luminous Harmonic: 单一可信源 — max 按钮 与 顶栏双击 共用同一份"伪最大化"状态.
// 否则两者各自维护 isMaximized, 双击放大后按钮 icon 不会切到"还原", 状态会错乱.
//
// 关键: prevBounds 必须用 shallowRef. ref() 会把普通对象包成 Vue 响应式 Proxy,
// ipcRenderer.send 走结构化克隆, Proxy 不可克隆 → 报 "An object could not be cloned".
// shallowRef 不深代理, .value 仍是原始普通对象, 可以正常 IPC 传过去.
const isMaximized = ref(false)
const prevBounds = shallowRef(null)

const getPreset = () => {
  const id = appSetting['common.windowSizeId']
  return windowSizeList.find(s => s.id === id) ?? windowSizeList[3]
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
  const toggleMaximize = () => {
    if (!isMaximized.value) {
      // 当前未最大化: 把窗口铺满整个屏幕工作区 (伪最大化)
      const sw = window.screen.availWidth || 1707
      const sh = window.screen.availHeight || 1019
      // 记住"上次的 preset 大小", 还原时用
      const preset = getPreset()
      prevBounds.value = centerBounds(preset.width, preset.height)
      isMaximized.value = true
      setWindowBounds({ x: 0, y: 0, width: sw, height: sh })
    } else {
      // 当前已是最大化: 还原到 preset 大小并居中
      isMaximized.value = false
      const target = prevBounds.value ?? centerBounds(getPreset().width, getPreset().height)
      setWindowBounds(target)
    }
  }

  return { isMaximized, prevBounds, toggleMaximize, centerBounds, getPreset }
}
