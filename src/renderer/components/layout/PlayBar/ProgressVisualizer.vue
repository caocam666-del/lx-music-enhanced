<template>
  <canvas ref="canvas" :class="$style.visualizer" />
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from '@common/utils/vueTools'
import { getAnalyser } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'

const props = defineProps({
  dynamicColor: { type: Boolean, default: false },
  visualizerHeight: { type: Number, default: 0 },
  variant: { type: String, default: 'default' },
})

const canvas = ref(null)
let animId = 0
let resizeObserver = null
let analyser = null
let dataArray = null
let bufferLength = 0
let isDocumentHidden = document.hidden

// 粒子系统
const particles = []
const PARTICLE_COUNT = 35
const parseColor = (value) => {
  const numbers = value.match(/[\d.]+/g)
  if (numbers && numbers.length >= 3) return numbers.slice(0, 3).map(Number)
  if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(value)) {
    const hex = value.slice(1)
    const full = hex.length === 3 ? hex.split('').map((item) => item + item).join('') : hex
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  return [74, 142, 255]
}
const mixColor = (color, target, amount) => color.map((value, index) => Math.round(value + (target[index] - value) * amount))
const rgba = (color, alpha) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`

const initParticles = (w, h) => {
  particles.length = 0
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.7) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.25 + 0.05,
      life: Math.random() * 300 + 100,
      age: Math.random() * 200,
    })
  }
}

// Luminous Harmonic: 频谱能量数组复用（上限 40 条, 按需扩容; 原每帧 new Array 分配）
let _barData = new Array(40).fill(0)
const ensureBarData = bars => {
  if (_barData.length < bars) _barData = new Array(bars).fill(0)
  return _barData
}

// Luminous Harmonic: 主题色缓存 — getComputedStyle 每帧 2 次强制样式重算,
// 改为 ≥300ms 节流: accent var 与 color 串都没变就复用上次解析结果
let _cachedAccentVar = null
let _cachedColorStr = null
let _cachedThemeColor = null
let _lastColorSample = 0
const resolveColors = cvs => {
  const now = Date.now()
  const style = getComputedStyle(cvs)
  const accentVar = style.getPropertyValue('--detail-accent-color').trim()
  const colorStr = style.color
  if (_cachedThemeColor && accentVar === _cachedAccentVar && colorStr === _cachedColorStr && now - _lastColorSample < 300) {
    return { themeColor: _cachedThemeColor }
  }
  _cachedAccentVar = accentVar
  _cachedColorStr = colorStr
  _lastColorSample = now
  _cachedThemeColor = accentVar ? parseColor(accentVar) : parseColor(colorStr)
  return { themeColor: _cachedThemeColor }
}

const draw = () => {
  const cvs = canvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  const w = cvs.clientWidth
  const h = cvs.clientHeight
  if (!w || !h) {
    animId = isPlay.value && !isDocumentHidden ? requestAnimationFrame(draw) : 0
    return
  }

  const isPlaying = isPlay.value
  if (!isPlaying || isDocumentHidden) {
    animId = 0
    return
  }

  // 获取频率数据
  analyser = getAnalyser()
  if (analyser && (!dataArray || bufferLength !== analyser.frequencyBinCount)) {
    bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)
  }
  if (analyser) analyser.getByteFrequencyData(dataArray)

  // 计算频率分组的能量 (32 bins -> 合并为视觉条数)
  const isMiddleVariant = props.variant === 'middle'
  const bars = isMiddleVariant ? 34 : 40
  // Luminous Harmonic: 复用数组 (原每帧 new Array 分配)
  const barData = ensureBarData(bars)
  const groupSize = Math.max(1, Math.floor(bufferLength / bars))
  for (let i = 0; i < bars; i++) {
    let sum = 0
    for (let j = 0; j < groupSize; j++) {
      const idx = i * groupSize + j
      if (idx < bufferLength) sum += dataArray[idx]
    }
    barData[i] = analyser ? sum / groupSize / 255 : 0.08 + Math.sin((i * 0.9) + Date.now() / 700) * 0.025
  }
  let bassEnergy = 0
  let trebleEnergy = 0
  const energyBand = Math.max(1, Math.floor(bars * 0.2))
  for (let i = 0; i < energyBand; i++) {
    bassEnergy += barData[i]
    trebleEnergy += barData[bars - energyBand + i]
  }
  bassEnergy /= energyBand
  trebleEnergy /= energyBand

  // === 底座光晕 ===
  // Keep the last rendered frame while the CSS opacity transition fades it out.
  ctx.clearRect(0, 0, w, h)
  // Luminous Harmonic: 详情页打开时读 accent (封面/主题色), 关闭时回退主题色
  // (getComputedStyle 每帧 2 次会强制样式重算 → 改为 ≥300ms 节流缓存, 色串没变直接复用)
  const colors = resolveColors(cvs)
  const themeColor = colors.themeColor
  const lowColor = props.dynamicColor ? mixColor(themeColor, [72, 202, 255], Math.min(0.72, bassEnergy * 0.72)) : themeColor
  const softColor = props.dynamicColor
    ? mixColor([126, 132, 246], [255, 104, 184], Math.min(0.72, trebleEnergy * 0.72))
    : mixColor(themeColor, [255, 255, 255], 0.25)
  const brightColor = mixColor(props.dynamicColor ? softColor : themeColor, [255, 255, 255], 0.55)
  if (isPlaying && !isMiddleVariant) {
    const glowGrad = ctx.createLinearGradient(0, 0, 0, h)
    glowGrad.addColorStop(0, rgba(lowColor, 0.06))
    glowGrad.addColorStop(0.5, rgba(softColor, 0.035))
    glowGrad.addColorStop(1, rgba(softColor, 0.1))
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 0, w, h)
  }

  // === 粒子背景 ===
  const isPaused = !isPlaying
  if (!isMiddleVariant) {
    for (const p of particles) {
      p.age++
      if (p.age > p.life) {
        p.x = Math.random() * w
        p.y = h + 5
        p.age = 0
        p.life = Math.random() * 300 + 100
        p.vx = (Math.random() - 0.5) * 0.4
        p.vy = -(Math.random() * 0.6 + 0.1)
      }
      if (!isPaused) {
        p.x += p.vx
        p.y += p.vy
      }
      if (p.x < 0) p.x = w
      if (p.x > w) p.x = 0
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = rgba(mixColor(themeColor, brightColor, (Math.sin(p.age * 0.05) + 1) / 2), p.alpha)
      ctx.fill()
    }
  }

  // === 频率律动条 ===
  const gap = isMiddleVariant ? Math.max(3, w / 70) : 2
  const waveWidth = isMiddleVariant ? w * 0.94 : w - 8
  const waveLeft = isMiddleVariant ? (w - waveWidth) / 2 : 4
  const barWidth = (waveWidth - (bars - 1) * gap) / bars
  const maxBarHeight = isMiddleVariant ? h * 0.82 : h * 0.85

  for (let i = 0; i < bars; i++) {
    const v = barData[i]
    if (isMiddleVariant) {
      const position = bars === 1 ? 0.5 : i / (bars - 1)
      const edgeFade = Math.pow(Math.sin(Math.PI * position), 0.72)
      const centerLift = 0.72 + Math.exp(-Math.pow((position - 0.5) / 0.28, 2)) * 0.28
      const barH = Math.max(2, (0.12 + v * 0.72) * maxBarHeight * edgeFade * centerLift)
      const x = waveLeft + i * (barWidth + gap) + barWidth / 2
      const alpha = 0.16 + edgeFade * 0.62
      const color = mixColor(lowColor, softColor, position)
      const centerY = h / 2

      ctx.beginPath()
      ctx.moveTo(x, centerY - barH)
      ctx.lineTo(x, centerY + barH)
      ctx.lineCap = 'round'
      ctx.lineWidth = Math.max(1.5, Math.min(3, barWidth * 0.78))
      ctx.strokeStyle = rgba(color, alpha)
      ctx.shadowColor = rgba(color, 0.3)
      ctx.shadowBlur = barH > maxBarHeight * 0.45 ? 3 : 0
      ctx.stroke()
      ctx.shadowBlur = 0
      continue
    }
    // 平滑: 低频占比大, 高频占比小 + 更快的响应
    const freqRatio = i / bars // 0 = 低频, 1 = 高频
    const thickness = Math.max(1.5, (1 - freqRatio) * 3.5 + 1) // 低频更粗
    const barH = v * maxBarHeight * (0.6 + freqRatio * 0.4) // 整体高度
    const x = i * (barWidth + gap) + 4
    const y = h - barH - 2

    // 渐变: 低频青蓝 -> 高频亮蓝
    const grad = ctx.createLinearGradient(0, h, 0, y)
    grad.addColorStop(0, rgba(lowColor, 0.4 + v * 0.5))
    grad.addColorStop(0.5, rgba(softColor, 0.6 + v * 0.35))
    grad.addColorStop(1, rgba(brightColor, 0.2 + v * 0.25))

    ctx.fillStyle = grad

    // 圆角矩形
    const r = Math.min(barWidth / 2, thickness)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + barWidth - r, y)
    ctx.arcTo(x + barWidth, y, x + barWidth, y + r, r)
    ctx.lineTo(x + barWidth, h)
    ctx.lineTo(x, h)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
    ctx.fill()

    // 顶部高亮光点
    ctx.beginPath()
    ctx.arc(x + barWidth / 2, y, thickness * 0.8, 0, Math.PI * 2)
    ctx.fillStyle = rgba(brightColor, 0.3 + v * 0.6)
    ctx.fill()
  }

  animId = isPlay.value && !isDocumentHidden ? requestAnimationFrame(draw) : 0
}

const scheduleDraw = () => {
  if (!animId && isPlay.value && !isDocumentHidden) animId = requestAnimationFrame(draw)
}

const handleVisibilityChange = () => {
  isDocumentHidden = document.hidden
  if (isDocumentHidden) {
    if (animId) cancelAnimationFrame(animId)
    animId = 0
  } else {
    scheduleDraw()
  }
}

const resize = () => {
  const cvs = canvas.value
  if (!cvs) return
  const parent = cvs.parentElement
  if (!parent) return
  const dpr = window.devicePixelRatio || 1
  const w = parent.clientWidth
  const h = props.visualizerHeight || parent.clientHeight
  cvs.width = w * dpr
  cvs.height = h * dpr
  cvs.style.width = w + 'px'
  cvs.style.height = h + 'px'
  const ctx = cvs.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  initParticles(w, h)
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  if (typeof ResizeObserver !== 'undefined' && canvas.value?.parentElement) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value.parentElement)
  }
  scheduleDraw()
})

watch(isPlay, (playing) => {
  if (playing) scheduleDraw()
  else if (animId) {
    cancelAnimationFrame(animId)
    animId = 0
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  resizeObserver?.disconnect()
  if (animId) cancelAnimationFrame(animId)
})
</script>

<style lang="less" module>
.visualizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  border-radius: var(--lx-radius, 12px);
  overflow: hidden;
  // Luminous Harmonic: 详情页打开时跟随 accent (封面/主题色), 关闭回退主色
  color: var(--detail-accent-color, var(--color-primary, #4a8eff));
}
</style>
