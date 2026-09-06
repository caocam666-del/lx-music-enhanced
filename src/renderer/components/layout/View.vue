<template>
  <div :class="$style.view">
    <router-view v-slot="{ Component, route }">
      <component :is="Component" :key="route.fullPath" class="view-container" />
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
</style>
