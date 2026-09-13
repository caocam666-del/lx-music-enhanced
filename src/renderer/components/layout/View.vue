<template>
  <div :class="$style.view">
    <router-view v-slot="{ Component, route }">
      <!-- Luminous Harmonic: key 必须用 route.path (不能加 query/fullPath) —
           fullPath 会让 query 变化时整个页面组件销毁重建, 导致:
           滚动位置丢失(点击列表项跳回顶部)、排行榜/下拉菜单重挂载后状态错乱、
           每次切榜都要重新请求. 组件内部通过 watch route.query 自行响应变化. -->
      <component :is="Component" :key="route.path" class="view-container" />
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
