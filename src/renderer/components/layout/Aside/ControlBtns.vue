<template>
  <div v-show="!isFullscreen" ref="dom_btns" :class="$style.controlBtn">
    <!-- Luminous Harmonic: 与 Toolbar 版统一的三钮窗口控制 (原仅 关闭+最小化 两颗, 缺最大化) -->
    <button type="button" :class="[$style.btn, $style.close]" :aria-label="$t('close')" ignore-tip :title="$t('close')" @click="closeWindow">
      <svg :class="$style.controlBtniIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-close" />
      </svg>
    </button>
    <button
      type="button"
      :class="[$style.btn, $style.max]"
      :aria-label="isMaximized ? $t('restore') : $t('max')"
      ignore-tip
      :title="isMaximized ? $t('restore') : $t('max')"
      @click="toggleMaximize"
    >
      <!-- 最大化时: 单层方框; 还原时: 双层叠加方框 (与 Toolbar 版一致) -->
      <svg v-if="!isMaximized" :class="$style.controlBtniIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <path d="M5 5h14v14H5V5zm2 2v10h10V7H7z" fill="currentColor" />
      </svg>
      <svg v-else :class="$style.controlBtniIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <path d="M9 3h12v12h-2V5H9V3z" fill="currentColor" />
        <path d="M3 9h12v12H3V9zm2 2v8h8v-8H5z" fill="currentColor" />
      </svg>
    </button>
    <button type="button" :class="[$style.btn, $style.min]" :aria-label="$t('min')" ignore-tip :title="$t('min')" @click="minWindow">
      <svg :class="$style.controlBtniIcon" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="100%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-minimize" />
      </svg>
    </button>
  </div>
</template>

<script setup>
import { minWindow, closeWindow } from '@renderer/utils/ipc'
import { onMounted, onBeforeUnmount, ref, useCssModule } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import { useWindowMaximize } from '@renderer/utils/compositions/useWindowMaximize'

const dom_btns = ref()

const cssModule = useCssModule()

// Luminous Harmonic: 伪最大化 — 复用与 Toolbar 版相同的 composable, 状态保持单一可信源
const { isMaximized, toggleMaximize } = useWindowMaximize()

const handle_focus = () => {
  if (!dom_btns.value) return
  dom_btns.value.classList.remove(cssModule.hover)
}
const handle_mouseenter = () => {
  dom_btns.value.classList.add(cssModule.hover)
}
const handle_mouseleave = () => {
  dom_btns.value.classList.remove(cssModule.hover)
}


onMounted(() => {
  window.app_event.on('focus', handle_focus)
  dom_btns.value.addEventListener('mouseenter', handle_mouseenter)
  dom_btns.value.addEventListener('mouseleave', handle_mouseleave)
})
onBeforeUnmount(() => {
  window.app_event.off('focus', handle_focus)
  dom_btns.value.removeEventListener('mouseenter', handle_mouseenter)
  dom_btns.value.removeEventListener('mouseleave', handle_mouseleave)
})

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * .26;
@control-btn-height: 6%;
.controlBtn {
  box-sizing: border-box;
  padding: 0 7px;
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  width: 100%;
  height: @control-btn-height;
  -webkit-app-region: no-drag;
  opacity: 1;
  transition: opacity @transition-normal;
  // Luminous Harmonic: 修复 hover 整组反而变暗 (原 opacity .8) — 悬停保持全亮
  &.hover {
    opacity: 1;
    .controlBtniIcon {
      opacity: 1;
    }
  }

}
.btn {
  position: relative;
  width: @control-btn-width;
  height: @control-btn-width;
  background: none;
  border: none;
  display: flex;
  outline: none;
  padding: 1px;
  cursor: pointer;
  border-radius: 50%;
  color: var(--color-font);
  transition: background-color 0.2s ease-in-out;

  &.min {
    background-color: var(--color-btn-min);
  }
  // Luminous Harmonic: 最大化钮 — 与 min/close 同风格的 macOS 彩点 (Toolbar 版为平面钮, 此处保持圆点语言)
  &.max {
    background-color: var(--color-btn-max, var(--color-btn-min));
  }
  &.close {
    background-color: var(--color-btn-close);
  }

  &.hover.min,
  &.hover.max {
    background-color: var(--color-button-background-hover);
  }
}

.controlBtniIcon {
  width: 100%;
  height: 100%;
  fill: currentColor;
  color: var(--color-font, #fff);
  opacity: 1;
  transition: opacity 0.2s ease-in-out;

  use {
    fill: currentColor !important;
  }
}


</style>
