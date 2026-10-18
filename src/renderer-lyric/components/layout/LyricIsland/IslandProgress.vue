<template>
  <div :class="$style.row">
    <!-- 左端时间：占据固定槽位，进度条从它右侧开始 -->
    <span :class="$style.time">{{ nowLabel }}</span>

    <!-- 中间：进度条。两端由 flex 让出时间槽，故时间不会压在轨道上 -->
    <div ref="dom_hit" :class="$style.track" @mousedown="handleMsDown" @mousemove="handleMsHover" @mouseleave="handleMsLeave">
      <!-- 波浪模式：未播放段直线 + 已播放段相位驱动正弦波（对齐主播放栏） -->
      <svg v-if="wave" :class="$style.svg" :viewBox="'0 0 100 ' + VB_H" preserveAspectRatio="none" aria-hidden="true">
        <!-- 未播放段：直线，从进度点画到右端。
             注意 x1 直接用 safeProgress 计算（它是已暴露给模板的变量）：
             之前用了一个忘了 return 的 computed，模板里是 undefined，
             SVG 把非法 x1 当 0，直线就从最左端横跨整条、压在波形下面了。 -->
        <line :class="$style.waveTrack" :x1="safeProgress * 100" :y1="VB_H / 2" x2="100" :y2="VB_H / 2" />
        <path ref="dom_wave_played" :class="$style.waveLine" d="" />
      </svg>
      <!-- 直线模式 -->
      <template v-else>
        <div :class="$style.lineTrack" />
        <div :class="$style.linePlayed" :style="{ transform: 'scaleX(' + safeProgress + ')' }" />
      </template>

      <!-- 进度圆点（HTML 元素：避免 SVG 非等比缩放把圆点拉成椭圆） -->
      <div
        v-if="safeProgress > 0 || dragging"
        :class="[$style.dot, { [$style.dotActive]: dragging }]"
        :style="{ left: (dragging ? dragProgress : safeProgress) * 100 + '%' }"
      >
        <span :class="$style.dotCore" />
      </div>
    </div>

    <!-- 右端时间 -->
    <span :class="$style.time">{{ maxLabel }}</span>

    <!-- 拖动/悬停时间气泡 -->
    <div v-show="bubbleVisible" :class="$style.bubble" :style="{ left: bubbleLeft + '%' }">
      {{ bubbleTimeStr }}
    </div>
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'

// ---- 波形参数（对齐主播放栏 ProgressBar.vue 的做法与观感）----
// 主栏：viewBox 0 0 100 22、波幅 2.4、波长 4.17、周期 4000ms
//   → 实际竖直起伏 = 2.4 × (22/22) = ±2.4px（主栏高 22px）
// 这里：轨道高 18px，viewBox 高 24 → 同样的 2.4 波幅只能得 ±1.8px，太平；
// 校准到 ±3.2px（比主栏略明显、但远小于上一版的 ±5.2px，不再"起伏过大"）。
const VB_H = 24
/** 波幅（viewBox 单位）：4.2 / 24 × 18px ≈ ±3.2px */
const WAVE_AMPLITUDE = 4.2
/** 波长：与主栏技巧一致 —— 用视口宽度百分比，保证任何像素宽度下都是约 18 个波，不会挤成一团 */
const WAVE_LENGTH_PCT = 5.4
/** 一个流动周期；相位递增 → 波形向进度方向涌动（与主栏同向） */
const WAVE_CYCLE_MS = 2800
const WAVE_CENTER_Y = VB_H / 2

const formatTime = (sec) => {
  sec = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m + ':' + (s < 10 ? '0' : '') + s
}

export default {
  name: 'IslandProgress',
  props: {
    /** 0..1 */
    progress: {
      type: Number,
      default: 0,
    },
    /** 是否波浪样式（跟随 common.playBarWave） */
    wave: {
      type: Boolean,
      default: true,
    },
    /** 是否正在播放（暂停时波形静止） */
    playing: {
      type: Boolean,
      default: false,
    },
    /** 已播放毫秒 */
    nowTime: {
      type: Number,
      default: 0,
    },
    /** 总时长毫秒 */
    maxTime: {
      type: Number,
      default: 0,
    },
  },
  emits: ['seek'],
  setup(props, { emit }) {
    const dom_hit = ref(null)
    const dom_wave_played = ref(null)
    const dragging = ref(false)
    const dragProgress = ref(0)
    const bubbleVisible = ref(false)
    const bubbleLeft = ref(0)
    const bubbleTimeStr = ref('0:00')

    const safeProgress = computed(() => Math.max(0, Math.min(1, props.progress || 0)))
    const nowLabel = computed(() => formatTime(Math.max(0, props.nowTime || 0)))
    const maxLabel = computed(() => formatTime(Math.max(0, props.maxTime || 0)))

    // ---- 波浪相位：rAF 直接写 path 的 d，绕过 Vue 渲染（60fps 无卡顿）----
    let phase = 0
    let raf = 0
    let startTs = 0
    /**
     * 轨道像素宽度缓存。
     *
     * 关键性能点：buildWavePath 每帧都要用到轨道宽度，若每帧调
     * getBoundingClientRect() 会强制同步布局（layout thrashing），
     * 60fps 下就表现为"非常卡"。这里改为只在尺寸变化时用
     * ResizeObserver 更新一次。
     */
    let trackWidthPx = 0
    let ro = null

    const measureTrack = () => {
      trackWidthPx = dom_hit.value?.getBoundingClientRect().width || 0
    }

    /**
     * 已播放段：相位驱动的正弦波，画到进度点为止。
     *
     * 与主播放栏同款做法（无 clip、无平移，只靠相位流动）：
     * 波形在 [0, 进度] 区间内原地涌动，不会整体左移或溢出左边界。
     * 波长按轨道像素宽度换算，保证不同宽度下波数恒定、不会拥挤。
     */
    const buildWavePath = (endX) => {
      const widthPx = trackWidthPx
      // 一个波长占轨道的百分比 → 换算到 viewBox 单位（viewBox 宽 100）
      const waveLengthVB = widthPx > 0
        ? (WAVE_LENGTH_PCT / 100) * widthPx / (widthPx / 100)
        : WAVE_LENGTH_PCT
      const freq = (Math.PI * 2) / Math.max(1, waveLengthVB)
      const step = Math.max(0.4, Math.min(1.2, waveLengthVB / 6))
      const pts = []
      for (let x = 0; x <= endX + 0.01; x += step) {
        pts.push([x, WAVE_CENTER_Y + WAVE_AMPLITUDE * Math.sin(phase + x * freq)])
      }
      const lastX = pts.length ? pts[pts.length - 1][0] : 0
      if (lastX < endX - 0.01) {
        pts.push([endX, WAVE_CENTER_Y + WAVE_AMPLITUDE * Math.sin(phase + endX * freq)])
      }
      if (!pts.length) return ''
      let d = 'M ' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2)
      for (let i = 0; i < pts.length - 1; i++) {
        const x1 = pts[i][0]
        const y1 = pts[i][1]
        const x2 = pts[i + 1][0]
        const y2 = pts[i + 1][1]
        d += ' Q ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' ' + ((x1 + x2) / 2).toFixed(2) + ' ' + ((y1 + y2) / 2).toFixed(2)
      }
      return d
    }
    const paintWave = () => {
      const path = dom_wave_played.value
      if (!path) return
      const ratio = dragging.value ? dragProgress.value : safeProgress.value
      path.setAttribute('d', buildWavePath(Math.max(0, Math.min(100, ratio * 100))))
    }
    const tick = (ts) => {
      raf = 0
      if (!startTs) startTs = ts
      phase = (((ts - startTs) % WAVE_CYCLE_MS) / WAVE_CYCLE_MS) * Math.PI * 2
      paintWave()
      raf = requestAnimationFrame(tick)
    }
    const startWave = () => {
      if (raf || !props.wave || !props.playing) return
      startTs = 0
      raf = requestAnimationFrame(tick)
    }
    const stopWave = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    const syncWave = () => {
      if (props.wave && props.playing) startWave()
      else stopWave()
      paintWave()
    }

    watch(() => props.progress, () => { if (!raf) paintWave() })
    watch(() => props.playing, syncWave)
    watch(() => props.wave, () => { syncWave(); paintWave() })
    // 注意：这里必须调 syncWave 而不是 paintWave。
    // 进度条是在卡片展开时才挂载的，此时音乐通常**已经在播**，
    // playing 属性没有发生变化 → watcher 不触发 → rAF 循环永不启动，
    // 表现为"波形静止、只有进度点在动"（用户反馈的正是这个）。
    onMounted(() => {
      measureTrack()
      if (typeof ResizeObserver != 'undefined' && dom_hit.value) {
        ro = new ResizeObserver(() => { measureTrack() })
        ro.observe(dom_hit.value)
      }
      syncWave()
    })
    onBeforeUnmount(() => {
      stopWave()
      ro?.disconnect()
      ro = null
      document.removeEventListener('mousemove', handleMsMove)
      document.removeEventListener('mouseup', handleMsUp)
      clearTimeout(bubbleTimer)
    })

    // ---- 拖动 / 点击 seek ----
    let isMsDown = false
    let bubbleTimer = 0
    const ratioFromClientX = (clientX) => {
      const rect = dom_hit.value?.getBoundingClientRect()
      if (!rect?.width) return 0
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    }
    const updateBubble = (clientX) => {
      const p = ratioFromClientX(clientX)
      bubbleLeft.value = p * 100
      bubbleTimeStr.value = formatTime(p * (props.maxTime || 0)) + ' / ' + formatTime(props.maxTime || 0)
      bubbleVisible.value = true
    }
    /** 点击也要能跳转：按下即定位；抬起时只有当总时长已知才提交（避免跳到 0） */
    const handleMsDown = (event) => {
      isMsDown = true
      dragging.value = true
      dragProgress.value = ratioFromClientX(event.clientX)
      event.preventDefault()
      updateBubble(event.clientX)
      paintWave()
    }
    const handleMsMove = (event) => {
      if (!isMsDown) return
      dragProgress.value = ratioFromClientX(event.clientX)
      updateBubble(event.clientX)
      paintWave()
    }
    const handleMsUp = () => {
      if (isMsDown) {
        isMsDown = false
        // 时长未知时不提交（ratio × 0 会变成"跳到开头"）
        if ((props.maxTime || 0) > 0) emit('seek', dragProgress.value)
      }
      dragging.value = false
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => { bubbleVisible.value = false }, 800)
      paintWave()
    }
    const handleMsHover = (event) => {
      if (isMsDown) return
      updateBubble(event.clientX)
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => { bubbleVisible.value = false }, 1000)
    }
    const handleMsLeave = () => {
      if (isMsDown) return
      clearTimeout(bubbleTimer)
      bubbleTimer = setTimeout(() => { bubbleVisible.value = false }, 1000)
    }
    document.addEventListener('mousemove', handleMsMove)
    document.addEventListener('mouseup', handleMsUp)
    // 注：卸载清理统一放在上面的 onBeforeUnmount 里（避免重复注册钩子）

    return {
      VB_H,
      dom_hit,
      dom_wave_played,
      dragging,
      dragProgress,
      safeProgress,
      nowLabel,
      maxLabel,
      bubbleVisible,
      bubbleLeft,
      bubbleTimeStr,
      handleMsDown,
      handleMsHover,
      handleMsLeave,
    }
  },
}
</script>

<style lang="less" module>
@import '@lyric/assets/styles/layout.less';

// 一行三段：时间 | 轨道 | 时间。时间占固定槽位，不再压在轨道上
.row {
  position: relative;
  width: 100%;
  min-width: 0;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 6px;
  height: 18px;
}

.time {
  flex: none;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  opacity: .7;
  white-space: nowrap;
  min-width: 26px;

  &:last-of-type { text-align: right; }
}

// 中间轨道：吃掉剩余宽度
.track {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  cursor: pointer;
}

.svg {
  width: 100%;
  height: 18px;
  display: block;
  overflow: visible;
}

// 未播放段：直线（与主播放栏 waveTrack 同做法 —— 浅色半透明白，深色底上始终可见，
// 且只从进度点画到右端，不会穿过已播放的波形）。
// 压到很淡：它只是"剩下还有多长"的暗示，太亮会像一条把进度条劈开的横线。
.waveTrack {
  stroke: color-mix(in srgb, var(--detail-accent-bright, var(--color-primary, #4a8cff)) 22%, white);
  stroke-width: 1.6;
  opacity: .28;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

// 已播放段波形：取色与详情页同步（--detail-accent-bright）。
// 不用 drop-shadow 滤镜 —— 路径每帧都在变，滤镜会让每帧都走一次
// expensive 的离屏模糊，是"进度条很卡"的主要来源。光晕改用静态的叠加层实现。
.waveLine {
  fill: none;
  stroke: var(--detail-accent-bright, var(--color-primary, #4a8cff));
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

// 直线模式
.lineTrack {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  margin-top: -1px;
  border-radius: 1px;
  background: rgb(255 255 255 / .13);
}
.linePlayed {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  margin-top: -1px;
  border-radius: 1px;
  transform-origin: left center;
  background: var(--detail-accent-bright, var(--color-primary, #4a8cff));
}

// 进度圆点（HTML 元素，不会被 SVG 拉成椭圆）
.dot {
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  margin-left: -4.5px;
  transform: translateY(-50%);
  border-radius: 50%;
  background: var(--detail-accent-bright, var(--color-primary, #4a8cff));
  box-shadow: 0 0 0 1px rgb(255 255 255 / .28);
  pointer-events: none;
  transition: transform .15s ease;
}
.dotActive {
  transform: translateY(-50%) scale(1.35);
}
.dotCore {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  background: rgb(255 255 255 / .92);
}

.bubble {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 7px;
  border-radius: 6px;
  background: rgb(0 0 0 / .82);
  color: #fff;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .dot { transition: none; }
}
</style>
