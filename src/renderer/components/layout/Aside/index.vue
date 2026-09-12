<template>
  <div :class="[$style.aside, { [$style.fullscreen]: isFullscreen, [$style.collapsed]: appSetting['common.asideCollapsed'] }]">
    <!-- Luminous Harmonic: 顶部 Logo 块 — 折叠态下点 logo 即展开 -->
    <div :class="$style.brand" @click="appSetting['common.asideCollapsed'] && toggleCollapse()">
      <div :class="$style.logoBox">
        <!-- Luminous Harmonic: 透明简笔音符 logo (线性描边, 跟随主题色) — 无背景块 -->
        <svg :class="$style.logoIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="24" height="24" aria-hidden="true">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
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
  // Luminous Harmonic: 透明简笔音符 — 无背景块无投影, 颜色跟随主题
  display: flex;
  align-items: center;
  justify-content: center;
}

.logoIcon {
  display: block;
  color: var(--color-primary);
  width: 26px;
  height: 26px;
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
