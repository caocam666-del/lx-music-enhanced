<template>
  <div :class="[$style.aside, { [$style.fullscreen]: isFullscreen, [$style.collapsed]: appSetting['common.asideCollapsed'] }]">
    <!-- Luminous Harmonic: 顶部 Logo 块 — 折叠态下点 logo 即展开 -->
    <div :class="$style.brand" @click="appSetting['common.asideCollapsed'] && toggleCollapse()">
      <div :class="$style.logoBox">
        <!-- Luminous Harmonic: 内联 SVG logo, 不依赖 <use> 引用 (某些主题下 defs 引用可能丢失) -->
        <svg :class="$style.logoIcon" xmlns="http://www.w3.org/2000/svg" viewBox="-61 0 512 512" height="22" width="22" aria-hidden="true">
          <path d="m295 120.5h86.230469l-111.230469-111.695312v86.53125c0 13.875 11.214844 25.164062 25 25.164062zm0 0" fill="currentColor"/>
          <path d="m240 346.5c0 8.269531 6.730469 15 15 15s15-6.730469 15-15v-15.25h-15c-7.960938 0-15 6.324219-15 15.25zm0 0" fill="currentColor"/>
          <path d="m295 150.5c-30.328125 0-55-24.746094-55-55.167969v-95.332031h-185c-30.328125 0-55 24.746094-55 55.167969v401.667969c0 30.417968 24.671875 55.164062 55 55.164062h280c30.328125 0 55-24.746094 55-55.167969v-306.332031zm5 196c0 24.8125-20.1875 45-45 45s-45-20.1875-45-45c0-25.507812 20.53125-45.25 45-45.25h15v-56.144531l-90 22.59375v108.925781c0 24.8125-20.1875 45-45 45s-45-20.1875-45-45c0-25.507812 20.53125-45.25 45-45.25h15v-75.375c0-6.878906 4.675781-12.875 11.347656-14.546875l120-30.125c9.46875-2.382813 18.652344 4.796875 18.652344 14.546875zm0 0" fill="currentColor"/>
          <path d="m120 376.625c0 8.269531 6.730469 15 15 15s15-6.730469 15-15v-15.25h-15c-7.960938 0-15 6.324219-15 15.25zm0 0" fill="currentColor"/>
        </svg>
      </div>
      <div :class="$style.brandText">
        <h1 :class="$style.brandTitle">LX Music</h1>
        <p :class="$style.brandSub">{{ $t('aside__subtitle') }}</p>
      </div>
      <!-- Luminous Harmonic: 折叠切换已移至导航菜单底部 (NavBar 收起/展开侧边栏项) -->
    </div>

    <!-- Luminous Harmonic: 主导航 (5 项 + 设置在底部) -->
    <NavBar />

    <!-- Luminous Harmonic: 顶栏窗口控制按钮 (仅当 controlBtnPosition == 'left' 时放这里, 否则隐藏) -->
    <ControlBtns v-if="appSetting['common.controlBtnPosition'] == 'left'" :class="$style.controlBtns" />
  </div>
</template>

<script setup>
import { isFullscreen } from '@renderer/store'
import { appSetting, updateSetting } from '@renderer/store/setting'

import ControlBtns from './ControlBtns.vue'
import NavBar from './NavBar.vue'

// Luminous Harmonic: 侧栏折叠切换 (220px ↔ 72px 图标态)
const toggleCollapse = () => {
  updateSetting({ 'common.asideCollapsed': !appSetting['common.asideCollapsed'] })
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.aside {
  // Luminous Harmonic: 玻璃侧边栏 (220px 固定宽, 流光背景从右侧透出)
  position: relative;
  z-index: 10;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  padding: 20px 16px;
  background-color: color-mix(in srgb, var(--glass-surface, rgba(30, 32, 36, 0.45)) calc(var(--glass-alpha, 0.8) * 100%), transparent);
  backdrop-filter: blur(var(--glass-blur, 20px)) saturate(1.3);
  -webkit-backdrop-filter: blur(var(--glass-blur, 20px)) saturate(1.3);
  border-right: 1px solid var(--glass-stroke, rgba(255, 255, 255, 0.08));
  transition: @transition-normal;
  transition-property: background-color, border-color;

  &.fullscreen {
    // 全屏模式下占位仍保留, 但隐藏品牌头
    .brand {
      display: none;
    }
  }
}

.brand {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
  margin-bottom: 32px;
  // Luminous Harmonic: 折叠/展开时与侧栏宽度动画同步 (280ms), 不再瞬跳
  transition: gap 280ms cubic-bezier(0.4, 0, 0.2, 1), padding 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

// Luminous Harmonic: 折叠态 — 只藏文字, 保留 logo (点击展开) 与切换钮;
// 切换钮绝对定位到导航区顶部, 避免与 40px logo 争宽
.collapsed {
  .brand {
    gap: 0;
    padding: 4px 0;
    justify-content: center;
    cursor: pointer;
  }
  .brandText {
    opacity: 0;
  }
  .controlBtns {
    padding: 0;
  }
}

.logoBox {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background-color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px -2px var(--color-primary-alpha-700, rgba(173, 198, 255, 0.4));
}

.logoIcon {
  fill: #fff !important;
  color: #fff !important;
  width: 22px;
  height: 22px;

  * {
    fill: #fff !important;
    color: #fff !important;
  }
}

.brandText {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  transition: opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

.brandTitle {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: -0.01em;
  line-height: 1.2;
  margin: 0;
}

.brandSub {
  font-size: 11px;
  color: var(--color-font-label);
  opacity: 0.7;
  margin: 2px 0 0 0;
  letter-spacing: 0.02em;
}

.controlBtns {
  margin-top: auto;
}
</style>
