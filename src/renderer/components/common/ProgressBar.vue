<template>
  <div :class="$style.progressWrap">
    <div :class="[$style.progress, className, { [$style.wave]: wave }]">
      <div :class="[$style.progressBar, $style.progressBar2, {[$style.barTransition]: isActiveTransition}]" :style="{ transform: `scaleX(${progress || 0})` }" @transitionend="handleTransitionEnd" />
      <div v-show="dragging" :class="[$style.progressBar, $style.progressBar3]" :style="{ transform: `scaleX(${dragProgress || 0})` }" />
      <svg v-if="wave" :class="$style.waveSvg" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
        <!-- 未播放段：直线 -->
        <line :class="$style.waveTrack" :x1="trackStartX" :y1="11" :x2="100" :y2="11" />
        <!-- 已播放段：相位驱动正弦波，画到进度点为止（Pure-music 原版做法，无 clip 无平移，不左移不溢出） -->
        <path ref="dom_wave_played" :class="[$style.waveLine, $style.waveLinePlayed]" :d="wavePath" />
        <path v-show="dragging" ref="dom_wave_drag" :class="[$style.waveLine, $style.waveLineDrag]" :d="wavePath" />
      </svg>
      <!-- 进度圆点：固定中线（Pure-music 的 thumb 也在 centerY） -->
      <div v-if="progress > 0" :class="$style.waveDot" :style="{ left: thumbX + '%', top: '50%' }">
        <span :class="$style.waveDotCore" />
      </div>
      <div v-if="dragging" :class="[$style.waveDot, $style.waveDotDrag]" :style="{ left: dragThumbX + '%', top: '50%' }">
        <span :class="$style.waveDotCore" />
      </div>
      <!-- 时间气泡：悬停/拖动时显示（Pure-music 同款） -->
      <div v-if="bubbleVisible" :class="$style.timeBubble" :style="{ left: bubbleLeft + '%' }">{{ bubbleTimeStr }}</div>
    </div>
    <div ref="dom_progress" :class="$style.progressMask" @mousedown="handleMsDown" @mousemove="handleMsHover" @mouseleave="handleMsLeave" />
  </div>
</template>

<script>
import { ref, onMounted, onBeforeUnmount, computed, watch } from '@common/utils/vueTools'
import { playProgress } from '@renderer/store/player/playProgress'
import { isPlay } from '@renderer/store/player/state'

// Pure-music 波浪进度条（移植自 _ProgressSliderPainter._paintWavy）：
// 不 clip、不平移 —— 正弦波相位（phase）驱动，每帧重绘 path 画到当前进度为止，
// 波形始终在 [0, 进度] 内原地流动，不会整体左移或溢出左边界。
const WAVE_AMPLITUDE = 2.4 // viewBox 单位
const WAVE_WAVELENGTH = 4.17 // viewBox 单位（100/4.17 ≈ 24 个波）
const WAVE_CYCLE_MS = 4000 // 一个流动周期
const WAVE_CENTER_Y = 11
const WAVE_FREQ = (Math.PI * 2) / WAVE_WAVELENGTH

export default {
  props: {
    className: {
      type: String,
      default: '',
    },
    progress: {
      type: Number,
      required: true,
    },
    isActiveTransition: {
      type: Boolean,
      required: true,
    },
    handleTransitionEnd: {
      type: Function,
      required: true,
    },
    wave: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const msEvent = {
      isMsDown: false,
      msDownX: 0,
      msDownProgress: 0,
    }
    const dom_progress = ref(null)
    const dom_wave_played = ref(null)
    const dom_wave_drag = ref(null)
    const dragging = ref(false)
    const dragProgress = ref(0)

    // ---- 相位驱动波浪：rAF 直接写 SVG path d（绕过 Vue 渲染器，60fps 无卡顿）----
    // 用二次贝塞尔平滑连接（中点控制点），消除折线感；path 画到当前进度点为止，
    // 线头恰好落在进度圆点处，不超出（Pure-music _paintWavy 同款：只画到 activeWidth）
    let phase = 0
    let waveRaf = 0
    let waveStart = 0
    const buildWavePath = (endX) => {
      const pts = []
      for (let x = 0; x <= endX + 0.01; x += 1.2) {
        const y = WAVE_CENTER_Y + WAVE_AMPLITUDE * Math.sin(phase + x * WAVE_FREQ)
        pts.push([x, y])
      }
      const lastX = pts[pts.length - 1][0]
      if (lastX < endX - 0.01) {
        pts.push([endX, WAVE_CENTER_Y + WAVE_AMPLITUDE * Math.sin(phase + endX * WAVE_FREQ)])
      }
      let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i]
        const [x2, y2] = pts[i + 1]
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        d += ` Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`
      }
      return d
    }
    const paintWave = () => {
      const path = dom_wave_played.value
      if (!path) return
      const activeW = Math.max(0, Math.min(1, props.progress || 0)) * 100
      // 画到进度点为止（不 + 波长余量），线头与圆点对齐
      const endX = Math.min(100, activeW)
      const d = buildWavePath(endX)
      path.setAttribute('d', d)
      if (dragging.value && dom_wave_drag.value) {
        dom_wave_drag.value.setAttribute('d', d)
      }
    }
    const tickWave = (ts) => {
      waveRaf = 0
      if (!waveStart) waveStart = ts
      const p = ((ts - waveStart) % WAVE_CYCLE_MS) / WAVE_CYCLE_MS
      phase = p * Math.PI * 2
      paintWave()
      waveRaf = requestAnimationFrame(tickWave)
    }
    const startWave = () => {
      if (waveRaf || !props.wave || !isPlay.value) return
      waveStart = 0
      waveRaf = requestAnimationFrame(tickWave)
    }
    const stopWave = () => {
      if (waveRaf) cancelAnimationFrame(waveRaf)
      waveRaf = 0
    }
    const syncWave = () => {
      if (props.wave && isPlay.value) startWave()
      else stopWave()
    }
    // 进度变化时（播放中 pause 或非播放态）重画一帧静态波形
    watch(() => props.progress, () => {
      if (waveRaf) return
      if (props.wave) paintWave()
    })

    const wavePath = computed(() => {
      // 初始静态波形（未播放时显示），与 paintWave 同样式平滑
      const endX = 30
      const pts = []
      for (let x = 0; x <= endX; x += 1.2) {
        const y = WAVE_CENTER_Y + WAVE_AMPLITUDE * Math.sin(phase + x * WAVE_FREQ)
        pts.push([x, y])
      }
      let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i]
        const [x2, y2] = pts[i + 1]
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        d += ` Q ${x1.toFixed(2)} ${y1.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`
      }
      return d
    })

    const trackStartX = computed(() => Math.max(0, Math.min(1, props.progress || 0)) * 100)
    const thumbX = computed(() => Math.max(0, Math.min(1, props.progress || 0)) * 100)
    const dragThumbX = computed(() => Math.max(0, Math.min(1, dragProgress.value || 0)) * 100)

    // ---- 时间气泡（Pure-music 同款）：悬停/拖动显示，离开 1s 后隐藏 ----
    const bubbleVisible = ref(false)
    const bubbleLeft = ref(0)
    const bubbleTimeStr = ref('00:00')
    let bubbleTimer = 0
    const formatBubbleTime = (sec) => {
      sec = Math.max(0, Math.floor(sec || 0))
      const m = Math.floor(sec / 60)
      const s = sec % 60
      return `${m}:${s < 10 ? '0' : ''}${s}`
    }
    const updateBubble = (clientX) => {
      const rect = dom_progress.value?.getBoundingClientRect()
      if (!rect?.width) return
      const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      bubbleLeft.value = p * 100
      bubbleTimeStr.value = formatBubbleTime(p * playProgress.maxPlayTime)
      bubbleVisible.value = true
    }
    const handleMsHover = (event) => {
      if (msEvent.isMsDown) return
      updateBubble(event.clientX)
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => { bubbleVisible.value = false }, 1000)
    }
    const handleMsLeave = () => {
      if (msEvent.isMsDown) return
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => { bubbleVisible.value = false }, 1000)
    }

    const getProgressFromClientX = clientX => {
      const rect = dom_progress.value?.getBoundingClientRect()
      if (!rect?.width) return 0
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }

    const handleMsDown = event => {
      msEvent.isMsDown = true
      msEvent.msDownX = event.clientX
      event.preventDefault()
      dragging.value = true
      dragProgress.value = msEvent.msDownProgress = getProgressFromClientX(event.clientX)
      updateBubble(event.clientX)
    }
    const handleMsUp = () => {
      if (msEvent.isMsDown) setProgress(dragProgress.value * playProgress.maxPlayTime)
      msEvent.isMsDown = false
      dragging.value = false
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => { bubbleVisible.value = false }, 1000)
    }
    const handleMsMove = event => {
      if (!msEvent.isMsDown) return
      dragProgress.value = getProgressFromClientX(event.clientX)
      updateBubble(event.clientX)
    }

    document.addEventListener('mousemove', handleMsMove)
    document.addEventListener('mouseup', handleMsUp)
    // immediate + onMounted 兜底：主页/详情页切换导致组件重建时（isPlay 未变化），
    // 也要重新启动波浪动画，否则涌动效果消失
    watch(isPlay, syncWave, { immediate: true })
    // 暂停状态组件重建时：波浪动画不运行，需按当前进度绘制一帧静止波浪，
    // 否则显示初始静态小段（"波浪-空白-圆点"）
    onMounted(() => {
      if (props.wave) paintWave()
    })
    onBeforeUnmount(() => {
      document.removeEventListener('mousemove', handleMsMove)
      document.removeEventListener('mouseup', handleMsUp)
      stopWave()
    })

    const setProgress = num => {
      window.app_event.setProgress(num)
    }

    return {
      dom_progress,
      dom_wave_played,
      dom_wave_drag,
      wavePath,
      trackStartX,
      thumbX,
      dragThumbX,
      bubbleVisible,
      bubbleLeft,
      bubbleTimeStr,
      handleMsHover,
      handleMsLeave,
      dragging,
      dragProgress,
      handleMsDown,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// Luminous Harmonic: 默认 4px，悬停/拖动加粗到 8px
.progress {
  width: 100%;
  height: 4px;
  overflow: hidden;
  transition: @transition-normal;
  transition-property: background-color, height, box-shadow;
  background-color: var(--color-slider-track, var(--color-primary-light-100-alpha-800));
  position: relative;
  border-radius: 40px;
}
.progressWrap {
  position: relative;
  width: 100%;
  min-width: 0;
}
*:has(> .progressMask:hover) > .progress,
*:has(> .progressMask:active) > .progress {
  height: 8px;
  box-shadow: 0 0 12px var(--color-primary-alpha-700, rgba(0, 0, 0, 0.15));
}
.progressMask {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.progressBar {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0;
}
.progressBar1 {
  background-color: var(--color-primary-light-100-alpha-600);
}

.progressBar2 {
  // Luminous Harmonic: 详情页打开时跟随 accent (封面/主题色), 关闭回退主色
  background-color: var(--detail-accent-color, var(--color-primary));
  will-change: transform;
}

.progressBar3 {
  background-color: var(--color-primary-light-100-alpha-200);
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
  opacity: 0.5;
}

.barTransition {
  transition-property: transform;
  transition-timing-function: ease-out;
  transition-duration: 0.2s;
}

.progress.wave {
  height: 24px;
  overflow: visible;
  background: transparent;
}
.progress.wave,
*:has(> .progressMask:hover) > .progress.wave,
*:has(> .progressMask:active) > .progress.wave {
  height: 24px;
  overflow: visible;
}
.progress.wave ~ .progressMask {
  top: -6px;
  height: 28px;
  z-index: 2;
}
.waveSvg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.waveTrack,
.waveLine {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.waveTrack {
  // Pure-music inactiveColor 思路：浅色半透明白，在深色流光背景上始终可见
  stroke: color-mix(in srgb, var(--wave-progress-color, var(--color-primary)) 32%, white);
  stroke-width: 2;
  opacity: .55;
}
.waveLine {
  stroke-width: 2.6;
  transition: stroke .25s ease;
}
.waveLinePlayed {
  stroke: var(--wave-progress-color, var(--color-primary));
  // Luminous Harmonic: 双层发光伴随波浪涌动（近强 + 远扩散），流光背景转动时也清晰
  filter:
    drop-shadow(0 0 3px var(--wave-progress-glow, var(--color-primary-alpha-700, rgba(0, 0, 0, .22)))),
    drop-shadow(0 0 12px var(--wave-progress-glow, var(--color-primary-alpha-700, rgba(0, 0, 0, .22))));
}
.waveLineDrag {
  stroke: color-mix(in srgb, var(--wave-progress-color, var(--color-primary)) 55%, transparent);
  opacity: .9;
}
.waveDot {
  position: absolute;
  width: 11px;
  height: 11px;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
}
.waveDotCore {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary-font, #fff);
  box-shadow:
    0 0 6px 2px var(--wave-progress-glow, var(--color-primary-alpha-700, rgba(0, 0, 0, .35))),
    0 0 1.5px 0.8px var(--wave-progress-color, var(--color-primary));
}
.waveDotDrag .waveDotCore {
  background: var(--color-primary-light-100-alpha-300, rgba(255, 255, 255, .8));
}
// 时间气泡（Pure-music 同款）：悬停/拖动显示，1s 无操作隐藏
.timeBubble {
  position: absolute;
  top: -26px;
  transform: translateX(-50%);
  padding: 2px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-primary, #4a8eff) 88%, black);
  color: var(--color-primary-font, #fff);
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 4px 12px rgb(0 0 0 / .3);
}
.wave .progressBar {
  display: none;
}

</style>
