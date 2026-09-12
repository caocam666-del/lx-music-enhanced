import { watch, onBeforeUnmount } from '@common/utils/vueTools'
import { getAnalyser } from '@renderer/plugins/player'
import { isPlay, isShowPlayerDetail } from '@renderer/store/player/state'

// Luminous Harmonic: 「节奏律动」— 移植 Pure-music AudioReactiveFlow 的呼吸响应:
//   brightness 脉动 = 0.85 + (breath - 1) * 2, breath = 1 + level*0.05 + transient*0.15
// 低频能级快攻慢放 (envelope), 瞬态 = 低频正 flux. 每帧只写一个 CSS 变量
// --flow-breath, .bgFlow 的 opacity 以 var() 引用 — 仅亮度脉动, 无几何抖动.
// 仅在详情页打开时运行 (isVisible), 详情页关闭时完全跳过, 避免无谓的样式重算.
export default (enabled) => {
  let rafId = 0
  let analyser = null
  let dataArray = null
  let smoothLevel = 0
  let transient = 0
  let lastBass = 0
  let running = false
  let lastWritten = ''

  const tick = () => {
    rafId = requestAnimationFrame(tick)
    if (document.hidden) return
    // Luminous Harmonic: 详情页未打开时完全跳过 — 每帧写 CSS 变量会触发全文档
    // 样式重算, 拖慢歌词切换动画 (用户反馈"节奏律动模式下歌词上浮卡顿")
    if (!isShowPlayerDetail.value) return
    if (!analyser) {
      analyser = getAnalyser()
      if (analyser && (!dataArray || dataArray.length !== analyser.frequencyBinCount)) {
        dataArray = new Uint8Array(analyser.frequencyBinCount)
      }
    }
    let level = 0
    if (analyser && dataArray && isPlay.value) {
      analyser.getByteFrequencyData(dataArray)
      // 低频段 (bass): 前 8% bins 均值
      const bassEnd = Math.max(4, Math.floor(dataArray.length * 0.08))
      let sum = 0
      for (let i = 0; i < bassEnd; i++) sum += dataArray[i]
      const bass = sum / bassEnd / 255
      // 瞬态: 低频正 flux, 快攻慢放
      transient = Math.min(1, Math.max(0, Math.max(transient * 0.9, (bass - lastBass) * 4)))
      lastBass = bass
      smoothLevel += (bass - smoothLevel) * 0.15
      level = smoothLevel
    } else {
      // 暂停: 能级/瞬态自然衰减回 1
      smoothLevel *= 0.92
      transient *= 0.88
    }
    // 幅度较 Pure-music 收敛一半 (0.05/0.15, cap 1.18): 原版比例在整屏色场上观感过强
    const breath = Math.min(1.18, 1 + Math.max(0, level) * 0.05 + transient * 0.15)
    const next = breath.toFixed(4)
    // Luminous Harmonic: 值未变化时跳过写入 (每帧无效写会浪费样式重算, 拖慢歌词动画)
    if (next === lastWritten) return
    lastWritten = next
    document.documentElement.style.setProperty('--flow-breath', next)
  }

  const start = () => {
    if (running) return
    running = true
    rafId = requestAnimationFrame(tick)
  }
  const stop = () => {
    if (!running) return
    running = false
    cancelAnimationFrame(rafId)
    document.documentElement.style.removeProperty('--flow-breath')
  }

  watch(enabled, (on) => { on ? start() : stop() }, { immediate: true })
  onBeforeUnmount(stop)
}
