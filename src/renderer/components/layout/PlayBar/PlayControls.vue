<template>
  <!-- Luminous Harmonic: 播放控制三连 (prev / ▶ / next) — 三种播放栏模式共用,
       尺寸统一 32px 主钮 + 30px 副钮, 颜色走 --detail-accent (详情页打开时跟随封面取色) -->
  <button type="button" :class="$style.controlBtn" :aria-label="$t('player__prev')" @click="playPrev()">
    <svg viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-prevMusic" /></svg>
  </button>
  <button
    type="button"
    data-player-toggle
    :class="[$style.controlBtn, $style.togglePlayBtn]"
    :aria-label="isPlay ? $t('player__pause') : $t('player__play')"
    @click="togglePlay"
  >
    <span :class="[$style.iconMorph, { [$style.iconMorphActive]: isPlay }]">
      <svg class="icon-pause" viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-pause" /></svg>
      <svg class="icon-play" viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-play" /></svg>
    </span>
  </button>
  <button type="button" :class="$style.controlBtn" :aria-label="$t('player__next')" @click="playNext()">
    <svg viewBox="0 0 1024 1024" aria-hidden="true"><use xlink:href="#icon-nextMusic" /></svg>
  </button>
</template>

<script>
import { isPlay } from '@renderer/store/player/state'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'

export default {
  name: 'PlayBarControls',
  setup() {
    return { isPlay, togglePlay, playNext, playPrev }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.controlBtn {
  display: flex;
  flex: none;
  width: 30px;
  height: 30px;
  // 项目无全局 border-box, padding 会把按钮撑到 42px 播破胶囊高度预算 (详情页容器有局部 border-box 所以同写法无恙)
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--detail-accent-bright, var(--color-font));
  cursor: pointer;
  transition: color @transition-fast, transform @transition-fast, opacity @transition-fast;

  svg { width: 100%; height: 100%; fill: currentColor; }
  &:hover {
    color: color-mix(in srgb, var(--detail-accent-bright, var(--color-font)) 82%, white);
    transform: scale(1.08);
  }
  &:active { transform: scale(.94); }
}

// 主播放钮 — 三模式统一 32px 圆形 accent 底
.togglePlayBtn {
  width: 32px;
  height: 32px;
  padding: 9px;
  margin: 0 2px;
  color: var(--detail-on-accent, var(--color-on-primary, var(--color-primary-font)));
  background: var(--detail-accent-color, var(--color-primary));
  box-shadow: 0 3px 12px color-mix(in srgb, var(--detail-accent-color, var(--color-primary)) 45%, transparent);

  &:hover {
    color: var(--detail-on-accent, var(--color-on-primary, var(--color-primary-font)));
    background: color-mix(in srgb, var(--detail-accent-color, var(--color-primary)) 88%, white);
    transform: scale(1.06);
  }
}

// Luminous Harmonic: 播放/暂停图标形变（240ms cubic-bezier(0.2,0,0,1) 交叉过渡，三模式共用）
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
    transition: opacity .24s cubic-bezier(.2, 0, 0, 1), transform .24s cubic-bezier(.2, 0, 0, 1);
  }
  :global(.icon-pause) { opacity: 0; transform: scale(.5) rotate(-24deg); }
  :global(.icon-play) { opacity: 1; transform: scale(1) rotate(0); }
}
.iconMorphActive {
  :global(.icon-pause) { opacity: 1; transform: scale(1) rotate(0); }
  :global(.icon-play) { opacity: 0; transform: scale(.5) rotate(24deg); }
}
</style>
