<template>
  <div :class="[$style.content, { [$style.paused]: !isPlay }]">
    <canvas ref="dom_canvas" :class="$style.canvas" />
  </div>
</template>

<script>
import { ref, onBeforeUnmount, onMounted, watch } from '@common/utils/vueTools'
import { useEvent, getAnalyserDataArray } from '@lyric/core/mainWindowChannel'
import { onThemeChange } from '@lyric/utils/ipc'
import { isPlay, setting } from '@lyric/store/state'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const parseColor = value => {
  const hex = value?.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const full = hex[1].length == 3 ? hex[1].split('').map(item => item + item).join('') : hex[1]
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const rgb = value?.match(/[\d.]+/g)
  return rgb?.length >= 3 ? rgb.slice(0, 3).map(Number) : null
}

const mixColor = (color, target, amount) => color.map((value, index) => Math.round(value + (target[index] - value) * amount))
const rgba = (color, alpha) => `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`

export default {
  setup() {
    const dom_canvas = ref(null)

    let ctx
    let WIDTH = 0
    let HEIGHT = 0
    let pointCount = 0
    let pixelRatio = 1
    let isPlaying = false
    let isDocumentHidden = document.hidden
    let animationFrameId
    let smoothedHeights = []
    let lastDataArray = null
    let phase = 0

    const themeColors = {
      base: [74, 142, 255],
      accent: [74, 142, 255],
      glow: [74, 142, 255],
    }

    const readThemeColors = () => {
      const style = getComputedStyle(document.documentElement)
      const read = (name, fallback, directName) => {
        let value = style.getPropertyValue(name).trim()
        if (!value || value.startsWith('var(')) value = style.getPropertyValue(directName).trim()
        return value || fallback
      }
      themeColors.base = parseColor(read('--lyric-visualizer-base', 'rgb(74, 142, 255)', '--color-primary-alpha-700')) ?? themeColors.base
      themeColors.accent = parseColor(read('--lyric-visualizer-accent', 'rgb(74, 142, 255)', '--color-primary')) ?? themeColors.accent
      themeColors.glow = parseColor(read('--lyric-visualizer-glow', 'rgb(74, 142, 255)', '--color-primary-alpha-600')) ?? themeColors.glow
    }

    const removeThemeListener = onThemeChange(() => {
      window.requestAnimationFrame(() => {
        readThemeColors()
        if (lastDataArray) renderFrame(lastDataArray)
      })
    })

    useEvent((event) => {
      if (event.action == 'send_analyser_data_array') renderFrame(event.data)
    })

    const getVisualRange = style => {
      const preferredLeft = style == 'candle' ? 10 : 12
      const left = Math.min(Math.max(12, preferredLeft), Math.max(12, WIDTH - 54))
      return { left, right: Math.max(left + 20, WIDTH - Math.min(12, WIDTH * 0.04)) }
    }

    const getAudioValue = (dataArray, index, count) => {
      const sampleStart = Math.floor((index / count) * (dataArray.length * 0.72)) + 8
      const sampleEnd = Math.min(dataArray.length, sampleStart + 5)
      let energy = 0
      for (let sample = sampleStart; sample < sampleEnd; sample++) energy += dataArray[sample]
      return energy / Math.max(1, sampleEnd - sampleStart) / 255
    }

    const drawAvLine = (dataArray, left, right, centerY, colors) => {
      const lineCount = clamp(Math.floor((right - left) / 8), 48, 128)
      const slotWidth = (right - left) / lineCount
      const lineWidth = clamp(slotWidth * 0.34, 1.5, 3.5)
      const maxHeight = setting['desktopLyric.mode'] == 'bar'
        ? Math.max(8, Math.min(HEIGHT * 0.42, 34))
        : Math.max(5, Math.min(HEIGHT * 0.34, 16))
      const lineGradient = ctx.createLinearGradient(left, 0, right, 0)
      lineGradient.addColorStop(0, rgba(colors.base, 0.66))
      lineGradient.addColorStop(0.5, rgba(colors.accent, 0.94))
      lineGradient.addColorStop(1, rgba(colors.base, 0.66))

      ctx.lineCap = 'round'
      ctx.strokeStyle = lineGradient
      ctx.lineWidth = lineWidth
      ctx.shadowColor = rgba(colors.glow, 0.34)
      ctx.shadowBlur = 4
      for (let index = 0; index < lineCount; index++) {
        const progress = index / Math.max(1, lineCount - 1)
        const energy = getAudioValue(dataArray, index, lineCount)
        const previous = smoothedHeights[index] ?? energy
        const value = previous * 0.78 + energy * 0.22
        smoothedHeights[index] = value
        const envelope = Math.pow(Math.sin(Math.PI * progress), 0.72)
        const height = Math.max(1.5, maxHeight * (0.025 + envelope * (0.08 + value * 0.92)))
        const x = left + (right - left) * progress
        ctx.beginPath()
        ctx.moveTo(x, centerY - height)
        ctx.lineTo(x, centerY + height)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      ctx.strokeStyle = rgba(colors.accent, 0.24)
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(left, centerY)
      ctx.lineTo(right, centerY)
      ctx.stroke()
    }

    const drawSoftWave = (dataArray, left, right, centerY, colors) => {
      const points = []
      for (let index = 0; index < pointCount; index++) {
        const progress = pointCount == 1 ? 0 : index / (pointCount - 1)
        const energy = getAudioValue(dataArray, index, pointCount)
        const previous = smoothedHeights[index] ?? energy
        const value = previous * 0.82 + energy * 0.18
        smoothedHeights[index] = value
        points.push({
          x: left + (right - left) * progress,
          height: setting['desktopLyric.mode'] == 'bar'
            ? Math.max(2, Math.min(HEIGHT * 0.28, HEIGHT * (0.04 + value * 0.32)))
            : Math.max(3, Math.min(HEIGHT * 0.28, HEIGHT * (0.05 + value * 0.42))),
        })
      }
      const gradient = ctx.createLinearGradient(left, 0, right, 0)
      gradient.addColorStop(0, rgba(colors.base, 0.68))
      gradient.addColorStop(0.5, rgba(colors.accent, 0.9))
      gradient.addColorStop(1, rgba(colors.base, 0.68))
      const drawLine = offset => {
        ctx.beginPath()
        points.forEach((point, index) => {
          const y = centerY + offset * point.height
          if (index == 0) ctx.moveTo(point.x, y)
          else {
            const previous = points[index - 1]
            const middleX = (previous.x + point.x) / 2
            ctx.quadraticCurveTo(previous.x, centerY + offset * previous.height, middleX, (centerY + offset * previous.height + y) / 2)
            ctx.quadraticCurveTo(point.x, y, point.x, y)
          }
        })
        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.35
        ctx.stroke()
      }
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.shadowColor = rgba(colors.glow, 0.3)
      ctx.shadowBlur = 4
      drawLine(-1)
      drawLine(1)
      ctx.globalAlpha = 0.34
      ctx.lineWidth = 0.8
      drawLine(0)
      ctx.globalAlpha = 1
      const waveHeadX = left + ((Math.sin(phase * 0.8) + 1) / 2) * (right - left)
      ctx.beginPath()
      ctx.arc(waveHeadX, centerY, setting['desktopLyric.mode'] == 'bar' ? 1.6 : 2.5, 0, Math.PI * 2)
      ctx.fillStyle = rgba(colors.accent, 0.68)
      ctx.shadowColor = rgba(colors.accent, 0.5)
      ctx.shadowBlur = 5
      ctx.fill()
      ctx.shadowBlur = 0
    }

    const drawOrbitDots = (dataArray, left, right, centerY, colors) => {
      const centerX = (left + right) / 2
      const radiusX = (right - left) * 0.46
      const radiusY = setting['desktopLyric.mode'] == 'bar'
        ? Math.max(5, Math.min(HEIGHT * 0.18, 14))
        : Math.max(5, Math.min(HEIGHT * 0.2, 18))
      const pulse = Math.sin(phase) * 0.14 + 1
      ctx.lineWidth = 1.2
      ctx.strokeStyle = rgba(colors.base, 0.38)
      ctx.shadowColor = rgba(colors.glow, 0.28)
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.ellipse(centerX, centerY, radiusX * pulse, radiusY * pulse, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0

      const dotCount = clamp(Math.floor((right - left) / 18), 14, 28)
      for (let index = 0; index < dotCount; index++) {
        const angle = index / dotCount * Math.PI * 2 + phase * 0.035
        const energy = getAudioValue(dataArray, index, dotCount)
        const size = 1.2 + energy * 2.4
        const orbitScale = 1 + energy * 0.14 + Math.sin(phase * 1.4 + index) * 0.025
        const x = centerX + Math.cos(angle) * radiusX * orbitScale
        const y = centerY + Math.sin(angle) * radiusY * orbitScale
        const color = mixColor(colors.base, colors.accent, (Math.sin(angle) + 1) / 2)
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = rgba(color, 0.42 + energy * 0.42)
        ctx.shadowColor = rgba(color, 0.45)
        ctx.shadowBlur = 5
        ctx.fill()
        if (energy > 0.34) {
          ctx.beginPath()
          ctx.arc(x - Math.cos(angle) * 4, y - Math.sin(angle) * 4, size * 0.38, 0, Math.PI * 2)
          ctx.fillStyle = rgba(color, 0.3)
          ctx.fill()
        }
      }
      ctx.shadowBlur = 0
    }

    const drawCandleBars = (dataArray, left, right, colors) => {
      const barCount = clamp(Math.floor((right - left) / 16), 28, 72)
      const slotWidth = (right - left) / barCount
      const candleWidth = clamp(slotWidth * 0.62, 4, 9)
      const baseline = HEIGHT - Math.max(2, HEIGHT * 0.035)
      const maxHeight = setting['desktopLyric.mode'] == 'bar'
        ? Math.max(8, HEIGHT * 0.48)
        : Math.max(8, Math.min(HEIGHT * 0.18, 28))
      const baseGradient = ctx.createLinearGradient(left, 0, right, 0)
      baseGradient.addColorStop(0, rgba(colors.base, 0.52))
      baseGradient.addColorStop(0.5, rgba(colors.accent, 0.8))
      baseGradient.addColorStop(1, rgba(colors.base, 0.52))

      ctx.fillStyle = rgba(colors.base, 0.22)
      ctx.fillRect(left, baseline, right - left, 1)
      for (let index = 0; index < barCount; index++) {
        const energy = getAudioValue(dataArray, index, barCount)
        const previous = smoothedHeights[index] ?? energy
        const value = previous * 0.8 + energy * 0.2
        smoothedHeights[index] = value
        const height = Math.max(2.5, maxHeight * (0.08 + value * 0.92))
        const x = left + slotWidth * (index + 0.5) - candleWidth / 2
        const y = baseline - height
        const color = mixColor(colors.base, colors.accent, index / Math.max(1, barCount - 1))
        ctx.beginPath()
        ctx.rect(x, y, candleWidth, height)
        ctx.fillStyle = baseGradient
        ctx.shadowColor = rgba(color, 0.3)
        ctx.shadowBlur = value > 0.36 ? 4 : 1
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    const renderFrame = (dataArray) => {
      if (!ctx || !WIDTH || !HEIGHT || !dataArray?.length || !pointCount) return
      lastDataArray = dataArray

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const style = setting['desktopLyric.audioVisualizationStyle'] || 'wave'
      const { left, right } = getVisualRange(style)
      const isBarMode = setting['desktopLyric.mode'] == 'bar'
      const visualBandHeight = Math.max(14, Math.min(HEIGHT * 0.25, 28))
      const centerY = style == 'candle' && isBarMode ? HEIGHT - visualBandHeight / 2 - 1 : HEIGHT * 0.5
      const softBase = mixColor(themeColors.base, [255, 255, 255], 0.52)
      const softAccent = mixColor(themeColors.accent, [255, 255, 255], 0.48)
      const colors = { base: softBase, accent: softAccent, glow: themeColors.glow }
      phase += isPlaying ? 0.12 : 0.02
      if (style == 'bars') drawAvLine(dataArray, left, right, centerY, colors)
      else if (style == 'orbit') drawOrbitDots(dataArray, left, right, centerY, colors)
      else if (style == 'candle') drawCandleBars(dataArray, left, right, colors)
      else drawSoftWave(dataArray, left, right, centerY, colors)

      animationFrameId = null
      if (isPlaying && !isDocumentHidden) animationFrameId = window.requestAnimationFrame(getAnalyserDataArray)
    }

    const handlePlay = () => {
      isPlaying = true
      readThemeColors()
      getAnalyserDataArray()
    }

    const handlePause = () => {
      if (animationFrameId) window.cancelAnimationFrame(animationFrameId)
      isPlaying = false
    }

    const handleResize = () => {
      const canvas = dom_canvas.value
      if (!canvas) return
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      WIDTH = canvas.clientWidth
      HEIGHT = canvas.clientHeight
      canvas.width = Math.max(1, Math.round(WIDTH * pixelRatio))
      canvas.height = Math.max(1, Math.round(HEIGHT * pixelRatio))
      ctx?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      pointCount = clamp(Math.floor(WIDTH / 14), 28, 52)
      smoothedHeights = []
    }

    watch(isPlay, value => {
      if (value) handlePlay()
      else handlePause()
    })
    watch(() => setting['desktopLyric.audioVisualization'], enable => {
      if (!enable) handlePause()
    })
    watch(() => setting['desktopLyric.audioVisualizationStyle'], () => {
      smoothedHeights = []
      if (lastDataArray) renderFrame(lastDataArray)
    })

    window.addEventListener('resize', handleResize)
    const handleVisibilityChange = () => {
      isDocumentHidden = document.hidden
      if (isDocumentHidden) {
        if (animationFrameId) window.cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      } else if (isPlaying) {
        getAnalyserDataArray()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    onBeforeUnmount(() => {
      handlePause()
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      removeThemeListener()
    })

    onMounted(() => {
      const canvas = dom_canvas.value
      ctx = canvas.getContext('2d')
      handleResize()
      readThemeColors()
      if (isPlay.value) handlePlay()
    })

    return {
      dom_canvas,
      isPlay,
    }
  },
}
</script>

<style lang="less" module>
.content {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: -1;
  opacity: .88;
  transition: opacity .3s ease;
}

.paused {
  opacity: 0;
}

.canvas {
  width: 100%;
  height: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .content { transition: none; }
}
</style>
