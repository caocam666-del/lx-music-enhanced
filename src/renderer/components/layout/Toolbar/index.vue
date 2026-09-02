<template>
  <div :class="[$style.toolbar, { [$style.fullscreen]: isFullscreen }, appSetting['common.controlBtnPosition'] == 'left' ? $style.controlBtnLeft : $style.controlBtnRight]">
    <SearchInput />
    <div v-if="appSetting['common.controlBtnPosition'] == 'left'" :class="$style.logo">L X</div>
    <ControlBtns v-else />
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import ControlBtns from './ControlBtns.vue'
import SearchInput from './SearchInput.vue'

</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// Luminous Harmonic: 顶栏玻璃化（60px，底部细描边）
.toolbar {
  display: flex;
  height: @height-toolbar;
  align-items: center;
  justify-content: space-between;
  padding-left: 20px;
  // 整 toolbar 都可拖动窗口 — 双击检测改用 mousedown 事件 (Electron drag 区会发 mousedown 但不发 click/dblclick)
  -webkit-app-region: drag;
  z-index: 2;
  box-sizing: border-box;
  background-color: color-mix(in srgb, var(--glass-surface-weak, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(1.3);
  border-bottom: 1px solid var(--glass-stroke, rgba(255, 255, 255, 0.08));

  &.fullscreen {
    -webkit-app-region: no-drag;
    .logo {
      display: none;
    }
  }

  &.controlBtnLeft {
    .control {
      display: none;
    }
  }
  &.controlBtnRight {
    justify-content: space-between;
  }
}

.logo {
  box-sizing: border-box;
  padding: 0 @height-toolbar * .4;
  height: @height-toolbar;
  color: var(--color-primary);
  flex: none;
  text-align: center;
  line-height: @height-toolbar;
  font-weight: bold;
  // -webkit-app-region: no-drag;
}

</style>
