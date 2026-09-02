<template>
  <div :class="$style.content" aria-hidden="true">
    <canvas ref="dom_canvas" :class="$style.canvas" />
  </div>
</template>

<script>
import { ref, computed, onBeforeUnmount, onMounted, watch } from '@common/utils/vueTools'
import { getAnalyser } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'

// Luminous Harmonic: 环形频谱 v2 — Canvas 径向镜像频谱 (Radial Audio Player 风格)
// - 72 条镜像对称圆角频谱条围绕封面辐射 (左右镜像, 安静时也保持对称美感)
// - 双层绘制: 辉光层(宽/低透明) + 亮芯层, 低频驱动整体呼吸脉冲, 播放中缓慢旋转
// - accent 颜色 300ms 节流缓存; 暂停衰减; document.hidden 停帧

const HALF_BARS = 36
const COLOR = [110, 157, 255]

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`
const mix = (s, t, amt) => s.map((v, i) => Math.round(v + (t[i] - v) * amt))

export default {
  props: {
    // 容器大小 (px), 由 PlayDetail 传入 = artworkSize + 72
    size: {
      type: Number,
      default: 380,
    },
    // 频谱条起点占半径比例
    innerRadiusRatio: {
      type: Number,
      default: 0.85,
    },
  },
  setup(props) {
    const dom_canvas = ref(null)
    let animationFrameId = 0
    let analyser = null
    let dataArray = null
    let isDocumentHidden = document.hidden
    const smoothed = new Float32Array(HALF_BARS)
    const peakHold = new Float32Array(HALF_BARS)
    let rotation = 0
    let bassPulse = 0

    const innerR = computed(() => (props.size / 2) * props.innerRadiusRatio)
    const maxBarLen = computed(() => Math.max(2, props.size / 2 - 6 - innerR.value))

    // accent 颜色缓存 — getComputedStyle 每帧调用会强制样式重算
    let cachedAccentStr = null
    let cachedColorStr = null
    let cachedColors = null
    let lastColorSample = 0
    const resolveColors = (canvas) => {
      const now = Date.now()
      const style = getComputedStyle(canvas)
      const accentStr = style.getPropertyValue('--detail-accent-color').trim()
      const colorStr = style.color
      if (cachedColors && accentStr === cachedAccentStr && colorStr === cachedColorStr && now - lastColorSample < 300) {
        return cachedColors
      }
      cachedAccentStr = accentStr
      cachedColorStr = colorStr
      lastColorSample = now
      let base = COLOR
      if (accentStr && accentStr != 'none') {
        const m = accentStr.match(/[\d.]+/g)
        if (m && m.length >= 3) base = m.slice(0, 3).map(Number)
      } else {
        const m = colorStr.match(/[\d.]+/g)
        if (m && m.length >= 3) base = m.slice(0, 3).map(Number)
      }
      cachedColors = { color: base, bright: mix(base, [255, 255, 255], 0.55) }
      return cachedColors
    }

    let lastFitW = 0
    let lastFitH = 0
    const fitCanvas = () => {
      const cvs = dom_canvas.value
      if (!cvs) return
      const parent = cvs.parentElement
      if (!parent) return
      const dpr = window.devicePixelRatio || 1
      const w = parent.clientWidth || props.size
      const h = parent.clientHeight || props.size
      cvs.width = w * dpr
      cvs.height = h * dpr
      cvs.style.width = w + 'px'
      cvs.style.height = h + 'px'
      const ctx = cvs.getContext('2d')
      if (ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(dpr, dpr) }
      lastFitW = w
      lastFitH = h
    }

    const draw = () => {
      const cvs = dom_canvas.value
      if (!cvs) return
      // Luminous Harmonic: 自愈 — 详情页进出场动画期间 fitCanvas 可能测到过渡中的容器尺寸,
      // 画布与容器不一致会导致频谱整体偏移; 每帧比对, 不一致立即重新适配 (一帧内自愈)
      const parentEl = cvs.parentElement
      if (parentEl && (parentEl.clientWidth != lastFitW || parentEl.clientHeight != lastFitH)) fitCanvas()
      if (document.hidden) {
        animationFrameId = 0
        return
      }
      const ctx = cvs.getContext('2d')
      const dpr = window.devicePixelRatio || 1
      const w = cvs.width / dpr
      const h = cvs.height / dpr
      const playing = isPlay.value
      const cx = w / 2
      const cy = h / 2
      const inner = innerR.value
      const len = maxBarLen.value
      const { color, bright } = resolveColors(cvs)

      analyser = getAnalyser()
      if (analyser && (!dataArray || dataArray.length !== analyser.frequencyBinCount)) {
        dataArray = new Uint8Array(analyser.frequencyBinCount)
      }
      if (analyser) analyser.getByteFrequencyData(dataArray)

      // 更新平滑值 (镜像: 只算半数, 绘制时镜像)
      let bass = 0
      for (let i = 0; i < HALF_BARS; i++) {
        const t = i / HALF_BARS
        const bin = Math.floor(Math.pow(t, 0.7) * (dataArray?.length || HALF_BARS))
        const raw = dataArray ? dataArray[bin] / 255 : 0.02
        const target = Math.max(0.02, raw)
        smoothed[i] += (target - smoothed[i]) * (playing ? 0.28 : 0.08)
        if (!playing) smoothed[i] *= 0.8
        if (i < 8) bass += smoothed[i]
        peakHold[i] *= playing ? 1 : 0.85
        peakHold[i] = Math.max(peakHold[i] - 0.012, smoothed[i])
      }
      bass /= 8
      bassPulse += (bass - bassPulse) * 0.08
      if (playing) rotation += 0.0012

      const ringR = inner * (1 + bassPulse * 0.06)
      const bw = Math.max(1.6, (Math.PI * 2 * ringR / (HALF_BARS * 2)) * 0.42)
      const step = Math.PI / (HALF_BARS - 1)

      ctx.clearRect(0, 0, w, h)
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rotation)

      // 基础环 (极淡的结构圈)
      ctx.beginPath()
      ctx.arc(0, 0, ringR, 0, Math.PI * 2)
      ctx.strokeStyle = rgba(color, 0.16)
      ctx.lineWidth = 1
      ctx.stroke()

      // 双层镜像频谱条
      for (let i = 0; i < HALF_BARS; i++) {
        const value = Math.max(0.02, smoothed[i])
        const barLen = 3 + value * len
        const baseAngle = -Math.PI / 2 + i * step
        for (const angle of [baseAngle, -Math.PI / 2 - i * step]) {
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)
          const x1 = cos * ringR
          const y1 = sin * ringR
          const x2 = cos * (ringR + barLen)
          const y2 = sin * (ringR + barLen)
          // 辉光层
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.lineCap = 'round'
          ctx.strokeStyle = rgba(color, playing ? 0.22 : 0.12)
          ctx.lineWidth = bw * 2.6
          ctx.stroke()
          // 亮芯层 (低频更暖, 高频更亮)
          const heat = i / HALF_BARS
          const coreColor = mix(color, bright, heat * 0.7 + value * 0.3)
          ctx.strokeStyle = rgba(coreColor, playing ? 0.92 : 0.55)
          ctx.lineWidth = bw
          ctx.stroke()
        }
        // 峰值亮点
        if (peakHold[i] > 0.05) {
          for (const angle of [baseAngle, -Math.PI / 2 - i * step]) {
            const cos = Math.cos(angle)
            const sin = Math.sin(angle)
            ctx.beginPath()
            ctx.arc(cos * (ringR + peakHold[i] * len), sin * (ringR + peakHold[i] * len), 1.3, 0, Math.PI * 2)
            ctx.fillStyle = rgba(bright, 0.85)
            ctx.fill()
          }
        }
      }
      ctx.restore()

      animationFrameId = requestAnimationFrame(draw)
    }

    const handleVisibility = () => {
      isDocumentHidden = document.hidden
      if (!isDocumentHidden && isPlay.value && !animationFrameId) animationFrameId = requestAnimationFrame(draw)
    }

    const requestStaticFrame = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(draw)
    }

    watch(() => props.size, () => {
      fitCanvas()
      requestStaticFrame()
    })
    // Luminous Harmonic: 播放状态变化时重启绘制循环 — 否则切歌间隙 (playing=false) 循环停摆后
    // 无人重启, 环形频谱冻结 (用户反馈的切歌不动)
    watch(isPlay, (playing) => {
      if (playing && !isDocumentHidden && !animationFrameId) animationFrameId = requestAnimationFrame(draw)
      if (!playing) requestStaticFrame()
    })

    onMounted(() => {
      document.addEventListener('visibilitychange', handleVisibility)
      fitCanvas()
      animationFrameId = requestAnimationFrame(draw)
    })

    onBeforeUnmount(() => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      document.removeEventListener('visibilitychange', handleVisibility)
      analyser = null
      dataArray = null
    })

    return {
      dom_canvas,
    }
  },
}
</script>

<style lang="less" module>
.content {
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: block;
}
.canvas {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
