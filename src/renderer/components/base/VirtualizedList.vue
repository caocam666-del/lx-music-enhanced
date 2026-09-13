<template>
  <component
    :is="containerEl"
    ref="dom_scrollContainer"
    :class="containerClass"
    tabindex="0"
    style="outline: none; height: 100%; overflow-y: auto; position: relative; display: block; contain: strict;"
  >
    <component :is="contentEl" :class="contentClass" :style="contentStyle">
      <div v-for="item in views" :key="item.key" :class="item.cls" :style="item.style" @animationend="handleRowAnimationEnd(item, $event)">
        <slot name="default" v-bind="{ item: item.item, index: item.index }" />
      </div>
    </component>
    <slot name="footer" />
  </component>
</template>

<script>
import {
  computed,
  ref,
  nextTick,
  watch,
  onMounted,
  onBeforeUnmount,
} from 'vue'

/**
 * 生成防抖函数
 * @param {*} fn
 * @param {*} delay
 */
export const debounce = (fn, delay = 100) => {
  let timer = null
  let _args = null
  return function(...args) {
    _args = args
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn.apply(this, _args)
    }, delay)
  }
}

const easeInOutQuad = (t, b, c, d) => {
  t /= d / 2
  if (t < 1) return (c / 2) * t * t + b
  t--
  return (-c / 2) * (t * (t - 2) - 1) + b
}
const handleScroll = (element, to, duration = 300, callback = () => {}, onCancel = () => {}) => {
  if (!element) { callback(); return }
  const start = element.scrollTop || element.scrollY || 0
  let cancel = false
  if (to > start) {
    let maxScrollTop = element.scrollHeight - element.clientHeight
    if (to > maxScrollTop) to = maxScrollTop
  } else if (to < start) {
    if (to < 0) to = 0
  } else { callback(); return }
  const change = to - start
  const increment = 10
  if (!change) { callback(); return }

  let currentTime = 0
  let val
  let cancelCallback

  const animateScroll = () => {
    currentTime += increment
    val = parseInt(easeInOutQuad(currentTime, start, change, duration))
    if (element.scrollTo) {
      element.scrollTo(0, val)
    } else {
      element.scrollTop = val
    }
    if (currentTime < duration) {
      if (cancel) {
        cancelCallback()
        onCancel()
        return
      }
      window.setTimeout(animateScroll, increment)
    } else {
      callback()
    }
  }
  animateScroll()
  return (callback) => {
    cancelCallback = callback
    cancel = true
  }
}

export default {
  name: 'VirtualizedList',
  props: {
    containerEl: {
      type: String,
      default: 'div',
    },
    containerClass: {
      type: String,
      default: 'virtualized-list',
    },
    contentEl: {
      type: String,
      default: 'div',
    },
    contentClass: {
      type: String,
      default: 'virtualized-list-content',
    },
    itemHeight: {
      type: Number,
      required: true,
    },
    keyName: {
      type: String,
      required: true,
    },
    list: {
      type: Array,
      required: true,
    },
  },
  emits: ['scroll'],
  setup(props, { emit }) {
    const views = ref([])
    const dom_scrollContainer = ref(null)
    let isListScrolling = false
    const isListScrollingRef = ref(false)
    let startIndex = -1
    let endIndex = -1
    let scrollTop = -1
    let cachedList = []
    let cancelScroll = null
    let isAutoScrolling = false
    let scrollToValue = 0
    // Luminous Harmonic: 方向感知入场动画 (对标 Pure-music DirectionalListItemEntrance)
    // 已入场 key 集合(FIFO 上限 96): 行滚出视口再回来不重播动画
    let lastEnterDir = 'down'
    const seenRowKeys = new Set()
    const SEEN_ROW_KEYS_MAX = 96

    const trackSeenRowKey = key => {
      if (seenRowKeys.size >= SEEN_ROW_KEYS_MAX) seenRowKeys.delete(seenRowKeys.values().next().value)
      seenRowKeys.add(key)
    }

    const handleRowAnimationEnd = (item, event) => {
      if (event.animationName !== 'lx-row-enter-down' && event.animationName !== 'lx-row-enter-up') return
      item.cls = undefined
    }

    const createList = (startIndex, endIndex) => {
      const cache = cachedList.slice(startIndex, endIndex)
      const list = props.list.slice(startIndex, endIndex).map((item, i) => {
        if (cache[i]) return cache[i]
        const top = (startIndex + i) * props.itemHeight
        const index = startIndex + i
        const key = item[props.keyName]
        const entry = {
          item,
          top,
          style: { position: 'absolute', left: 0, right: 0, top: top + 'px', height: props.itemHeight + 'px' },
          index,
          key,
          cls: undefined,
        }
        // 仅首次出现的行播放入场动画, 方向跟随滚动方向
        if (!seenRowKeys.has(key)) {
          trackSeenRowKey(key)
          entry.cls = lastEnterDir === 'up' ? 'lx-row-enter-up' : 'lx-row-enter-down'
        }
        return cachedList[index] = entry
      })
      return list
    }

    let sizeObserver = null
    const updateView = (currentScrollTop = dom_scrollContainer.value?.scrollTop) => {
      // 卸载后排队的 nextTick/rAF 仍可能触发, 此时滚动容器已为 null, 跳过即可
      if (currentScrollTop == null || !dom_scrollContainer.value) return
      // const currentScrollTop = this.$refs.dom_scrollContainer.scrollTop
      const itemHeight = props.itemHeight
      const currentStartIndex = Math.floor(currentScrollTop / itemHeight)
      const scrollContainerHeight = dom_scrollContainer.value.clientHeight
      const currentEndIndex = currentStartIndex + Math.ceil(scrollContainerHeight / itemHeight)
      const continuous = currentStartIndex <= endIndex && currentEndIndex >= startIndex
      const currentStartRenderIndex = Math.max(currentStartIndex, 0)
      const currentEndRenderIndex = currentEndIndex + 1
      // Luminous Harmonic: 记录滚动方向, 决定新入场的行从上方还是下方滑入
      if (scrollTop >= 0) lastEnterDir = currentScrollTop >= scrollTop ? 'down' : 'up'
      // console.log(continuous)
      // debugger
      if (continuous) {
        // if (Math.abs(currentScrollTop - this.scrollTop) < this.itemHeight * 0.6) return
        // console.log('update')
        // if (currentScrollTop > scrollTop) { // scroll down
        //   // console.log('scroll down')
        //   views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        //   // views.value.push(...list.slice(list.indexOf(views.value[views.value.length - 1]) + 1))
        //   // // if (this.views.length > 100) {
        //   // nextTick(() => {
        //   //   views.value.splice(0, views.value.indexOf(list[0]))
        //   // })
        //   // }
        // } else if (currentScrollTop < scrollTop) { // scroll up
        //   // console.log('scroll up')
        //   views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        // } else return
        if (currentScrollTop == scrollTop && endIndex >= currentEndIndex) return
        requestAnimationFrame(() => {
          views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        })
      } else {
        requestAnimationFrame(() => {
          views.value = createList(currentStartRenderIndex, currentEndRenderIndex)
        })
      }
      startIndex = currentStartIndex
      endIndex = currentEndIndex
      scrollTop = currentScrollTop
    }

    const setStopScrollStatus = debounce(() => {
      isListScrolling = false
      isListScrollingRef.value = false
    }, 200)
    const onScroll = event => {
      if (!isListScrolling) isListScrolling = isListScrollingRef.value = true
      setStopScrollStatus()

      const currentScrollTop = dom_scrollContainer.value.scrollTop
      if (Math.abs(currentScrollTop - scrollTop) > props.itemHeight * 0.6) {
        updateView(currentScrollTop)
      }
      emit('scroll', event)
    }

    const scrollTo = (scrollTop, animate = false, onScrollEnd) => {
      if (onScrollEnd) {
        void new Promise(resolve => {
          if (cancelScroll) {
            cancelScroll(resolve)
          } else {
            resolve()
          }
        }).then(() => {
          if (animate) {
            isAutoScrolling = true
            scrollToValue = scrollTop
            cancelScroll = handleScroll(dom_scrollContainer.value, scrollTop, 300, () => {
              cancelScroll = null
              isAutoScrolling = false
              onScrollEnd(true)
            }, () => {
              cancelScroll = null
              isAutoScrolling = false
              onScrollEnd('canceled')
            })
          } else {
            dom_scrollContainer.value.scrollTop = scrollTop
          }
        })
      } else {
        dom_scrollContainer.value.scrollTo({
          top: scrollTop,
          behavior: animate ? 'smooth' : 'instant',
        })
      }
    }

    const scrollToIndex = (index, offset = 0, animate = false, onScrollEnd) => {
      scrollTo(Math.max(index * props.itemHeight + offset, 0), animate, onScrollEnd)
    }

    const getScrollTop = () => {
      return isAutoScrolling ? scrollToValue : dom_scrollContainer.value.scrollTop
    }

    const handleResize = () => {
      window.setTimeout(updateView)
    }

    const contentStyle = computed(() => {
      const style = {
        display: 'block',
        height: props.list.length * props.itemHeight + 'px',
      }
      if (isListScrollingRef.value) style['pointer-events'] = 'none'
      return style
    })

    const handleReset = list => {
      cachedList = Array(list.length)
      startIndex = -1
      endIndex = -1
      if (cachedList.length) {
        void nextTick(() => {
          requestAnimationFrame(() => {
            updateView()
          })
        })
      } else {
        views.value = []
      }
    }
    watch(() => props.itemHeight, () => {
      handleReset(props.list)
    })
    watch(() => props.list, (list) => {
      handleReset(list)
    })

    onMounted(() => {
      dom_scrollContainer.value.addEventListener('scroll', onScroll, {
        capture: false,
        passive: true,
      })
      cachedList = Array(props.list.length)
      startIndex = -1
      endIndex = -1

      if (props.list.length) {
        void nextTick(() => {
          requestAnimationFrame(() => {
            console.log('updateView')
            updateView()
          })
        })
      }
      window.addEventListener('resize', handleResize)
      // Luminous Harmonic: 容器尺寸从 0 变为正常时重新渲染 —
      // 路由重挂载瞬间容器高度为 0, updateView 渲染 0 行后不再恢复 (榜单切换空列表根因)
      if (typeof ResizeObserver !== 'undefined' && dom_scrollContainer.value) {
        sizeObserver = new ResizeObserver(() => { updateView() })
        sizeObserver.observe(dom_scrollContainer.value)
      }
    })
    onBeforeUnmount(() => {
      dom_scrollContainer.value.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', handleResize)
      if (cancelScroll) cancelScroll()
      sizeObserver?.disconnect()
    })

    return {
      views,
      dom_scrollContainer,
      contentStyle,
      scrollTo,
      scrollToIndex,
      getScrollTop,
      handleRowAnimationEnd,
    }
  },
}
</script>

<style lang="less">
@import '@renderer/assets/styles/variables.less';

// Luminous Harmonic: 行入场动画 — 从滚动方向 12px 位移 + 淡入 (180ms entrance 曲线)
.lx-row-enter-down {
  animation: lx-row-enter-down @motion-base @ease-entrance both;
}
.lx-row-enter-up {
  animation: lx-row-enter-up @motion-base @ease-entrance both;
}
@keyframes lx-row-enter-down {
  from { opacity: .78; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes lx-row-enter-up {
  from { opacity: .78; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .lx-row-enter-down,
  .lx-row-enter-up {
    animation: none;
  }
}
</style>
