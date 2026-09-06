<template>
  <div :class="$style.view">
    <router-view v-slot="{ Component, route }">
      <!-- Luminous Harmonic: 页面切换过渡 (180ms fade+slide), out-in 避免新旧页重叠 -->
      <!-- 注意: keep-alive 已暂时回退 — include 缓存与本项目视图的初始化时序存在兼容问题导致切换异常,
           待单独排查后再启用 (恢复 :key="route.path" 保证 query 变化重挂载的原始行为) -->
      <transition name="view-transition" mode="out-in">
        <component :is="Component" :key="route.fullPath" class="view-container" />
      </transition>
    </router-view>
  </div>
</template>

<script>
export default {
  setup() {
    return {}
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.view {
  // Luminous Harmonic: 显式声明 flex/height, 兜底 #view CSS 规则万一没匹配上 (避免 #view 坍塌 → 播放栏跑到顶部)
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  > :global(.view-container) {
    position: absolute !important;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
  }
}

// Luminous Harmonic: 页面进出过渡 — 入场 180ms 上滑淡入(entrance 曲线), 出场 120ms 快速淡出
// (transition 类名是全局的, 需用 :global 声明)
:global(.view-transition-enter-active) {
  transition: opacity @motion-base @ease-entrance, transform @motion-base @ease-entrance;
}
:global(.view-transition-leave-active) {
  transition: opacity @motion-fast @ease-standard, transform @motion-fast @ease-standard;
}
:global(.view-transition-enter-from) {
  opacity: 0;
  transform: translateY(8px);
}
:global(.view-transition-leave-to) {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
