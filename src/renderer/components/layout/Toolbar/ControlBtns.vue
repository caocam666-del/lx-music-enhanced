<template>
  <div v-show="!isFullscreen" ref="dom_btns" :class="$style.control">
    <button type="button" :class="[$style.btn, $style.min]" :aria-label="$t('min')" ignore-tip :title="$t('min')" @click="minWindow">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-minimize-2" />
      </svg>
    </button>
    <!--
      Luminous Harmonic: max/restore 按钮 (洛雪原版没有, 用户要求)
      关键修复: 主进程 BrowserWindow 创建时 maximizable:false → browserWindow.unmaximize() 不响应,
      一旦 maximize() 就卡死. 改成走 setWindowBounds IPC 伪最大化: 铺满 availWidth/availHeight,
      还原时再用同一 IPC 设回 windowSizeList 中的 preset 大小并居中.
      icon 也跟随状态切换 (单框 = 最大化, 双层框 = 还原)
    -->
    <button
      type="button"
      :class="[$style.btn, $style.max]"
      :aria-label="isMaximized ? ($t('restore') || '还原') : ($t('max') || '最大化')"
      ignore-tip
      :title="isMaximized ? ($t('restore') || '还原') : ($t('max') || '最大化')"
      @click="toggleMaximize"
    >
      <!-- 最大化时: 单层方框 icon; 还原时: 双层叠加方框 icon -->
      <svg v-if="!isMaximized" xmlns="http://www.w3.org/2000/svg" height="60%" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h14v14H5V5zm2 2v10h10V7H7z" fill="currentColor" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" height="60%" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h9v2H7v7H5V5zm5 5h9v9h-9v-9zm2 2v5h5v-5h-5z" fill="currentColor" />
      </svg>
    </button>
    <button type="button" :class="[$style.btn, $style.close]" :aria-label="$t('close')" ignore-tip :title="$t('close')" @click="closeWindow">
      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="60%" viewBox="0 0 24 24" space="preserve">
        <use xlink:href="#icon-window-close-2" />
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

// Luminous Harmonic: max 按钮的"伪最大化"状态 — 复用共享 composable,
// 这样顶栏双击放大 / 还原 与 这个按钮的 icon 状态 始终保持同步 (单一可信源).
const { isMaximized, toggleMaximize } = useWindowMaximize()

const handle_focus = () => {
  if (!dom_btns.value) return
  for (const node of dom_btns.value.childNodes) {
    if (node.tagName != 'BUTTON') continue
    node.classList.remove(cssModule.hover)
  }
}
const getBtnEl = (el) => el.tagName == 'BUTTON' || !el ? el : getBtnEl(el.parentNode)
const handle_mouseover = (event) => {
  const btn = getBtnEl(event.target)
  if (!btn) return
  btn.classList.add(cssModule.hover)
}
const handle_mouseout = (event) => {
  const btn = getBtnEl(event.target)
  if (!btn) return
  btn.classList.remove(cssModule.hover)
}

onMounted(() => {
  window.app_event.on('focus', handle_focus)
  dom_btns.value.addEventListener('mouseover', handle_mouseover)
  dom_btns.value.addEventListener('mouseout', handle_mouseout)
})
onBeforeUnmount(() => {
  window.app_event.off('focus', handle_focus)
  dom_btns.value.removeEventListener('mouseover', handle_mouseover)
  dom_btns.value.removeEventListener('mouseout', handle_mouseout)
})
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.control {
  display: flex;
  align-self: flex-start;
  -webkit-app-region: no-drag;
  height: 30px;

  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    width: 46px;
    height: 30px;
    background: none;
    border: none;
    outline: none;
    padding: 1px;
    cursor: pointer;
    color: var(--color-font-label);
    transition: background-color 0.2s ease-in-out;
    &.hover {
      &.min, &.max {
        background-color: var(--color-button-background-hover);
      }
      &.close {
        background-color: var(--color-btn-close);
      }
    }
  }

  svg {
    fill: currentColor;
    color: var(--color-font, #fff);
  }
}

</style>
