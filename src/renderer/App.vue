<template>
  <div id="container" class="view-container">
    <!-- Luminous Harmonic: 自定义壁纸背景层 (z-index:-2, 在流���球后面) -->
    <div id="lx-wallpaper-bg" aria-hidden="true"></div>
    <!-- Luminous Harmonic: 壁纸模糊底衬层 (z-index:-3) — 方形预览图 (WE 场景/web) 用 contain
         完整显示时, 两侧透出同一张图的 cover 放大模糊版, 避免"只占中间一条"的空旷感 -->
    <div id="lx-wallpaper-backdrop" aria-hidden="true"></div>
    <!-- Luminous Harmonic: Wallpaper Engine 视频壁纸层 (默认隐藏, 应用视频壁纸时显示) -->
    <video id="lx-wallpaper-video" aria-hidden="true" style="display:none" muted loop playsinline></video>
    <!-- Luminous Harmonic: 流光背景层 (3 个渐变球慢速漂移) -->
    <div id="luminous-bg" aria-hidden="true">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <!--
      Luminous Harmonic: 把 #left 和 #right 包进 #main, 高度填满剩余空间,
      #player 提到 #container 直接子级, 真正横跨整个窗口底部 (覆盖侧栏底部 220px 区域, 不再有左侧白边)
    -->
    <div id="main">
      <layout-aside id="left" :class="{ collapsed: appSetting['common.asideCollapsed'] }" />
      <div id="right">
        <layout-toolbar id="toolbar" />
        <layout-view id="view" />
      </div>
    </div>
    <layout-play-bar id="player" />
    <layout-icons />
    <layout-change-log-modal />
    <layout-update-modal />
    <layout-pact-modal />
    <layout-sync-mode-modal />
    <layout-sync-auth-code-modal />
    <layout-play-detail />
    <!--
      Luminous Harmonic: 浮动"主界面"置顶按钮 — Teleport 挂到 body 级别,
      彻底脱离 #container/.view 的 stacking context.
      仅在播放详情页打开时显示 (它是详情页卡死时的兜底逃生口, 主界面常驻反而遮挡列表内容);
      z-index 10002: 压过 Tips/Modal 即可, 不再顶到 2147483647.
      关键: 这个 Teleport 必须待在 App.vue (根组件, 永远不卸载) 里, 不能塞进会随路由
      切换而卸载的 View.vue — 否则 View.vue 卸载时, Teleport 子节点走
      unmountChildren → unmountComponent 会因 type 为 null 崩溃
      "Cannot read properties of null (reading 'type')". App.vue 不随路由卸载, 所以安全.
      注意: App.vue 的 <style> 是全局 (非 module), 因此这里用普通 class="backHome".
    -->
    <Teleport to="body">
      <button v-if="isShowPlayerDetail" class="backHome" :aria-label="$t('back_home')" :title="$t('back_home')" @click="goHome">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path d="M12 3l9 8h-3v9h-5v-6H10v6H5v-9H2l10-8z" fill="currentColor" />
        </svg>
        <span>{{ $t('back_home') }}</span>
      </button>
    </Teleport>
  </div>
</template>

<script setup>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import useApp from '@renderer/core/useApp'
import { appSetting } from '@renderer/store/setting'
import { applyWallpaper, restoreWallpaperEngine } from '@renderer/utils/wallpaper'
import { isShowPlayerDetail } from '@renderer/store/player/state'
import { setShowPlayerDetail } from '@renderer/store/player/action'
import { restartApp } from '@renderer/utils/ipc'
// Luminous Harmonic: 启动时恢复上次的 Wallpaper Engine 壁纸
onMounted(() => {
  restoreWallpaperEngine()
})

useApp()

// Restore visual preferences before the first route is rendered.
const readVisualPreference = (key, fallback, min, max) => {
  const value = Number(localStorage.getItem(key))
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
const visualStyle = document.documentElement.style
visualStyle.setProperty('--glass-alpha', readVisualPreference('lx-glassAlpha', 80, 30, 100) / 100)
visualStyle.setProperty('--lx-bg-alpha', readVisualPreference('lx-bgAlpha', 100, 40, 100) / 100)

const router = useRouter()

// 兜底"返回主界面": Home/F5 之外, 浮动按钮也走这里 (View.vue 路由切换时会卸载,
// 所以 Teleport 按钮已迁到本文件, 本函数提供给它调用)
const goHome = () => {
  setShowPlayerDetail(false)
  void router.push('/search')
}

// Luminous Harmonic: 兜底快捷键 - Home 键强制回到主界面
// 注意: F5 这里**绝不拦截**(不再 preventDefault), 保留浏览器原生"整页刷新".
// 之前把 F5 改成 router.push('/search') 反而把用户困在坏掉的 HMR 实时态里
// (路由/点击都失效, 因为实时 App 的响应式已损坏), 必须靠真正的 reload 才能恢复.
const handleGoHomeKey = (e) => {
  if (e.key === 'F5') {
    e.preventDefault()
    restartApp()
    return
  }
  if (e.key === 'Home') {
    e.preventDefault()
    void router.push('/search')
  }
}
// Luminous Harmonic: 滚动条滚动可见性 — 全局捕获 scroll 事件, 给正在滚动的 .scroll 容器
// 加 .is-scrolling (滚动条浮现), 停止滚动约 1s 后移除 (样式见 index.less .scroll)
const scrollTimers = new WeakMap()
const handleScrollVisibility = (e) => {
  const el = e.target
  if (!(el instanceof Element) || !el.classList?.contains('scroll')) return
  el.classList.add('is-scrolling')
  const prev = scrollTimers.get(el)
  if (prev) clearTimeout(prev)
  scrollTimers.set(el, window.setTimeout(() => { el.classList.remove('is-scrolling') }, 1000))
}
onMounted(() => {
  document.getElementById('root').style.display = 'block'
  window.addEventListener('keydown', handleGoHomeKey, true)
  window.addEventListener('scroll', handleScrollVisibility, true)
  // Luminous Harmonic: 启动时恢复自定义壁纸 (含亮度自适应透明度)
  const savedWallpaper = localStorage.getItem('lx-wallpaper')
  if (savedWallpaper) applyWallpaper(savedWallpaper)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGoHomeKey, true)
  window.removeEventListener('scroll', handleScrollVisibility, true)
})

// onBeforeUnmount(() => {
//   window.lxData.bubbleCursor?.destroy()
// })

</script>


<style lang="less">
@import './assets/styles/index.less';
@import './assets/styles/layout.less';
@import './assets/styles/glass.less';

html {
  height: 100vh;
}
html, body {
  box-sizing: border-box;
  // Luminous Harmonic: html 必须显式 100% — 否则 body 的 height:100% 无法解析,
  // 整个高度链(#root/#container)退化为"内容高度", 短内容页面时播放栏会浮到窗口中部
  height: 100%;
}

body {
  user-select: none;
  height: 100%;
  // Luminous Harmonic: body 透出 #root 的流光背景
  background-color: transparent;
}
#root {
  height: 100%;
  position: relative;
  overflow: hidden;
  color: var(--color-font);
  transition: background-color @transition-normal;
  background-color: color-mix(in srgb, var(--color-content-background, var(--luminous-bg-base, #111318)) calc(var(--lx-bg-alpha, 1) * 100%), transparent);
  box-sizing: border-box;
}

.disableAnimation * {
  transition: none !important;
  animation: none !important;
}

// Luminous Harmonic: 最大化状态 — 去掉四周透明 padding 与圆角, 完全铺满工作区
html.lx-maximized.transparent {
  padding: 0;
  #body,
  #root {
    border-radius: 0;
    box-shadow: none;
  }
}

.transparent {
  background: transparent;
  padding: @shadow-app;
  #body {
    border-radius: @radius-border;
  }
  #root {
    box-shadow: 0 0 @shadow-app rgba(0, 0, 0, 0.5);
    border-radius: @radius-border;
  }
  // Luminous Harmonic: 壁纸/流光层已改为 absolute 定位在 #container 内 (见 luminous.less),
  // 由 #root 的 overflow:hidden + 圆角自然裁剪 — 不再用 fixed+inset 手工对齐
  // (fixed 会逃逸 overflow 裁剪, 且 fixed inset+width:100% 会超出窗口边界, 壁纸溢出到软件边界外)
}
.disableTransparent {
  background-color: color-mix(in srgb, var(--color-content-background, var(--luminous-bg-base, #111318)) calc(var(--lx-bg-alpha, 1) * 100%), transparent);

  #body {
    border: 1Px solid var(--color-primary-light-500);
  }
}
.fullscreen {
  background-color: color-mix(in srgb, var(--color-content-background, var(--luminous-bg-base, #111318)) calc(var(--lx-bg-alpha, 1) * 100%), transparent);
}

#container {
  // Luminous Harmonic: column 布局, #main 占满剩余高度, #player 在底部
  position: relative;
  z-index: 1;
  display: flex;
  flex-flow: column nowrap;
  height: 100%;
  // #right 透明, 让 #root 的流光背景透过
  background-color: transparent;
}
#main {
  // Luminous Harmonic: row 布局, #left + #right 平分宽度 (右侧 flex:auto)
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-flow: row nowrap;
  height: 100%;
  overflow: hidden;
  // Luminous Harmonic: 显式抬到背景层(#luminous-bg z-index:-1)之上, 保证内容无论如何都在流光背景前面
  position: relative;
  z-index: 1;
}

#left {
  flex: none;
  width: @width-app-left;
  // Luminous Harmonic: 侧栏折叠过渡 (220px ↔ 72px 图标态, Pure-music SideNav 同款 280ms lerp)
  transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);

  &.collapsed {
    width: 72px;
  }
}
#right {
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  min-height: 0;
  transition: background-color @transition-normal;
  // Luminous Harmonic: #right 改为透明, 去掉圆角/阴影/边框 (之前的"面板嵌面板"消失)
  background-color: transparent;
  overflow: hidden;
  border: none;
  box-shadow: none;
  border-radius: 0;
}
#toolbar {
  flex: none;
  width: 100%; // Luminous Harmonic: 顶栏必须横跨 #right 整个顶部
}
#player {
  // Luminous Harmonic: #player 提到 #container 直接子级 → 横跨整个窗口底部
  // flex column + 居中: 模式胶囊高度不同 (全宽 72 / 迷你 84 / 中等 ~98) 都垂直居中于容器
  flex: none;
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  // 引用 variables.less 的常量 (原硬编码 84px 与 @height-player: 110px 死值脱节, 曾导致 middle 模式溢出)
  height: @height-player;
}
#view {
  position: relative;
  flex: auto;
  min-height: 0;
}

// Luminous Harmonic: 浮动"返回主界面"按钮 (兜底: 视图区空白 / HMR 渲染失败 / PlayDetail 全屏卡死)
// 普通全局 class (App.vue <style> 非 module). 挂到 body (Teleport), z-index 顶到最高压过洛雪所有内置界面.
// right/bottom 定位 — 浮在播放栏胶囊右上方一点, 不遮挡内容.
.backHome {
  position: fixed;
  right: 16px;
  bottom: 100px; // 播放栏容器 84px + 8px margin ≈ 92, 再往上留 8px 空隙
  // Luminous Harmonic: 压过 Tips(10001)/Modal(100) 即可, 不再顶到 int32 最大值
  z-index: 10002;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--glass-stroke-strong, rgba(255, 255, 255, 0.12));
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--glass-surface-strong, var(--color-content-background)) calc(var(--glass-alpha, .8) * 100%), transparent);
  color: var(--color-font);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(var(--glass-blur-strong, 24px)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--glass-blur-strong, 24px)) saturate(1.4);
  transition: background-color @transition-fast, transform @transition-fast, color @transition-fast;
  user-select: none;

  svg { fill: currentColor; }
  &:hover {
    background-color: var(--color-primary-light-300-alpha-700);
    color: var(--color-primary);
    transform: translateY(-1px);
  }
  &:active { transform: translateY(0); }
}

.view-container {
  transition: opacity @transition-normal;
}
#root.show-modal > .view-container {
  opacity: .9;
}
#view.show-modal > .view-container {
  opacity: .2;
}

</style>
