<template>
  <transition name="tips-fade" @after-leave="afterLeave">
    <div
      v-show="visible" ref="dom_tips" :style="{ left: position.left + 'px' , top: position.top + 'px', transform, maxWidth, }"
      :class="$style.tips" role="presentation"
    >
      {{ message }}
    </div>
  </transition>
</template>

<script>
export default {
  props: {
    afterLeave: {
      type: Function,
      default: () => {},
    },
  },
  data() {
    return {
      visible: false,
      message: '',
      position: {
        top: 0,
        left: 0,
      },
      transform: 'translate(0, 0)',
      maxWidth: '80%',
      cancel: null,
      setTips: null,
      aotoCloseTimer: null,
    }
  },
  watch: {
    message() {
      this.$nextTick(() => {
        this.maxWidth = this.handleGetMaxWidth(this.position.left) + 'px'
        this.$nextTick(() => {
          this.transform = `translate(${this.handleGetOffsetXY(this.position.left, this.position.top)})`
        })
      })
    },
  },
  beforeUnmount() {
    // Vue3 的 <transition> 已经自己管理 DOM 卸载，无需手动 removeChild
    // 此前手动移除会导致 parentNode 为 null 时崩溃
  },
  methods: {
    handleGetMaxWidth(left) {
      const containerWidth = document.documentElement.clientWidth
      let maxWidth = containerWidth - left
      return (maxWidth > left ? maxWidth : left - 12) - 30
    },
    handleGetOffsetXY(left, top) {
      const tipsWidth = this.$refs.dom_tips.clientWidth
      const tipsHeight = this.$refs.dom_tips.clientHeight
      const dom_container = document.documentElement
      const containerWidth = dom_container.clientWidth
      const containerHeight = dom_container.clientHeight
      const offsetWidth = containerWidth - left - tipsWidth
      const offsetHeight = containerHeight - top - tipsHeight
      let x = 0
      let y = 0
      if (tipsWidth < left && containerWidth > tipsWidth && offsetWidth < 5) {
        x = -tipsWidth - 12
      }
      if (tipsHeight < top && containerHeight > tipsHeight && offsetHeight < 5) {
        y = -tipsHeight - 8
      }
      return `${x}px, ${y}px`
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.tips {
  position: fixed;
  // transform: scale(1);
  line-height: 1.2;
  word-wrap: break-word;
  padding: 5px 8px;
  z-index: 10001;
  font-size: 12px;
  // max-width: 80%;
  color: var(--color-font);
  // Luminous Harmonic: 玻璃化 — 圆角/材质与全 app 玻璃体系一致 (原 3px 直角纯色底)
  border-radius: 8px;
  border: 1px solid var(--glass-stroke, rgba(255, 255, 255, 0.08));
  background: color-mix(in srgb, var(--glass-surface-strong, var(--color-content-background)) calc(var(--glass-alpha, 0.8) * 100%), transparent);
  backdrop-filter: blur(var(--glass-blur-strong, 24px)) saturate(1.3);
  -webkit-backdrop-filter: blur(var(--glass-blur-strong, 24px)) saturate(1.3);
  overflow: hidden;
  pointer-events: none;
  // text-align: justify;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  white-space: pre-wrap;
  box-sizing: border-box;
}

:global(.tips-fade-enter-active), :global(.tips-fade-leave-active) {
  transition: opacity .2s;
}
:global(.tips-fade-enter), :global(.tips-fade-leave-to) {
  opacity: 0;
}


</style>
