<template>
  <teleport :to="teleport">
    <div v-if="showModal" ref="dom_container" :class="$style.container">
      <div :class="[$style.modal, {[$style.filter]: filter, [$style.modalActive]: showContent}]" @click="bgClose && close()">
        <transition :enter-active-class="inClass" :leave-active-class="outClass" @after-enter="$emit('after-enter', $event)" @after-leave="handleAfterLeave">
          <div v-show="showContent" :class="$style.content" :style="contentStyle" @click.stop>
            <header :class="$style.header">
              <button v-if="closeBtn" type="button" @click="close">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 212.982 212.982" space="preserve">
                  <use xlink:href="#icon-delete" />
                </svg>
              </button>
            </header>
            <slot />
          </div>
        </transition>
      </div>
    </div>
  </teleport>
</template>

<script>
import { getRandom } from '@common/utils/common'
import { nextTick } from '@common/utils/vueTools'
import { appSetting } from '@renderer/store/setting'

let modalCount = 0
export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    closeBtn: {
      type: Boolean,
      default: true,
    },
    bgClose: {
      type: Boolean,
      default: false,
    },
    teleport: {
      type: String,
      default: '#root',
    },
    maxWidth: {
      type: String,
      default: '76%',
    },
    minWidth: {
      type: String,
      default: '280px',
    },
    maxHeight: {
      type: String,
      default: '76%',
    },
    width: {
      type: String,
      default: 'auto',
    },
    height: {
      type: String,
      default: 'auto',
    },
  },
  emits: ['after-enter', 'after-leave', 'close'],
  data() {
    return {
      // Luminous Harmonic: "随机动画"开启时的精选动画组 — 移除 jackInTheBox/lightSpeed 等
      // 恶搞风动画，只保留与整体克制玻璃风协调的 zoom/slide/fade 系
      animates: [
        [['zoomIn', 'slideInUp'], ['zoomOut', 'slideOutDown']],
        [['fadeIn', 'slideInUp'], ['fadeOut', 'slideOutDown']],
      ],
      // Luminous Harmonic: 默认统一克制动画 (Pure-music Motion: scale .96→1 + fade)
      inClass: 'luminous-modal-in',
      outClass: 'luminous-modal-out',
      showModal: false,
      showContent: false,
      modalCount: false,
      isAddedClass: false,
      isUnmounted: false,
      // ai: 0,
    }
  },
  computed: {
    contentStyle() {
      return {
        maxWidth: this.maxWidth,
        minWidth: this.minWidth,
        width: this.width,
        height: this.height,
        maxHeight: this.maxHeight,
      }
    },
    filter() {
      return this.teleport == '#root' || this.modalCount > 1
    },
  },
  watch: {
    show(val) {
      this.handleShowChange(val)
    },
  },
  mounted() {
    if (this.show) this.handleShowChange(true)
    this.setRandomAnimation()
  },
  beforeUnmount() {
    // Luminous Harmonic: 标记已卸载, 拦截 nextTick/watch 回调在卸载后碰 DOM (避免 Vue scheduler parentNode 崩溃)
    this.isUnmounted = true
    this.showModal = false
    this.showContent = false
    this.removeClass()
  },
  methods: {
    handleShowChange(val) {
      if (val) {
        // const dom = document.getElementById(this.teleport)
        // if (dom) {
        //   // dom.t
        // }
        this.setRandomAnimation()
        this.modalCount = ++modalCount
        this.showModal = true
        void nextTick(() => {
          if (this.isUnmounted) return
          if (!this.show || !this.showModal || !this.$refs.dom_container) return
          const node = this.$refs.dom_container.parentNode
          if (!node?.classList) return
          if (!node.classList.contains('show-modal')) {
            node.classList.add('show-modal')
            this.isAddedClass = true
          }
          this.showContent = true
        })
      } else {
        if (modalCount > 0) this.modalCount = --modalCount
        this.removeClass()
        this.showContent = false
      }
    },
    removeClass() {
      if (!this.isAddedClass) return
      if (this.isUnmounted) return
      const node = this.$refs.dom_container?.parentNode
      if (node?.classList) node.classList.remove('show-modal')
      this.isAddedClass = false
    },
    setRandomAnimation() {
      if (appSetting['common.randomAnimate']) {
        const [animIn, animOut] = this.animates[getRandom(0, this.animates.length)]
        this.inClass = 'animated ' + animIn[getRandom(0, animIn.length)]
        this.outClass = 'animated ' + animOut[getRandom(0, animOut.length)]
      } else {
        this.inClass = 'luminous-modal-in'
        this.outClass = 'luminous-modal-out'
      }
    },
    close() {
      this.$emit('close')
    },
    handleAfterLeave(event) {
      this.$emit('after-leave', event)
      this.showModal = false
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99;
  // 防御性修复: 这层全屏容器(关闭半态/异常卡死时)绝不吞掉点击, 点击穿透到下方页面.
  // 之前没有此守护, 一旦 showModal 卡在 true 就会变成看不见却盖住全屏的透明层,
  // 导致"页面可见但完全无法点击/无法切换菜单"的典型症状.
  pointer-events: none;
}

.modal {
  width: 100%;
  height: 100%;
  // background-color: rgba(0, 0, 0, .2);
  // background-color: rgba(255, 255, 255, .6);
  // background-color: var(--color-primary-light-600-alpha-900);
  // backdrop-filter: blur(4px);
  // backdrop-filter: grayscale(70%);
  display: grid;
  align-items: center;
  justify-items: center;
  // will-change: transform;
  // 默认穿透, 避免在半关闭/卡死态下吞点击; 真正展开(showContent=true)时再接管点击(含背景关闭).
  pointer-events: none;

  &.modalActive {
    pointer-events: auto;
  }

  &.filter {
    backdrop-filter: grayscale(70%);
  }

  // &:before {
  //   .mixin-after();
  //   position: absolute;
  //   left: 0;
  //   top: 0;
  //   width: 100%;
  //   height: 100%;
  //   background-color: var(--color-000);
  //   opacity: .6;
  // }
}

.content {
  position: relative;
  // 内容区始终可点 (即使在 pointer-events:none 的容器/遮罩里, 子级可重新开启点击)
  pointer-events: auto;
  border-radius: @radius-glass-lg;
  box-shadow: var(--glass-shadow, 0 0 4px rgba(0, 0, 0, .25)), inset 0 0 0 1px var(--glass-stroke, transparent);
  overflow: hidden;
  // max-height: 80%;
  // max-width: 76%;
  min-width: 220px;
  position: relative;
  display: flex;
  flex-flow: column nowrap;
  z-index: 100;
  background-color: color-mix(in srgb, var(--glass-surface-strong, var(--color-content-background)) calc(var(--glass-alpha, .8) * 100%), transparent);
  backdrop-filter: blur(var(--glass-blur-strong, 40px)) saturate(1.3);
}

.header {
  flex: none;
  background-color: var(--color-primary-light-100-alpha-100);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 18px;

  button {
    border: none;
    cursor: pointer;
    padding: 4px 7px;
    background-color: transparent;
    color: var(--color-primary-dark-500-alpha-500);
    outline: none;
    transition: background-color 0.2s ease;
    line-height: 0;

    svg {
      height: .7em;
    }

    &:hover {
      background-color: var(--color-primary-dark-100-alpha-600);
    }
    &:active {
      background-color: var(--color-primary-dark-200-alpha-600);
    }
  }
}

</style>

<style lang="less">
@import '@renderer/assets/styles/variables.less';

// Luminous Harmonic: 统一克制弹窗动画 (默认) — scale .96→1 + 上移淡入, 进 180ms / 出 120ms
.luminous-modal-in {
  animation: luminous-modal-in @motion-base @ease-entrance both;
}
.luminous-modal-out {
  animation: luminous-modal-out @motion-fast @ease-standard both;
}
@keyframes luminous-modal-in {
  from { opacity: 0; transform: scale(.96) translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes luminous-modal-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: scale(.98) translateY(6px); }
}
@media (prefers-reduced-motion: reduce) {
  .luminous-modal-in,
  .luminous-modal-out {
    animation-duration: 1ms;
  }
}
</style>
