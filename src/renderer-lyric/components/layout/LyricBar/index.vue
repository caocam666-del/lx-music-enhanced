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

    <!-- 右：当前行 / 下一行（直接切换, 逐字高亮实时更新） -->
    <div :class="$style.lyricArea">
      <div :class="[$style.curLine, 'nobreak']">
        <template v-if="curSegments.length">
          <span
            v-for="(segment, index) in curSegments"
            :key="index"
            :class="$style.word"
            :style="{ '--word-progress': segment.progress * 100 + '%' }"
          >{{ segment.text }}</span>
        </template>
        <template v-else>{{ curText }}</template>
      </div>
      <div v-if="nextText" :class="[$style.nextLine, 'nobreak']">{{ nextText }}</div>
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
import { computed, ref, watch, nextTick } from '@common/utils/vueTools'
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

    const barStyles = computed(() => ({
      opacity: setting['desktopLyric.style.opacity'] / 100,
      fontFamily: setting['desktopLyric.style.font'] ?? undefined,
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
      coverSrc,
      handleCoverError,
      curText,
      curSegments,
      nextText,
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
  flex: none;
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
.curLine {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-lyric-unplay, rgba(255, 255, 255, 0.9));
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.word {
  color: var(--color-lyric-unplay, rgba(255, 255, 255, 0.9));
  background-image: linear-gradient(to right, var(--color-lyric-played, #07c556) 0 var(--word-progress), var(--color-lyric-unplay, rgba(255, 255, 255, 0.9)) var(--word-progress) 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.nextLine {
  font-size: 11px;
  color: var(--lyric-text-muted);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
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
