import { watch, onBeforeUnmount } from '@common/utils/vueTools'
import { getAnalyser } from '@renderer/plugins/player'
import { isPlay, isShowPlayerDetail } from '@renderer/store/player/state'

// Luminous Harmonic: 「节奏律动」— 移植 Pure-music AudioReactiveFlow 的呼吸响应.
//
// Pure-music 原参数 (flowing_light_background.dart):
//   breathingScale = 1 + audioLevel * 0.09 + bassTransient * 0.26   (clamp 1.0 ~ 1.30)
//   audioLevel 为低频能量包络 (快攻慢放), bassTransient 为低频瞬态脉冲.
//   三层流光纹理以该系数整体缩放 → 光斑随鼓点明显胀缩, 这就是"律动"的可见来源.
//
// 这里把系数写进 --flow-scale, 由 .flowTex 的 rotate keyframes 以
// scale(var(--flow-scale)) 引用 (纹理本身已重度模糊, 缩放不会露出封面结构).
// 另叠加轻微亮度脉动 (--flow-breath) 增强观感.
//
// 性能: 每帧写 CSS 变量会触发全文档样式重算, 是"卡顿"的来源 —
// 目标 30fps + 量化到 3 位小数, 值未变化时跳过写入.
const TARGET_FPS = 30
const FRAME_MS = 1000 / TARGET_FPS
// Pure-music 幅度: 能级 0.09 / 瞬态 0.26, 上限 1.30 (整体放大 30% = 明显律动)
const LEVEL_GAIN = 0.09
const TRANSIENT_GAIN = 0.26
const SCALE_MAX = 1.3

export default (enabled) => {
  let rafId = 0
  let analyser = null
  let dataArray = null
  let smoothLevel = 0
  let transient = 0
  let lastBass = 0
  let running = false
  let lastFrameTs = 0
  let lastScale = ''
  let lastBreath = ''

  const tick = (ts) => {
    rafId = requestAnimationFrame(tick)
    if (document.hidden) return
    // 详情页未打开时完全跳过 (每帧写变量会触发全文档样式重算)
    if (!isShowPlayerDetail.value) return
    if (ts - lastFrameTs < FRAME_MS - 1) return
    lastFrameTs = ts

    if (!analyser) {
      analyser = getAnalyser()
      if (analyser && (!dataArray || dataArray.length !== analyser.frequencyBinCount)) {
        dataArray = new Uint8Array(analyser.frequencyBinCount)
      }
    }
    let level = 0
    if (analyser && dataArray && isPlay.value) {
      analyser.getByteFrequencyData(dataArray)
      // 低频段 (bass) 能量: 前 8% bins
      const bassEnd = Math.max(4, Math.floor(dataArray.length * 0.08))
      let sum = 0
      for (let i = 0; i < bassEnd; i++) sum += dataArray[i]
      const bass = sum / bassEnd / 255
      // 瞬态: 低频正向跳变, 快攻 (立即取较大值) 慢放 (每帧 ×0.88)
      transient = Math.max(transient * 0.88, Math.max(0, bass - lastBass) * 5)
      if (transient > 1) transient = 1
      lastBass = bass
      // 能级包络: 更快跟随 (0.25), 鼓点一响流光立刻起反应, 不再是"慢半拍"
      smoothLevel += (bass - smoothLevel) * 0.25
      level = smoothLevel
    } else {
      smoothLevel *= 0.9
      transient *= 0.86
    }

    // Pure-music 呼吸系数
    const scale = Math.min(SCALE_MAX, 1 + Math.max(0, level) * LEVEL_GAIN + transient * TRANSIENT_GAIN)
    // 亮度脉动: 静止 0.9, 峰值 1.0 (辅助观感, 不喧宾夺主)
    const breath = Math.min(1, 0.9 + (scale - 1) * 0.4)

    const scaleStr = scale.toFixed(3)
    const breathStr = breath.toFixed(3)
    const root = document.documentElement
    if (scaleStr !== lastScale) {
      lastScale = scaleStr
      root.style.setProperty('--flow-scale', scaleStr)
    }
    if (breathStr !== lastBreath) {
      lastBreath = breathStr
      root.style.setProperty('--flow-breath', breathStr)
    }
  }

  const start = () => {
    if (running) return
    running = true
    lastFrameTs = 0
    rafId = requestAnimationFrame(tick)
  }
  const stop = () => {
    if (!running) return
    running = false
    cancelAnimationFrame(rafId)
    const root = document.documentElement
    root.style.removeProperty('--flow-scale')
    root.style.removeProperty('--flow-breath')
    lastScale = ''
    lastBreath = ''
  }

  watch(enabled, (on) => { on ? start() : stop() }, { immediate: true })
  onBeforeUnmount(stop)
}
