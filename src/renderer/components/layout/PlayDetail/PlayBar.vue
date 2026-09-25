<template>
  <div :class="$style.footer">
    <!-- Luminous Harmonic: 进度条横跨整个软件宽度 (Pure-music 布局) -->
    <div :class="$style.progressRow">
      <span :class="$style.timeLabel">{{ nowPlayTimeStr }}</span>
      <div :class="$style.progressContainer">
        <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
          <span v-if="status" :class="$style.getStatus">{{ status }}</span>
        </transition>
        <common-progress-bar
          :class-name="$style.progress"
          :progress="progress"
          :handle-transition-end="handleTransitionEnd"
          :is-active-transition="isActiveTransition"
          :wave="true"
        />
      </div>
      <span :class="$style.timeLabel">{{ maxPlayTimeStr }}</span>
    </div>
    <!-- Luminous Harmonic: 控制行 — 播放控制居中, 功能按钮左右两组均匀分布 -->
    <div :class="$style.controlRow">
      <div :class="$style.sideTools">
        <control-btns part="left" />
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
      <div :class="[$style.sideTools, $style.sideRight]">
        <control-btns part="right" />
      </div>
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
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 6px;
  // Luminous Harmonic: 进度条横跨软件宽度, 时间标签贴两端
  padding: 8px 24px 12px;
  position: relative;
  z-index: 2;
  background: transparent;
  // Luminous Harmonic: 详情页控件跟随 accent（封面取色/主题色），并保持清晰可见
  color: var(--detail-accent-color, var(--color-font));
  --wave-progress-color: var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary)));
  --wave-progress-glow: color-mix(in srgb, var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary))) 55%, transparent);
}

// Luminous Harmonic: 进度条行 — 时间标签 + 进度条, 整行横跨
.progressRow {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.progressContainer {
  flex: 1 1 auto;
  position: relative;
  min-width: 0;
  // 与波浪进度条等高（wave 高 24px）
  height: 24px;
  display: flex;
  align-items: center;
}

.progress { height: 100%; }

// Luminous Harmonic: 「歌曲链接获取中」等状态提示 — 浮在进度条尾端上方,
// 不再挤占右侧功能按钮空间 (此前会把按钮顶出视野)
.getStatus {
  position: absolute;
  right: 0;
  bottom: 26px;
  color: var(--detail-font-bright, var(--color-font-label));
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  opacity: .9;
  text-shadow: var(--detail-font-shadow, none);
  pointer-events: none;
}

.timeLabel {
  flex: none;
  // 中性高对比文字色；封面取色模式近白 + 深阴影，主题模式回退主题文字色无阴影（清晰不模糊）
  color: var(--detail-font-bright, var(--color-font-label));
  font-size: 11px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-shadow: var(--detail-font-shadow, none);
}

// Luminous Harmonic: 控制行 — 播放控制绝对居中, 功能按钮分居两侧 (flex 1:1 对称夹持)
.controlRow {
  display: flex;
  align-items: center;
  min-width: 0;
}

.sideTools {
  flex: 1 1 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  min-width: 0;
  opacity: .78;
  transition: opacity .35s ease;
  &:hover { opacity: 1; }
}

.sideRight {
  justify-content: flex-end;
  overflow: hidden;
}

.playControl {
  flex: none;
  display: flex;
  height: 42px;
  align-items: center;
  justify-content: center;
  gap: 14px;
  // Luminous Harmonic: 控制排 hover 渐显降噪（Pure-music _AutoHidingControlBar 思路）—
  // 上一首/下一首非悬停时 0.35 透明度，播放键常显；悬停 .playControl 或键盘聚焦时全部浮现
  &:not(:hover):not(:focus-within) {
    .playBtn { opacity: .35; }
    .mainPlayBtn { opacity: 1; }
  }
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
  // 借鉴 Pure-music Monet: 功能按钮图标随封面强调色变化（亮化版）
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

.mainPlayBtn {
  width: 42px;
  height: 42px;
  padding: 11px;
  // 强调色上的文字用亮度对比色（Pure-music: luminance>阈值用黑, 否则白）
  color: var(--detail-on-accent, var(--color-on-primary, var(--color-primary-font)));
  // Luminous Harmonic: 播放按钮跟随「功能组件颜色」(--detail-accent-bright) — 与其他组件同源
  background: linear-gradient(150deg, color-mix(in srgb, var(--detail-accent-bright, var(--color-primary)) 72%, black), var(--detail-accent-bright, var(--color-primary)));
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

@media (max-width: 900px) {
  .footer { padding: 6px 16px 10px; }
  .sideTools { opacity: .6; }
  .playControl { gap: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  .footer,
  .sideTools,
  .playBtn { transition: none; }
}
</style>
