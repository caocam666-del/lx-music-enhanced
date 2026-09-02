<template>
  <div
    :class="[$style.capsule, { [$style.playing]: isPlaying, [$style.dragging]: isDragging }]"
    :style="{ '--progress': `${displayProgress * 100}%` }"
  >
    <ProgressVisualizer
      v-if="hasMusic && appSetting['common.playBarVisualization'] !== false"
      :visualizer-height="50"
      :class="[$style.visualizer, { [$style.visualizerPaused]: !isPlaying }]"
    />
    <span :class="$style.currentTime">{{ displayTime }}</span>
    <!-- Luminous Harmonic: 波浪开关 — 开 = middle 同款 SVG 正弦波 (同长度贴底); 关 = 原胶囊条 -->
    <common-progress-bar
      v-if="playBarWave"
      :class="$style.waveRail"
      :progress="normalProgress"
      :wave="true"
    />
    <div v-else :class="$style.rail">
      <div :class="$style.track" />
      <div :class="$style.fill" />
      <div :class="$style.starTrail">
        <!-- Luminous Harmonic: 星星粒子改用内联 SVG 四角星 (原为文本 * . 字符, 与全 SVG 图标体系材质不符) -->
        <span
          v-for="(offset, index) in starOffsets"
          :key="offset"
          :class="$style.star"
          :style="{ '--star-offset': `${offset}px`, animationDelay: `${index * -0.7}s` }"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10z" fill="currentColor" />
          </svg>
        </span>
      </div>
      <div :class="$style.thumb" />
      <div v-if="isDragging" :class="$style.tooltip">{{ formatTime(dragTime) }}</div>
      <input
        :class="$style.range"
        type="range"
        min="0"
        :max="safeMaxTime"
        step="0.1"
        :value="displayTimeValue"
        :aria-label="$t('player__progress') || 'Playback progress'"
        :aria-valuetext="`${displayTime} / ${maxTimeLabel}`"
        @input="handleInput"
        @pointerdown="isDragging = true"
        @pointerup="finishDrag"
        @pointercancel="finishDrag"
        @blur="finishDrag"
      >
    </div>
    <span :class="$style.totalTime">{{ maxTimeLabel }}</span>
    <span :class="$style.srOnly">{{ displayTime }} / {{ maxTimeLabel }}</span>
  </div>
</template>

<script setup>
import { computed, ref } from '@common/utils/vueTools'
import ProgressVisualizer from './ProgressVisualizer.vue'
import { appSetting } from '@renderer/store/setting'

// Luminous Harmonic: 波浪开关 — 与设置页「播放栏波浪进度条」联动
const playBarWave = computed(() => appSetting['common.playBarWave'])

const props = defineProps({
  progress: { type: Number, default: 0 },
  currentTime: { type: Number, default: 0 },
  maxTime: { type: Number, default: 0 },
  currentTimeLabel: { type: String, default: '' },
  maxTimeLabel: { type: String, default: '' },
  isPlaying: { type: Boolean, default: false },
  hasMusic: { type: Boolean, default: false },
})
const emit = defineEmits(['seek'])

const isDragging = ref(false)
const dragTime = ref(0)
const starOffsets = [-42, -29, -16, -3, 11, 25, 39]

const safeMaxTime = computed(() => Math.max(0, Number(props.maxTime) || 0))
const normalProgress = computed(() => Math.max(0, Math.min(1, Number(props.progress) || 0)))
const displayProgress = computed(() => {
  if (isDragging.value && safeMaxTime.value) return Math.max(0, Math.min(1, dragTime.value / safeMaxTime.value))
  return normalProgress.value
})
const formatTime = (value) => {
  const seconds = Math.max(0, Math.floor(Number(value) || 0))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${remainder.toString().padStart(2, '0')}`
}

const displayTimeValue = computed(() => displayProgress.value * safeMaxTime.value)
const displayTime = computed(() => {
  if (isDragging.value) return formatTime(dragTime.value)
  return props.currentTimeLabel || formatTime(props.currentTime)
})

const handleInput = (event) => {
  const value = Number(event.currentTarget.value) || 0
  dragTime.value = value
  isDragging.value = true
  emit('seek', value)
}

const finishDrag = () => {
  if (!isDragging.value) return
  isDragging.value = false
}
</script>

<style lang="less" module>
.capsule {
  --capsule-primary: var(--color-primary, #7b9cff);
  --capsule-cyan: var(--player-accent-soft, var(--capsule-primary));
  --capsule-purple: var(--player-accent, var(--capsule-primary));
  --capsule-ink: color-mix(in srgb, var(--color-content-background, #20242c) 92%, transparent);
  position: relative;
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  height: 28px;
  min-width: 108px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  color: var(--color-font-label, rgba(255, 255, 255, 0.72));
  transition: border-color 260ms ease, box-shadow 260ms ease, background-color 260ms ease;
  overflow: visible;
  user-select: none;

}

.capsule > .visualizer {
  position: absolute;
  left: 0;
  right: 0;
  top: -22px;
  z-index: 0;
  width: 100%;
  height: 50px !important;
  border-radius: inherit;
  opacity: .68;
  pointer-events: none;
  transition: opacity 280ms ease;
}

.capsule > .visualizer.visualizerPaused {
  opacity: 0;
}

.currentTime,
.totalTime {
  position: relative;
  z-index: 1;
  flex: none;
  min-width: 28px;
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: center;
}

.currentTime {
  color: var(--color-font, rgba(255, 255, 255, 0.9));
}

.totalTime {
  opacity: .62;
}

.rail {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-width: 34px;
  height: 18px;
  display: flex;
  align-items: center;
  overflow: visible;
}

// Luminous Harmonic: 波浪分支容器 — 与 .rail 同位同长 (SVG 波浪自高 24px, 居中即贴底同视觉)
.waveRail {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-width: 34px;
  height: 24px;
  display: flex;
  align-items: center;

  // 波浪颜色跟随胶囊配色（ProgressBar 读 --wave-progress-color）
  --wave-progress-color: var(--capsule-cyan, var(--color-primary));
  --wave-progress-glow: color-mix(in srgb, var(--capsule-cyan, var(--color-primary)) 55%, transparent);
}

.track,
.fill {
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 999px;
  pointer-events: none;
}

.track {
  background: color-mix(in srgb, var(--capsule-primary) 22%, rgba(132, 148, 182, 0.5));
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.16);
}

.fill {
  right: auto;
  width: var(--progress);
  min-width: 0;
  background: linear-gradient(90deg, var(--capsule-primary) 0%, var(--capsule-cyan) 52%, var(--capsule-purple) 100%);
  box-shadow: 0 0 7px color-mix(in srgb, var(--capsule-primary) 45%, transparent);
  transition: width 120ms linear, filter 260ms ease;
}

.capsule:hover .fill,
.capsule:focus-within .fill {
  filter: brightness(1.15) saturate(1.05);
}

.starTrail {
  position: absolute;
  left: 0;
  right: 0;
  height: 14px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transition: opacity 280ms ease;
}

.playing .starTrail {
  opacity: .58;
}

.star {
  position: absolute;
  top: 50%;
  left: var(--progress);
  color: color-mix(in srgb, var(--capsule-cyan) 66%, #fff);
  // Luminous Harmonic: 内联 SVG 星星 (原文本字符字号改尺寸)
  width: 9px;
  height: 9px;
  line-height: 1;
  transform: translate(calc(-50% + var(--star-offset)), -50%);
  animation: star-drift 3.8s ease-in-out infinite;

  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.star:nth-child(2n) {
  color: color-mix(in srgb, var(--capsule-purple) 74%, #fff);
  width: 7px;
  height: 7px;
}

.thumb {
  position: absolute;
  left: var(--progress);
  top: 50%;
  width: 8px;
  height: 8px;
  border: 1px solid rgba(255, 255, 255, 0.94);
  border-radius: 50%;
  background: #fff;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--capsule-primary) 28%, transparent), 0 0 8px color-mix(in srgb, var(--capsule-cyan) 58%, transparent);
  transition: width 220ms ease, height 220ms ease, box-shadow 260ms ease;
  pointer-events: none;
}

.capsule:hover .thumb,
.capsule:focus-within .thumb {
  width: 11px;
  height: 11px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--capsule-primary) 25%, transparent), 0 0 11px color-mix(in srgb, var(--capsule-cyan) 68%, transparent);
}

.dragging .thumb {
  width: 13px;
  height: 13px;
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--capsule-primary) 16%, transparent), 0 0 14px color-mix(in srgb, var(--capsule-purple) 62%, transparent);
}

.tooltip {
  position: absolute;
  left: var(--progress);
  bottom: calc(100% + 6px);
  padding: 3px 7px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: var(--capsule-ink);
  color: rgba(255, 255, 255, 0.94);
  font-size: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  transform: translateX(-50%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  pointer-events: none;
  white-space: nowrap;
  z-index: 4;
}

.range {
  position: absolute;
  inset: 0;
  z-index: 5;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  opacity: 0;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  background: transparent;

  &::-webkit-slider-runnable-track {
    height: 100%;
    background: transparent;
  }

  &::-webkit-slider-thumb {
    width: 28px;
    height: 28px;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
  }

  &::-moz-range-track {
    height: 100%;
    background: transparent;
  }

  &::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
  }
}

.srOnly {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes star-drift {
  0%, 100% { opacity: .2; transform: translate(calc(-50% + var(--star-offset)), -50%) scale(.85); }
  50% { opacity: .9; transform: translate(calc(-50% + var(--star-offset) + 3px), -50%) scale(1); }
}

@media (max-width: 430px) {
  .capsule { gap: 4px; padding: 0; }
  .currentTime,
  .totalTime { min-width: 25px; font-size: 9px; }
}

@media (max-width: 350px) {
  .totalTime { display: none; }
  .capsule { min-width: 80px; }
}

@media (prefers-reduced-motion: reduce) {
  .capsule,
  .fill,
  .thumb,
  .starTrail { transition: none; }
  .star { animation: none; }
}
</style>
