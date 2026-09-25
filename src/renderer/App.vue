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
  </div>
</template>

<script setup>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import useApp from '@renderer/core/useApp'
import { appSetting } from '@renderer/store/setting'
import { applyWallpaper, restoreWallpaperEngine } from '@renderer/utils/wallpaper'
import { applyVisualPreferences } from '@renderer/utils/visualPreferences'
import { isShowPlayerDetail } from '@renderer/store/player/state'
import { restartApp } from '@renderer/utils/ipc'
// Luminous Harmonic: 启动时恢复上次的 Wallpaper Engine 壁纸
onMounted(() => {
  restoreWallpaperEngine()
})

useApp()

// Luminous Harmonic: 首屏渲染前恢复全部视觉偏好 (圆角/卡片透明度/背景透明度/背景强度/模糊) —
// 与外观与主题页的 applyUI 共用同一实现, 修复"启动半透明、必须进外观与主题页才恢复"
applyVisualPreferences()

const router = useRouter()

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
  // Luminous Harmonic: 启动时恢复壁纸 — WE 壁纸优先 (restoreWallpaperEngine 见上方 onMounted);
  // 二者写同一背景层, 仅当没有 WE 壁纸时才恢复自定义壁纸 (兼容互斥改造前的存量数据)
  const savedWallpaper = localStorage.getItem('lx-wallpaper')
  if (savedWallpaper && !localStorage.getItem('lx-we-current')) applyWallpaper(savedWallpaper)
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
