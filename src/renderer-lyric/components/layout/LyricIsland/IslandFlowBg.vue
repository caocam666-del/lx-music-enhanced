<template>
  <div
    :class="[$style.flow, { [$style.rhythm]: isRhythm, [$style.paused]: !isPlay }]"
    :style="flowVars"
    aria-hidden="true"
  >
    <!-- 1) 中性基底：主题基色 + 极轻强调色染色（与详情页 .bg 同配方，7%） -->
    <div :class="useCover ? $style.bg : $style.themeBg" />

    <!-- 2) 流光层：1:1 复刻详情页 PlayDetail 的 FlowingLightBackground
         · 三个「固定位置」的大圆斑（本身不旋转）只当遮罩，位置比例与详情页一致
           primary 50%,40% / secondary 84%,68% / light 16%,72%
         · 封面纹理在圆斑内部缓慢自转，三个斑采样封面不同区域 → 同一封面拆出三种色场
         · 纹理重度模糊 → 只看得到颜色场，看不到封面结构 -->
    <div v-if="showFlow" :class="$style.bgFlow">
      <span :class="[$style.flowMask, $style.flowPrimary]"><i :class="$style.flowTex" /></span>
      <span :class="[$style.flowMask, $style.flowSecondary]"><i :class="$style.flowTex" /></span>
      <span :class="[$style.flowMask, $style.flowLight]"><i :class="$style.flowTex" /></span>
    </div>

    <!-- 3) 收尾蒙层：详情页式边缘渐晕 + 轻度压暗 -->
    <div :class="$style.bgScrim" />
  </div>
</template>

<script>
import { computed, onBeforeUnmount, onMounted, ref, watch } from '@common/utils/vueTools'
import { getAnalyserDataArray, useEvent } from '@lyric/core/mainWindowChannel'
import { isPlay, musicInfo, setting } from '@lyric/store/state'

// 节奏律动参数（与详情页 useFlowRhythm.js 完全同源）
const TARGET_FPS = 30
const FRAME_MS = 1000 / TARGET_FPS
const LEVEL_GAIN = 0.09
const TRANSIENT_GAIN = 0.26
const SCALE_MAX = 1.3
// 拾音器数据是主窗按需推来的（request/response），所以自己按帧率节流请求
const REQUEST_INTERVAL = 1000 / 24

export default {
  name: 'IslandFlowBg',
  setup() {
    const flowMode = computed(() => setting['desktopLyric.island.flowMode'] ?? 'dynamic')
    const isRhythm = computed(() => flowMode.value == 'rhythm')
    const root = ref(null)

    /**
     * 取色来源：
     *  · 'detail'（默认）→ 用封面图当流光纹理，与详情页「封面取色」模式完全一致
     *  · 'theme'        → 无封面纹理，走详情页 .themeBackground 的配方（主题色多层径向渐变）
     */
    const colorSource = computed(() => setting['desktopLyric.island.colorSource'] ?? 'detail')
    const coverUrl = computed(() => (musicInfo.pic || '').trim())
    const useCover = computed(() => colorSource.value != 'theme' && !!coverUrl.value)
    const showFlow = computed(() => flowMode.value != 'none' && useCover.value)

    /** 封面图作为 CSS 变量喂给纹理层（与详情页 --detail-cover-image 同一用途） */
    const flowVars = computed(() => {
      // 流光强度 0-100 → 亮度/蒙层。
      // 100 时与详情页完全一致（纹理 brightness .88 / 蒙层 .10）；
      // 往低走则整层压暗、蒙层加重，文字更清晰（岛是透明窗直接叠桌面，需要这个可调）。
      const raw = Number(setting['desktopLyric.island.flowStrength'])
      const strength = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 62
      const t = strength / 100
      const brightness = (0.50 + t * 0.38).toFixed(3)
      const scrim = (0.55 - t * 0.45).toFixed(3)
      return {
        '--island-cover-image': useCover.value ? `url("${coverUrl.value}")` : 'none',
        '--island-flow-brightness': brightness,
        '--island-flow-scrim': scrim,
      }
    })

    let rafId = 0
    let lastFrameTs = 0
    let lastRequestTs = 0
    let smoothLevel = 0
    let transient = 0
    let lastBass = 0
    let lastScale = ''
    let lastBreath = ''

    // 写到组件根元素（而不是 documentElement），避免整文档样式重算
    const writeVar = (name, value, last) => {
      const el = root.value
      if (!el) return last
      if (value == last) return last
      el.style.setProperty(name, value)
      return value
    }

    const handleAnalyserData = (event) => {
      if (event?.action != 'send_analyser_data_array') return
      const dataArray = event.data
      if (!dataArray?.length || !isPlay.value) return
      const bassEnd = Math.max(4, Math.floor(dataArray.length * 0.08))
      let sum = 0
      for (let i = 0; i < bassEnd; i++) sum += dataArray[i]
      const bass = sum / bassEnd / 255
      transient = Math.max(transient * 0.88, Math.max(0, bass - lastBass) * 5)
      if (transient > 1) transient = 1
      lastBass = bass
      smoothLevel += (bass - smoothLevel) * 0.25
    }
    useEvent(handleAnalyserData)

    const tick = (ts) => {
      rafId = requestAnimationFrame(tick)
      if (!isRhythm.value || document.hidden) return
      if (ts - lastFrameTs < FRAME_MS - 1) return
      lastFrameTs = ts

      if (isPlay.value && ts - lastRequestTs > REQUEST_INTERVAL) {
        lastRequestTs = ts
        getAnalyserDataArray()
      }
      if (!isPlay.value) {
        smoothLevel *= 0.9
        transient *= 0.86
      }
      // 与详情页同一套系数：呼吸缩放 + 亮度脉动
      const scale = Math.min(SCALE_MAX, 1 + Math.max(0, smoothLevel) * LEVEL_GAIN + transient * TRANSIENT_GAIN)
      const breath = Math.min(1, 0.9 + (scale - 1) * 0.4)
      lastScale = writeVar('--flow-scale', scale.toFixed(3), lastScale)
      lastBreath = writeVar('--flow-breath', breath.toFixed(3), lastBreath)
    }

    const startLoop = () => {
      if (rafId) return
      rafId = requestAnimationFrame(tick)
    }
    const stopLoop = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = 0
      lastScale = ''
      lastBreath = ''
      root.value?.style.removeProperty('--flow-scale')
      root.value?.style.removeProperty('--flow-breath')
    }

    watch(isRhythm, on => { on ? startLoop() : stopLoop() }, { immediate: true })
    onMounted(() => { if (isRhythm.value) startLoop() })
    onBeforeUnmount(stopLoop)

    return { root, flowMode, isRhythm, isPlay, showFlow, useCover, flowVars }
  },
}
</script>

<style lang="less" module>
@import '@lyric/assets/styles/layout.less';

.flow {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
  // 圆角由父级 .island 的 overflow:hidden 裁切
  border-radius: inherit;
  // 桌面歌词的「不透明度」设置只作用于背景层，否则会连文字一起变淡
  opacity: var(--island-surface-opacity, 1);
  transition: opacity .2s ease;
  // 让内部 z-index 自成体系，避免与卡片内容互相影响
  isolation: isolate;
}

// ---------------- 1) 中性基底（复刻详情页 .bg，但底色固定为深色）----------------
// accent 仅 7% 极轻染色，色彩场全部交给流光层 —— 与详情页同配方。
//
// 为什么不用 var(--luminous-bg-base)：浅色主题下它是 #f7f9fb（近白），
// 而岛里的歌词颜色来自详情页、按"深色面"设计（未播放行是近白 #f4f5f7），
// 于是近白字压近白底 → 整片糊掉、桌面内容也更容易透出来（用户反馈"看不清"）。
// 岛是悬浮在桌面上的覆盖层，底色固定深色才能保证两种主题下都清晰。
.bg {
  position: absolute;
  inset: 0;
  z-index: -3;
  background: linear-gradient(175deg,
    color-mix(in srgb, var(--detail-accent-bright, var(--color-primary)) 7%, #15161a),
    #15161a 70%);
}

// 主题取色模式（无封面纹理）：保留详情页 .themeBackground 的多层主题色径向渐变，
// 但同样把基底压到深色，避免浅色主题下过白
.themeBg {
  position: absolute;
  inset: 0;
  z-index: -3;
  background:
    radial-gradient(58% 46% at 24% 20%, color-mix(in srgb, var(--color-primary) 22%, transparent), transparent 70%),
    radial-gradient(46% 40% at 78% 30%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 72%),
    radial-gradient(56% 54% at 60% 84%, color-mix(in srgb, var(--color-primary) 14%, transparent), transparent 76%),
    radial-gradient(42% 42% at 16% 88%, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 72%),
    linear-gradient(175deg, #15161a, #101115 80%);
}

// ---------------- 2) 流光层（复刻详情页 .bgFlow）----------------
.bgFlow {
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  overflow: hidden;
  // 详情页默认 0.9；律动模式下由 --flow-breath 驱动亮度脉动
  opacity: var(--flow-breath, 0.9);
}

// 蒙版层：位置固定、只负责"从纹理里抠出一块圆形色斑"
.flowMask {
  position: absolute;
  overflow: hidden;
  translate: -50% -50%;
  will-change: transform;
}

// 尺寸按岛面（约 460×200）换算，位置比例与详情页一致
.flowPrimary {
  width: 620px;
  height: 620px;
  left: 50%;
  top: 40%;
  opacity: .88;
  -webkit-mask-image: radial-gradient(circle closest-side, #000 58%, rgb(0 0 0 / .82) 82%, transparent 100%);
  mask-image: radial-gradient(circle closest-side, #000 58%, rgb(0 0 0 / .82) 82%, transparent 100%);
  animation: island-flow-drift-primary 54s ease-in-out infinite alternate;
}
.flowSecondary {
  width: 520px;
  height: 520px;
  left: 84%;
  top: 68%;
  opacity: .32;
  -webkit-mask-image: radial-gradient(circle closest-side, #000 52%, rgb(0 0 0 / .39) 82%, transparent 100%);
  mask-image: radial-gradient(circle closest-side, #000 52%, rgb(0 0 0 / .39) 82%, transparent 100%);
  animation: island-flow-drift-secondary 40s ease-in-out infinite alternate;
}
.flowLight {
  width: 520px;
  height: 520px;
  left: 16%;
  top: 72%;
  opacity: .22;
  -webkit-mask-image: radial-gradient(circle closest-side, #000 52%, rgb(0 0 0 / .39) 82%, transparent 100%);
  mask-image: radial-gradient(circle closest-side, #000 52%, rgb(0 0 0 / .39) 82%, transparent 100%);
  animation: island-flow-drift-light 30s ease-in-out infinite alternate;
}

// 封面纹理：铺满并绕斑心缓慢自转；重度模糊 → 只见颜色场
.flowTex {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 720px;
  height: 720px;
  margin: -360px 0 0 -360px;
  background-image: var(--island-cover-image);
  background-size: 820px 820px;
  background-position: center;
  // 详情页是 blur(48px) brightness(.88)；强度 100 时这里与之完全一致
  filter: blur(46px) saturate(1.25) brightness(var(--island-flow-brightness, .74));
  will-change: transform;
  animation: island-flow-rotate-1 54s linear infinite;
}
// 三个斑采样封面的不同区域（详情页用 texture offset 实现同效）
.flowSecondary .flowTex {
  background-position: 24% 62%;
  animation: island-flow-rotate-2 40s linear infinite reverse;
}
.flowLight .flowTex {
  background-position: 76% 70%;
  animation: island-flow-rotate-3 30s linear infinite reverse;
}

// ---------------- 3) 收尾蒙层（复刻详情页 .bgScrim）----------------
// 详情页只有 rgb(0 0 0 / .1)；岛是透明窗直接叠在桌面上，
// 这里保留同样的边缘渐晕形状，压暗值单独可调以保证文字可读
.bgScrim {
  position: absolute;
  inset: 0;
  z-index: 3;
  background:
    radial-gradient(120% 120% at 50% 50%, transparent 62%, rgb(0 0 0 / .1) 100%),
    rgb(0 0 0 / var(--island-flow-scrim, .42));
}

// ---------------- 动画（与详情页同周期）----------------
@keyframes island-flow-rotate-1 {
  from { transform: rotate(0deg) scale(var(--flow-scale, 1)); }
  to { transform: rotate(360deg) scale(var(--flow-scale, 1)); }
}
@keyframes island-flow-rotate-2 {
  from { transform: rotate(0deg) scale(var(--flow-scale, 1)); }
  to { transform: rotate(360deg) scale(var(--flow-scale, 1)); }
}
@keyframes island-flow-rotate-3 {
  from { transform: rotate(0deg) scale(var(--flow-scale, 1)); }
  to { transform: rotate(360deg) scale(var(--flow-scale, 1)); }
}
@keyframes island-flow-drift-primary {
  0% { transform: translate(-2.6%, 2.6%); }
  50% { transform: translate(0, -2.2%); }
  100% { transform: translate(2.6%, -1.2%); }
}
@keyframes island-flow-drift-secondary {
  0% { transform: translate(2.2%, 1.8%); }
  50% { transform: translate(-1.8%, 0); }
  100% { transform: translate(0, -2.2%); }
}
@keyframes island-flow-drift-light {
  0% { transform: translate(-1.6%, -1.4%); }
  50% { transform: translate(1.4%, 1.6%); }
  100% { transform: translate(-1.2%, 1.2%); }
}

// 暂停时整个流光场静止（对齐详情页：非播放态 flow speed = 0）
.paused {
  .flowMask,
  .flowTex {
    animation-play-state: paused;
  }
}

@media (prefers-reduced-motion: reduce) {
  .flowMask,
  .flowTex { animation: none; }
}
</style>
