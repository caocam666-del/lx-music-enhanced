<template>
  <!-- Luminous Harmonic: #player 宿主节点 — App.vue 的 CSS (#player{height;flex}) 依赖这个 id。
       必须放在真实 DOM 上: transition 不透传 attrs, 之前直接包 transition 导致 id 丢失,
       #player 高度约束失效, 播放栏悬在窗口中部 (下方大片空白)。
       注意: 模式切换曾包 <transition mode="out-in"> — CSS 过渡在部分状态下会卡死
       (transitionend 不触发且无超时兜底), 导致切换模式后 DOM 停留在旧组件, 故移除。 -->
  <div id="player">
    <FullWidthProgress v-if="appSetting['common.playBarProgressStyle'] == 'full'" />
    <MiddleWidthProgress v-else-if="appSetting['common.playBarProgressStyle'] == 'middle'" />
    <MiniWidthProgress v-else />
  </div>
</template>

<script setup>
import { appSetting } from '@renderer/store/setting'
import MiniWidthProgress from './MiniWidthProgress.vue'
import FullWidthProgress from './FullWidthProgress.vue'
import MiddleWidthProgress from './MiddleWidthProgress.vue'

</script>
