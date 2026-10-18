<template>
  <div ref="dom_bar" tabindex="0" role="application" :aria-label="musicInfo.name || 'Desktop lyrics'" :class="$style.bar" :style="barStyles" @mousedown="handleMouseDown" @contextmenu.prevent="handleContextMenu" @keydown="handleKeydown">
    <!-- 左：封面 -->
    <div :class="$style.coverWrap">
      <img v-if="coverSrc" :src="coverSrc" :class="$style.cover" alt="" draggable="false" @error="handleCoverError" />
      <div v-else :class="[$style.cover, $style.coverPlaceholder]">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" fill="currentColor" />
        </svg>
      </div>
    </div>

    <!-- 中：歌名 · 歌手（单行） -->
    <div :class="[$style.info, 'nobreak']">
      <span :class="$style.songName">{{ musicInfo.name }}</span>
      <span :class="$style.singer"> · {{ musicInfo.singer }}</span>
    </div>

    <!-- 右：当前行 / 下一行（整列上移一行：旧句滑出、下一句顶上成为当前行） -->
    <div :class="$style.lyricArea">
      <div v-if="barRows.length" :class="$style.lrcViewport">
        <div :class="$style.lrcTrack" :style="trackStyle">
          <div
            v-for="row in barRows"
            :key="row.key"
            :class="[row.role === 'cur' ? $style.curLine : $style.nextLine, 'nobreak']"
          >
            <template v-if="row.segs.length">
              <span
                v-for="(segment, index) in row.segs"
                :key="index"
                :class="$style.word"
                :style="{ '--word-progress': segment.progress * 100 + '%' }"
              >{{ segment.text }}</span>
            </template>
            <template v-else>{{ row.text }}</template>
          </div>
        </div>
      </div>
      <div v-if="!curText && !nextText" :class="$style.emptyLine">{{ musicInfo.id ? '暂无歌词' : '暂无歌曲' }}</div>
    </div>

    <!-- 右键小菜单 -->
    <div v-if="isShowCtx" ref="dom_ctx" :class="$style.ctx" :style="ctxStyles" @mouseleave="handleContextMenuLeave" @mousedown.stop>
      <button type="button" @click="toggleLock">{{ setting['desktopLyric.isLock'] ? '解锁拖动' : '锁定位置' }}</button>
      <button type="button" @click="toggleAlwaysOnTop">{{ setting['desktopLyric.isAlwaysOnTop'] ? '取消置顶' : '置顶显示' }}</button>
      <button type="button" @click="closeLyric">关闭歌词条</button>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch, nextTick, onBeforeUnmount } from '@common/utils/vueTools'
import { setting, musicInfo } from '@lyric/store/state'
import { lyric } from '@lyric/store/lyric'
import { updateSetting, setTaskbarMenuVisible, setWindowBounds } from '@lyric/utils/ipc'
import { sendPlayerAction } from '@lyric/core/mainWindowChannel'

export default {
  name: 'LyricBar',
  setup() {
    const isShowCtx = ref(false)
    const dom_bar = ref(null)
    const dom_ctx = ref(null)
    const ctxPosition = ref({ x: 0, y: 0 })
    const ctxEdge = ref('bottom')
    const coverFailed = ref(false)
    const coverSrc = computed(() => coverFailed.value ? null : musicInfo.pic ?? null)
    watch(() => musicInfo.pic, () => {
      coverFailed.value = false
    })
    const handleCoverError = () => {
      coverFailed.value = true
    }

    const curText = computed(() => {
      const line = lyric.line
      const l = lyric.lines[line]
      return l?.text ?? lyric.text ?? ''
    })
    const curSegments = computed(() => {
      const rawText = lyric.lines[lyric.line]?.rawText ?? ''
      const matches = [...rawText.matchAll(/<(\d+),(\d+)>((?:(?!<\d+,\d+>)[\s\S])*)/g)]
      return matches
        .map((match, index) => ({
          text: match[3],
          progress: lyric.wordProgresses[index] ?? 0,
        }))
        .filter(segment => segment.text)
    })
    const nextText = computed(() => {
      const line = lyric.line
      return lyric.lines[line + 1]?.text ?? ''
    })

    /**
     * 整列上移一行（与会话里灵动岛用同一套做法）。
     *
     * 换行时先把「旧当前行 + 新当前行 + 新下一行」一起渲染，再用 transform
     * 把整列上移一行：旧句从顶部滑出、下一句顶上来成为当前行、再下一句补在底部。
     * 动画结束后提交成新窗口并关闭过渡复位（所以看不出接缝）。
     *
     * 为什么不用 transition-group：enter 只能让新行自己滑入，旧行是瞬间消失的，
     * 看不到"被顶上去"的连续动作。
     */
    const MARQUEE_MS = 360
    const barRows = ref([])
    const barShift = ref(0)
    const barAnimate = ref(false)
    let barTimer = 0
    /** 过渡代次：残留的 rAF/定时器回调看到代次对不上就放弃，避免把旧状态写回去 */
    let barGen = 0

    /**
     * live = 这一行是否"实时渲染逐字进度"。
     *
     * 关键：逐字进度（curSegments）是每帧变的，而行结构只在换行时重建。
     * 如果只在换行时把 segments 快照进去，进度就会冻结在那一瞬间
     * （表现为"只高亮前一两个字就卡住"）。所以给当前行打 live 标记，
     * 由下面的 watcher 把最新的 segments 就地写进去。
     * 过渡期间滑出去的那一行不再 live（它属于上一句）。
     */
    const buildRows = () => {
      const line = lyric.line
      const rows = [{ key: 'c' + line, text: curText.value, segs: curSegments.value, role: 'cur', live: true }]
      if (nextText.value) rows.push({ key: 'n' + line, text: nextText.value, segs: [], role: 'next', live: false })
      return rows
    }

    watch(() => lyric.line, () => {
      clearTimeout(barTimer)
      const gen = ++barGen
      const prev = barRows.value
      const next = buildRows()
      if (!next.length) {
        barRows.value = []
        barShift.value = 0
        barAnimate.value = false
        return
      }
      if (!prev.length) {
        barRows.value = next
        return
      }
      // 过渡：旧当前行留在最上面被顶出（不再 live），其余用新窗口的行
      barRows.value = [{ ...prev[0], live: false }, ...next]
      barShift.value = 0
      barAnimate.value = false
      // 先提交「起点 + transition」，再下一帧改 transform，浏览器才有插值区间
      requestAnimationFrame(() => {
        if (gen !== barGen) return
        barAnimate.value = true
        requestAnimationFrame(() => {
          if (gen !== barGen) return
          if (!barRows.value.length) return
          barShift.value = 1
          barTimer = setTimeout(() => {
            if (gen !== barGen) return
            barRows.value = buildRows()
            barShift.value = 0
            barAnimate.value = false
          }, MARQUEE_MS)
        })
      })
    }, { immediate: true })

    // 逐字进度：实时写进 live 那一行（不重建行结构，所以不影响上移动画）
    watch(curSegments, (segs) => {
      const rows = barRows.value
      if (!rows.length) return
      const idx = rows.findIndex(r => r.live)
      if (idx < 0) return
      if (rows[idx].segs === segs) return
      const next = rows.slice()
      next[idx] = { ...next[idx], segs }
      barRows.value = next
    })

    // 文本变化（同一行内）：原地更新，不做位移动画
    watch([curText, nextText], () => {
      if (!barShift.value) barRows.value = buildRows()
    })

    onBeforeUnmount(() => {
      barGen++
      clearTimeout(barTimer)
    })

    const trackStyle = computed(() => ({
      transform: barShift.value
        ? `translateY(calc(-${barShift.value} * var(--bar-row-h, 19px)))`
        : 'none',
      transition: barAnimate.value
        ? `transform ${MARQUEE_MS}ms cubic-bezier(.33, 1, .68, 1)`
        : 'none',
    }))

    const barStyles = computed(() => ({
      opacity: setting['desktopLyric.style.opacity'] / 100,
      fontFamily: setting['desktopLyric.style.font'] ?? undefined,
      // 歌词行统一槽位高度（当前行 13px / 下一行 11px 共用同一行高）。
      // 位移必须精确等于一行，否则两种字号会让"顶上来的位置"错开半行。
      '--bar-row-h': '19px',
    }))
    const ctxStyles = computed(() => ({
      left: setting['desktopLyric.mode'] == 'bar' && ctxEdge.value == 'right' ? 'auto' : setting['desktopLyric.mode'] == 'bar' ? '4px' : `${ctxPosition.value.x}px`,
      right: setting['desktopLyric.mode'] == 'bar' && ctxEdge.value == 'right' ? '4px' : 'auto',
      top: setting['desktopLyric.mode'] == 'bar' && ctxEdge.value != 'bottom' ? '4px' : setting['desktopLyric.mode'] == 'bar' ? 'auto' : `${ctxPosition.value.y}px`,
      bottom: setting['desktopLyric.mode'] == 'bar' && ctxEdge.value == 'bottom' ? '4px' : 'auto',
      transform: setting['desktopLyric.mode'] == 'bar' ? 'none' : undefined,
    }))
    const getTaskbarEdge = () => {
      const screenInfo = window.screen
      const right = screenInfo.availLeft + screenInfo.availWidth
      const bottom = screenInfo.availTop + screenInfo.availHeight
      if (window.screenY <= screenInfo.availTop + 4) return 'top'
      if (window.screenX <= screenInfo.availLeft + 4 && window.innerWidth < screenInfo.availWidth / 2) return 'left'
      if (window.screenX + window.innerWidth >= right - 4 && window.innerWidth < screenInfo.availWidth / 2) return 'right'
      if (window.screenY + window.innerHeight >= bottom - 4) return 'bottom'
      return 'bottom'
    }
    const focusFirstContextAction = () => {
      void nextTick(() => dom_ctx.value?.querySelector('button')?.focus())
    }
    const showContextMenu = (x, y) => {
      const menuWidth = 220
      const menuHeight = 180
      ctxEdge.value = getTaskbarEdge()
      ctxPosition.value = {
        x: Math.min(Math.max(x, 4), Math.max(4, window.innerWidth - menuWidth - 4)),
        y: Math.min(Math.max(y, 4), Math.max(4, window.innerHeight - menuHeight - 4)),
      }
      if (setting['desktopLyric.mode'] == 'bar') setTaskbarMenuVisible(true)
      isShowCtx.value = true
      focusFirstContextAction()
    }
    const handleContextMenu = (e) => {
      showContextMenu(e.clientX, e.clientY)
    }
    const hideContextMenu = () => {
      if (!isShowCtx.value) return
      isShowCtx.value = false
      if (setting['desktopLyric.mode'] == 'bar') setTaskbarMenuVisible(false)
      void nextTick(() => dom_bar.value?.focus())
    }
    const handleContextMenuLeave = () => {
      hideContextMenu()
    }
    const handleKeydown = (e) => {
      const isMenuKey = e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)
      if (!isShowCtx.value && isMenuKey) {
        e.preventDefault()
        const rect = dom_bar.value?.getBoundingClientRect()
        showContextMenu(rect?.left ?? 4, rect?.bottom ?? 4)
        return
      }
      if (e.key == 'Escape') {
        e.preventDefault()
        hideContextMenu()
        return
      }
      if (e.key == ' ' || e.key == 'Spacebar') {
        e.preventDefault()
        sendPlayerAction('toggle')
        return
      }
      if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') {
        e.preventDefault()
        sendPlayerAction(e.key == 'ArrowLeft' ? 'prev' : 'next')
        return
      }
      if (!isShowCtx.value) return
      if (e.key != 'ArrowDown' && e.key != 'ArrowUp') return
      const buttons = [...(dom_ctx.value?.querySelectorAll('button') ?? [])]
      if (!buttons.length) return
      e.preventDefault()
      const current = buttons.indexOf(document.activeElement)
      const offset = e.key == 'ArrowDown' ? 1 : -1
      buttons[(current + offset + buttons.length) % buttons.length].focus()
    }

    // 拖动（仅未锁定时）, 复用主窗口标准 setWindowBounds 方案
    let isMsDown = false
    let msDownX = 0
    let msDownY = 0
    let windowW = 0
    let windowH = 0
    const handleMouseDown = (e) => {
      if (setting['desktopLyric.isLock']) return
      isMsDown = true
      msDownX = e.clientX
      msDownY = e.clientY
      windowW = window.innerWidth
      windowH = window.innerHeight
      hideContextMenu()
      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    }
    const handleMove = (e) => {
      if (!isMsDown) return
      setWindowBounds({
        x: e.clientX - msDownX,
        y: e.clientY - msDownY,
        w: windowW,
        h: windowH,
      })
    }
    const handleUp = () => {
      isMsDown = false
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    const toggleLock = () => {
      void updateSetting({ 'desktopLyric.isLock': !setting['desktopLyric.isLock'] })
      hideContextMenu()
    }
    const toggleAlwaysOnTop = () => {
      void updateSetting({ 'desktopLyric.isAlwaysOnTop': !setting['desktopLyric.isAlwaysOnTop'] })
      hideContextMenu()
    }
    const closeLyric = () => {
      void updateSetting({ 'desktopLyric.enable': false })
      hideContextMenu()
    }

    return {
      setting,
      musicInfo,
      // 模板里用 lyric.line 做换行动画的 key，必须暴露，否则整个歌词条渲染失败
      lyric,
      coverSrc,
      handleCoverError,
      curText,
      curSegments,
      nextText,
      barRows,
      trackStyle,
      barStyles,
      ctxStyles,
      handleContextMenu,
      handleContextMenuLeave,
      isShowCtx,
      handleMouseDown,
      toggleLock,
      toggleAlwaysOnTop,
      closeLyric,
      dom_bar,
      dom_ctx,
      handleKeydown,
    }
  },
}
</script>

<style lang="less" module>
.bar {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  height: 100%;
  box-sizing: border-box;
  padding: 0 12px 0 6px;
  // 扁平融入任务栏: 无圆角、无边框、无阴影, 半透明背景
  background-color: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none;
  box-shadow: none;
  gap: 10px;
  cursor: grab;
  user-select: none;
  overflow: hidden;

  &:focus-visible {
    outline: 2px solid var(--lyric-primary);
    outline-offset: -2px;
  }

  &:active { cursor: grabbing; }
}

.coverWrap {
  flex: none;
  width: 28px;
  height: 28px;
}
.cover {
  width: 100%;
  height: 100%;
  border-radius: 5px;
  object-fit: cover;
}
.coverPlaceholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--lyric-primary) 12%, transparent);
  color: var(--lyric-text-muted);
}

.info {
  // 可收缩：宽度紧张时优先让给歌词（歌词是主体，歌名截断比歌词截断可接受）
  flex: 0 1 auto;
  max-width: 160px;
  min-width: 0;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.songName {
  color: var(--lyric-text);
  font-weight: 600;
}
.singer {
  color: var(--lyric-text-muted);
}

.lyricArea {
  flex: auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  line-height: 1.2;
}

// ---------------- 整列上移（复刻 TaskbarLyrics 的上划观感）----------------
// 视口固定两行高并裁切；内部的 .lrcTrack 由 JS 用 transform 上移一行。
// 换行时旧句完整地从顶部滑出、下一句顶上来成为当前行、再下一句补在底部。
// 行高统一用 --bar-row-h：当前行与下一行同高，位移才能精确等于一行，
// 否则两种字号会让"顶上来的位置"错开半行。
.lrcViewport {
  position: relative;
  width: 100%;
  overflow: hidden;
  min-width: 0;
  height: calc(var(--bar-row-h, 19px) * 2);
  contain: paint;
  // 不加 mask-image：见 LyricIsland 里同段说明（遮罩会让滚动中的半行彻底看不见，
  // 视觉上像"少了一行"）。overflow:hidden 已经足够裁切。
}
.lrcTrack {
  display: flex;
  flex-flow: column nowrap;
  min-width: 0;
  will-change: transform;
}
.curLine {
  font-size: 13px;
  font-weight: 600;
  // 当前行取 --color-lyric-played：该变量由 useTheme 统一解析 ——
  // 默认跟随详情页强调色，用户在设置页手动改色后改用自己的颜色。
  color: var(--color-lyric-played, var(--detail-accent-bright, #fff));
  height: var(--bar-row-h, 19px);
  line-height: var(--bar-row-h, 19px);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  // 顶上来时字号会从"下一行"变成"当前行"，过渡一下更连贯
  transition: font-size .3s ease, color .3s ease;
}
.word {
  color: var(--color-lyric-unplay, var(--detail-font-bright, rgba(255, 255, 255, 0.9)));
  // 已唱部分取详情页强调色（对齐详情页 .font-mode 的逐字渐变），未唱部分保持常规文字色
  background-image: linear-gradient(to right, var(--color-lyric-played, var(--detail-accent-bright, #07c556)) 0 var(--word-progress), var(--color-lyric-unplay, var(--detail-font-bright, rgba(255, 255, 255, 0.9))) var(--word-progress) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.nextLine {
  font-size: 11px;
  color: var(--lyric-text-muted);
  height: var(--bar-row-h, 19px);
  line-height: var(--bar-row-h, 19px);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: font-size .3s ease;
}
.emptyLine {
  color: var(--lyric-text-muted);
  font-size: 11px;
  white-space: nowrap;
}

.ctx {
  position: fixed;
  transform: translateY(-100%);
  z-index: 10;
  display: flex;
  flex-flow: column nowrap;
  min-width: 204px;
  max-width: min(280px, calc(100vw - 8px));
  max-height: min(260px, calc(100vh - 8px));
  overflow-y: auto;
  padding: 4px;
  border-radius: 8px;
  background-color: var(--lyric-surface);
  border: 1px solid var(--lyric-border);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--lyric-primary) 18%, transparent);
  button {
    border: none;
    background: none;
    color: var(--lyric-text);
    font-size: 12px;
    padding: 6px 14px;
    text-align: left;
    border-radius: 6px;
    cursor: pointer;
    &:hover { background-color: color-mix(in srgb, var(--lyric-primary) 14%, transparent); }
  }
}
</style>
