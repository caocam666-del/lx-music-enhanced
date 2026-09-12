<template>
  <div :class="$style.footer">
    <div :class="$style.footerTools">
      <control-btns />
    </div>
    <div :class="$style.playCore">
      <!-- Luminous Harmonic: Pure-music 布局 — 进度条独立整行置顶，时间标签在条上方两端对齐 -->
      <div :class="$style.timeRow">
        <span :class="$style.timeLabel">{{ nowPlayTimeStr }}</span>
        <span :class="$style.timeLabel">{{ maxPlayTimeStr }}</span>
      </div>
      <div :class="$style.progressContainer">
        <common-progress-bar
          :class-name="$style.progress"
          :progress="progress"
          :handle-transition-end="handleTransitionEnd"
          :is-active-transition="isActiveTransition"
          :wave="true"
        />
      </div>
      <div :class="$style.playControl">
        <div :class="$style.playBtn" :aria-label="$t('player__prev')" @click="playPrev()">
          <svg viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-prevMusic" /></svg>
        </div>
        <div data-player-toggle :class="[$style.playBtn, $style.mainPlayBtn]" :aria-label="isPlay ? $t('player__pause') : $t('player__play')" @click="togglePlay">
          <span :class="[$style.iconMorph, { [$style.iconMorphActive]: isPlay }]">
            <svg class="icon-pause" viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-pause" /></svg>
            <svg class="icon-play" viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-play" /></svg>
          </span>
        </div>
        <div :class="$style.playBtn" :aria-label="$t('player__next')" @click="playNext()">
          <svg viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-nextMusic" /></svg>
        </div>
      </div>
    </div>
    <div :class="$style.footerStatus">
      <span :class="$style.status">{{ status }}</span>
    </div>
  </div>
</template>

<script setup>
import { playNext, playPrev, togglePlay } from '@renderer/core/player'
import { status, isPlay } from '@renderer/store/player/state'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import ControlBtns from './components/ControlBtns.vue'

const {
  nowPlayTimeStr,
  maxPlayTimeStr,
  progress,
  isActiveTransition,
  handleTransitionEnd,
} = usePlayProgress()
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footer {
  flex: 0 0 104px;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(290px, 1fr) minmax(420px, 1.35fr) minmax(110px, .42fr);
  align-items: center;
  gap: 22px;
  // Luminous Harmonic: 左右 padding 与 .main 的 44px 对齐（竖直参考线一致）
  padding: 10px 44px 14px;
  position: relative;
  z-index: 2;
  background: transparent;
  // Luminous Harmonic: 详情页控件跟随 accent（封面取色/主题色），并保持清晰可见
  color: var(--detail-accent-color, var(--color-font));
  --wave-progress-color: var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary)));
  --wave-progress-glow: color-mix(in srgb, var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary))) 55%, transparent);
}

.footerTools,
.playCore,
.footerStatus {
  min-width: 0;
}

.footerTools {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  overflow: hidden;
  opacity: .78;
  transition: opacity .35s ease;
  &:hover { opacity: 1; }
}

.playCore {
  display: flex;
  flex-flow: column nowrap;
  align-items: stretch;
  justify-content: center;
  min-width: 0;
  gap: 5px;
}

// Luminous Harmonic: 时间标签行 — 进度条上方两端对齐（Pure-music 布局）
.timeRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  line-height: 1;
}

.playControl {
  display: flex;
  height: 30px;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.playBtn {
  display: flex;
  flex: none;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border-radius: 50%;
  // 借鉴 Pure-music Monet: 功能按钮图标随封面强调色变化（亮化版），深阴影保证清晰
  color: var(--detail-accent-bright, var(--color-font));
  cursor: pointer;
  text-shadow: var(--detail-font-shadow, 0 1px 3px rgb(0 0 0 / .7));
  transition: color @transition-fast, transform @transition-fast, opacity @transition-fast, box-shadow .4s ease;

  svg { width: 100%; height: 100%; fill: currentColor; filter: drop-shadow(0 1px 2px rgb(0 0 0 / .5)); }
  &:hover {
    color: color-mix(in srgb, var(--detail-accent-bright, var(--color-font)) 82%, white);
    transform: scale(1.08);
  }
  &:active { transform: scale(.94); }
}

// Luminous Harmonic: 控制排 hover 渐显降噪（Pure-music _AutoHidingControlBar 思路）—
// 上一首/下一首非悬停时 0.35 透明度，播放键常显；悬停 .playCore 或键盘聚焦时全部浮现
.playControl:not(:hover):not(:focus-within) {
  .playBtn { opacity: .35; }
  .mainPlayBtn { opacity: 1; }
}

.mainPlayBtn {
  width: 42px;
  height: 42px;
  padding: 11px;
  // 强调色上的文字用亮度对比色（Pure-music: luminance>阈值用黑, 否则白）
  color: var(--detail-on-accent, var(--color-on-primary, var(--color-primary-font)));
  // 压暗版 accent 作背景（强调），保证图标对比清晰
  // Luminous Harmonic: 播放按钮用主题色 — 原始封面色在灰白封面上发虚 (Pure-music UI 强调色 = scheme.primary)
  background: linear-gradient(150deg, color-mix(in srgb, var(--color-primary) 76%, black), var(--color-primary));
  box-shadow: 0 4px 16px color-mix(in srgb, var(--color-app-background) 42%, transparent), 0 0 0 1px rgb(255 255 255 / .14);
  &:hover {
    color: var(--detail-on-accent, var(--color-on-primary, var(--color-primary-font)));
    transform: scale(1.06);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--color-app-background) 48%, transparent), 0 0 0 1px rgb(255 255 255 / .2);
  }
}

// Luminous Harmonic: 播放/暂停图标形变（Pure-music AnimatedIcons.play_pause 同款，
// 240ms cubic-bezier(0.2,0,0,1) 交叉过渡 + 缩放旋转）
.iconMorph {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: currentColor;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / .4));
    transition: opacity .24s cubic-bezier(.2, 0, 0, 1), transform .24s cubic-bezier(.2, 0, 0, 1);
  }
  :global(.icon-pause) { opacity: 0; transform: scale(.5) rotate(-24deg); }
  :global(.icon-play) { opacity: 1; transform: scale(1) rotate(0); }
}
.iconMorphActive {
  :global(.icon-pause) { opacity: 1; transform: scale(1) rotate(0); }
  :global(.icon-play) { opacity: 0; transform: scale(.5) rotate(24deg); }
}

.progressContainer {
  position: relative;
  min-width: 0;
  // 与波浪进度条等高（wave 高 24px），整行铺满 playCore 宽度
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
}

.progress { height: 100%; }

.timeLabel {
  // 中性高对比文字色；封面取色模式近白 + 深阴影，主题模式回退主题文字色无阴影（清晰不模糊）
  color: var(--detail-font-bright, var(--color-font-label));
  font-size: 11px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-shadow: var(--detail-font-shadow, none);
}

.footerStatus {
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.status {
  max-width: 100%;
  overflow: hidden;
  color: var(--detail-font-bright, var(--color-font-label));
  font-size: 11px;
  opacity: .85;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: var(--detail-font-shadow, none);
}

@media (max-width: 1000px) {
  .footer { grid-template-columns: minmax(220px, 1fr) minmax(360px, 1.45fr) 70px; gap: 12px; padding-left: 20px; padding-right: 20px; }
}

@media (max-width: 760px) {
  .footer { grid-template-columns: 1fr; grid-template-rows: 26px 1fr; flex-basis: 112px; gap: 4px; padding: 8px 16px 12px; }
  .footerTools { grid-row: 2; justify-content: center; }
  .playCore { grid-row: 1; }
  .footerStatus { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .footer,
  .footerTools,
  .playBtn { transition: none; }
}
</style>
