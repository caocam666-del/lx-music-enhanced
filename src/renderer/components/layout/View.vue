<template>
  <div :class="$style.view" :style="{ '--lx-nav-dir': navDir }">
    <router-view v-slot="{ Component, route }">
      <!--
        Luminous Harmonic: 页面切换 — 复刻 pure-music DirectionalTabView 的切换方式:
        1. 新旧页面**并行**过渡 (去掉 out-in: out-in 中间存在空档, 旧页已走新页未到,
           背景裸露一帧 → "一闪一闪像刷新桌面")
        2. 新页按菜单方向水平滑入 (PPT 式, 20px×方向, --lx-nav-dir 由下方 watch 提供),
           旧页同时快速淡出让位
        3. key 用 route.path 而非 fullPath — 排行榜/歌单/搜索等页面本来就是"query 驱动 +
           beforeRouteUpdate 就地更新"的设计 (榜单/音源/标签/分页切换都是 router.replace 改 query)。
           之前用 fullPath 做 key: query 一变整个页面重挂载并触发过渡动画 →
           排行榜榜单/音源切换失效 (并行过渡下重挂载竞态) 且歌单切换带整页动画。
           改为 path: 同页面内 query 变化 → 同一实例就地更新, 内容立即显示 (与设置页子菜单一致);
           侧栏菜单切换 (path 变化) → 仍保留方向性滑动过渡
        4. 伪影 (重影/滚动条跳动) 的处理见底部 CSS 注释
      -->
      <transition name="view-transition">
        <component :is="Component" :key="route.path" class="view-container" />
      </transition>
    </router-view>
  </div>
</template>

<script>
import { ref, watch } from '@common/utils/vueTools'
import { useRoute } from '@common/utils/vueRouter'

// 侧栏菜单序 (router.ts 中的一级路由 + songList 组) — 用于计算切换方向
const NAV_ORDER = ['/search', '/songList', '/leaderboard', '/list', '/download', '/setting']
const orderOf = (path) => {
  const i = NAV_ORDER.findIndex(base => path === base || path.startsWith(base + '/') || path.startsWith(base + '?'))
  return i < 0 ? 0 : i
}

export default {
  setup() {
    const route = useRoute()
    const navDir = ref(1)
    watch(() => route.fullPath, (to, from) => {
      navDir.value = orderOf(to) >= orderOf(from) ? 1 : -1
    }, { immediate: true })
    return { navDir }
  },
}
</script>

<style lang="less" module>
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

// Luminous Harmonic: 页面进出过渡 — 方向性滑动 (puremusic PPT 式) + 快速淡出。
// 伪影修复 (之前"重影/一闪一闪/滚动条跳动"):
// 1. 退场页**只淡出、不做 translate 位移** — 位移会把旧页的滚动条/滑块整体带着横移再弹回,
//    表现为"所有东西连滚动条都在跳"; 淡出 150ms 快速让位, 也压短了新旧页透明叠加的重影时间
// 2. 入场页 z-index 抬到旧页之上, 保证新页在前的 PPT 层次
// 3. will-change 把过渡固定在合成层, 避免大列表页动画掉帧产生的"跳动"
// (transition 类名是全局的, 需用 :global 声明; 方向由 --lx-nav-dir 控制)
:global(.view-transition-enter-active) {
  transition: opacity 260ms cubic-bezier(0.4, 0, 0.2, 1), transform 260ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
  z-index: 2;
}
:global(.view-transition-leave-active) {
  transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 1;
}
:global(.view-transition-enter-from) {
  opacity: 0.5;
  transform: translateX(calc(20px * var(--lx-nav-dir, 1)));
}
:global(.view-transition-leave-to) {
  opacity: 0;
}
</style>
