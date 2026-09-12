<template>
  <div :class="['right', $style.right]" :style="lrcFontSize">
    <transition mode="out-in" enter-active-class="animated fadeIn" leave-active-class="animated fadeOut" @after-enter="handleLyricTransitionEnter">
      <div
        v-if="hasLyric"
        v-show="!isShowLrcSelectContent"
        key="lyric"
        ref="dom_lyric"
        :class="['lyric', $style.lyric, { [$style.draging]: isMsDown }, { [$style.lrcActiveZoom]: isZoomActiveLrc }, { [$style.lyricSharp]: !isLyricBlur }]" :style="lrcStyles"
        @wheel="handleWheel" @mousedown="handleLyricMouseDown" @touchstart="handleLyricTouchStart" @click="handleLyricClick"
        @contextmenu.stop="handleShowLyricMenu"
      >
        <div :class="['pre', $style.lyricSpace]" />
        <div ref="dom_lyric_text" />
        <div :class="$style.lyricSpace" />
      </div>
      <div v-else-if="isLyricLoading" key="loading" :class="$style.lyricEmpty" role="status" aria-live="polite">
        {{ $t('lyric__loading') }}
      </div>
      <div v-else key="empty" :class="$style.lyricEmpty" role="status">
        {{ playMusicInfo.musicInfo ? $t('lyric__empty') : $t('player__no_music') }}
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLyricProgressSetting" v-show="isStopScroll && !isShowLrcSelectContent" :class="$style.skip">
        <div ref="dom_skip_line" :class="$style.line" />
        <span :class="$style.label">{{ timeStr }}</span>
        <base-btn :class="$style.skipBtn" @mouseenter="handleSkipMouseEnter" @mouseleave="handleSkipMouseLeave" @click="handleSkipPlay">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="50%" viewBox="0 0 1024 1024" space="preserve">
            <use xlink:href="#icon-play" />
          </svg>
        </base-btn>
      </div>
    </transition>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isShowLrcSelectContent" ref="dom_lrc_select_content" tabindex="-1" :class="[$style.lyricSelectContent, 'select', 'scroll', 'lyricSelectContent']" @contextmenu="handleCopySelectText">
        <div v-for="(info, index) in lyric.lines" :key="index" :class="[$style.lyricSelectline, { [$style.lrcActive]: lyric.line == index }]">
          <span>{{ info.text }}</span>
          <template v-for="(lrc, i) in info.extendedLyrics" :key="i">
            <br>
            <span :class="$style.lyricSelectlineExtended">{{ lrc }}</span>
          </template>
        </div>
      </div>
    </transition>
    <LyricMenu v-model="lyricMenuVisible" :xy="lyricMenuXY" :lyric-info="lyricInfo" @update-lyric="handleUpdateLyric" />
    <base-btn v-if="isStopScroll && !isShowLrcSelectContent" :class="$style.followBtn" aria-label="回到当前歌词" title="回到当前歌词" @click="handleReturnCurrentLyric">
      <svg viewBox="0 0 451.847 451.847" aria-hidden="true"><use xlink:href="#icon-down" /></svg>
    </base-btn>
  </div>
</template>

<script>
import { clipboardWriteText } from '@common/utils/electron'
import { lyric } from '@renderer/store/player/lyric'
import { playProgress } from '@renderer/store/player/playProgress'
import { isFullscreen } from '@renderer/store'
import {
  isPlay,
  isShowLrcSelectContent,
  isShowPlayComment,
  musicInfo as playerMusicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setMusicInfo,
} from '@renderer/store/player/action'
import { onMounted, onBeforeUnmount, computed, reactive, ref, nextTick, watch } from '@common/utils/vueTools'
import useLyric from '@renderer/utils/compositions/useLyric'
import LyricMenu from './components/LyricMenu.vue'
import { appSetting } from '@renderer/store/setting'
import { setLyricOffset } from '@renderer/core/lyric'
import useSelectAllLrc from './useSelectAllLrc'

export default {
  components: {
    LyricMenu,
  },
  setup() {
    const isZoomActiveLrc = computed(() => appSetting['playDetail.isZoomActiveLrc'])
    const isLyricBlur = computed(() => appSetting['playDetail.isLyricBlur'])
    const isShowLyricProgressSetting = computed(() => appSetting['playDetail.isShowLyricProgressSetting'])

    const hasLyric = computed(() => lyric.lines.length > 0 || Boolean(lyric.text))
    const isLyricLoading = computed(() => Boolean(playMusicInfo.musicInfo && playerMusicInfo.lrc == null))

    const {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      isMsDown,
      isStopScroll,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleWheel,
      handleSkipPlay,
      handleLyricClick,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      handleReturnCurrentLyric,
      handleScrollLrc,
      handleLyricTransitionEnter,
    } = useLyric({ isPlay, lyric, playProgress, isShowLyricProgressSetting })

    // Luminous Harmonic: 对齐 Pure-music 歌词渲染 (lyrics_line_painter) —
    // 只有当前行取色突出 (mainColor = primary), 其余行统一纯白低透明度.
    // 距离模糊/渐隐受设置页「歌词模糊化」(playDetail.isLyricBlur) 控制:
    //  开启 → 未播放行随距离轻微模糊 (blurSigmaStep 0.6, blurSigmaMax 2.5);
    //  关闭 (.lyricSharp) → 所有行完全清晰, 仅按距离轻微渐隐
    const applyLyricDepth = (line) => {
      const container = dom_lyric.value
      if (!container) return
      const allowBlur = isLyricBlur.value
      const els = container.querySelectorAll('.line-content')
      els.forEach((el, i) => {
        const dist = Math.abs(i - line)
        const opacity = dist === 0 ? 1 : (allowBlur ? 0.55 : 0.85)
        const scale = dist === 0 ? (isZoomActiveLrc.value ? 1.16 : 1) : 0.90
        const blur = dist === 0 || !allowBlur ? 0 : Math.min(2.5, dist * 0.6)
        if (dist === 0) el.style.transitionDelay = '0ms'
        el.style.opacity = opacity
        el.style.transform = `scale(${scale})`
        el.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none'
      })
    }
    // Luminous Harmonic: 换行错峰 (Pure-music LyricStaggerMotion) —
    // 跳行 ≤10 行时按行距给非当前行设置 transition-delay(45ms/行, 封顶 240ms)，
    // 行切换的 opacity/scale/filter 变化依次展开形成涟漪；700ms 后复位，拖动歌词/动画关闭/减动效时不启用
    let staggerTimer = null
    const clearStagger = () => {
      if (staggerTimer) {
        clearTimeout(staggerTimer)
        staggerTimer = null
      }
      dom_lyric.value?.querySelectorAll('.line-content').forEach(el => {
        el.style.transitionDelay = ''
      })
    }
    const applyStagger = (line, oldLine) => {
      const container = dom_lyric.value
      if (!container) return
      if (document.documentElement.classList.contains('disableAnimation')) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const delta = oldLine == null ? 0 : Math.abs(line - oldLine)
      if (!delta || delta > 10) return
      const els = container.querySelectorAll('.line-content')
      els.forEach((el, i) => {
        const dist = Math.abs(i - line)
        // Luminous Harmonic: 只延迟非当前行; 当前行显式清零 (修复: 该行上一轮的错峰延迟
        // 若残留, 成为当前行后 blur→none 的过渡会被延迟拖慢, 呈现"活动行模糊")
        if (dist) el.style.transitionDelay = `${Math.min(160, dist * 40)}ms`
        else el.style.transitionDelay = '0ms'
      })
      if (staggerTimer) clearTimeout(staggerTimer)
      staggerTimer = setTimeout(() => {
        staggerTimer = null
        clearStagger()
      }, 700)
    }
    // 行挂载/当前行变化时应用距离衰减
    watch(() => lyric.lines, () => {
      // Luminous Harmonic: 歌词行重建时清掉错峰定时器 (新元素不应继承残留延迟)
      if (staggerTimer) {
        clearTimeout(staggerTimer)
        staggerTimer = null
      }
      void nextTick(() => {
        applyLyricDepth(lyric.line)
      })
    }, { immediate: true })
    watch(() => lyric.line, (line, oldLine) => {
      applyLyricDepth(line)
      applyStagger(line, oldLine)
    })
    // Luminous Harmonic: 切换「歌词模糊化」设置时立即重算行的透明度/模糊
    watch(isLyricBlur, () => {
      applyLyricDepth(lyric.line)
    })
    const dom_lrc_select_content = useSelectAllLrc()

    watch([isFullscreen, isShowPlayComment], () => {
      setTimeout(handleScrollLrc, 400)
    })

    const lyricMenuVisible = ref(false)
    const lyricMenuXY = reactive({
      x: 0,
      y: 0,
    })
    const lyricInfo = reactive({
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      rawlyric: '',
      musicInfo: null,
    })
    const updateMusicInfo = () => {
      lyricInfo.lyric = playerMusicInfo.lrc
      lyricInfo.tlyric = playerMusicInfo.tlrc
      lyricInfo.rlyric = playerMusicInfo.rlrc
      lyricInfo.lxlyric = playerMusicInfo.lxlrc
      lyricInfo.rawlyric = playerMusicInfo.rawlrc
      lyricInfo.musicInfo = playMusicInfo.musicInfo
    }
    const handleShowLyricMenu = event => {
      updateMusicInfo()
      lyricMenuXY.x = event.pageX
      lyricMenuXY.y = event.pageY
      if (lyricMenuVisible.value) return
      void nextTick(() => {
        lyricMenuVisible.value = true
      })
    }
    const handleUpdateLyric = ({ lyric, tlyric, rlyric, lxlyric, offset }) => {
      setMusicInfo({
        lrc: lyric,
        tlrc: tlyric,
        rlrc: rlyric,
        lxlrc: lxlyric,
      })
      console.log(offset)
      setLyricOffset(offset)
    }

    const lrcStyles = computed(() => {
      return {
        textAlign: appSetting['playDetail.style.align'],
      }
    })
    const lrcFontSize = computed(() => {
      let size = appSetting['playDetail.style.fontSize'] / 100
      if (isFullscreen.value) size = size *= 1.4
      return {
        '--playDetail-lrc-font-size': size + 'rem',
      }
    })

    onMounted(() => {
      window.app_event.on('musicToggled', updateMusicInfo)
      window.app_event.on('lyricUpdated', updateMusicInfo)
    })
    onBeforeUnmount(() => {
      window.app_event.off('musicToggled', updateMusicInfo)
      window.app_event.off('lyricUpdated', updateMusicInfo)
      if (staggerTimer) {
        clearTimeout(staggerTimer)
        staggerTimer = null
      }
    })

    return {
      dom_lyric,
      dom_lyric_text,
      dom_skip_line,
      dom_lrc_select_content,
      isMsDown,
      timeStr,
      handleLyricMouseDown,
      handleLyricTouchStart,
      handleWheel,
      handleSkipPlay,
      handleLyricClick,
      handleSkipMouseEnter,
      handleSkipMouseLeave,
      handleReturnCurrentLyric,
      handleLyricTransitionEnter,
      lyric,
      playMusicInfo,
      hasLyric,
      isLyricLoading,
      lrcStyles,
      lrcFontSize,
      isShowLrcSelectContent,
      isShowLyricProgressSetting,
      isZoomActiveLrc,
      isLyricBlur,
      isStopScroll,
      lyricMenuVisible,
      lyricMenuXY,
      handleShowLyricMenu,
      handleUpdateLyric,
      lyricInfo,
    }
  },
  methods: {
    handleCopySelectText() {
      let str = window.getSelection().toString()
      str = str.trim()
      if (!str.length) return
      clipboardWriteText(str)
    },
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.right {
  flex: 1 1 auto;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  justify-content: center;
  padding: 24px 4vw 22px 0;
  position: relative;
  transition: flex-basis @transition-normal;
  min-width: 0;
}
.lyric {
  width: min(100%, 820px);
  text-align: center;
  height: 100%;
  overflow: hidden;
  font-size: var(--playDetail-lrc-font-size, 16px);
  // Luminous Harmonic: 歌词模糊化 — 打开时上下渐隐 + 行柔影；关闭时（.lyricSharp）完全清晰
  -webkit-mask-image: linear-gradient(transparent 0%, #fff 14%, #fff 78%, transparent 100%);
  mask-image: linear-gradient(transparent 0%, #fff 14%, #fff 78%, transparent 100%);
  cursor: grab;
  &.lyricSharp {
    -webkit-mask-image: none;
    mask-image: none;
    :global {
      .line-content {
        text-shadow: none;
        opacity: .88;
      }
    }
  }
  &.draging {
    cursor: grabbing;
  }
  :global {
    .font-lrc {
      // Luminous Harmonic: 封面取色模式近白、主题模式回退主题文字色（蒙层压暗背景下始终清晰）
      color: var(--detail-font-bright, var(--color-font));
    }
    .line-content {
      position: relative;
      line-height: 1.3;
      padding: calc(var(--playDetail-lrc-font-size, 16px) * .52) 10px;
      overflow-wrap: break-word;
      // Luminous Harmonic: Pure-music 规则 — 非当前行 = 纯白低透明度, 无阴影无光晕
      // (颜色的"干净"来自: 只给当前行上色, 其余行统一低透明度白 + 可选的距离模糊)
      color: var(--detail-font-bright, var(--color-font));
      opacity: .55;
      transform: scale(.90);
      transform-origin: center;
      // Luminous Harmonic: 距离衰减（opacity/scale/filter 平滑过渡）
      transition: opacity @transition-normal, transform @transition-normal, color @transition-normal, padding @transition-normal, filter @transition-normal;
      text-shadow: none;
      will-change: transform, opacity;

      &:hover { opacity: .8; }

      .extended {
        font-size: 0.8em;
        margin-top: 5px;
      }
      &.line-mode {
        .font-lrc {
          transition: @transition-fast;
          transition-property: font-size, color;
        }
      }
      &.line-mode.active, &.font-mode.active {
        opacity: 1;
        // Luminous Harmonic: 当前行默认不放大 (对齐 Pure-music — 靠颜色/字重突出, 行高零跳动;
        // "当前行放大"设置开启时由 applyLyricDepth 的 inline scale 提供 1.16)
        transform: scale(1);
        // Luminous Harmonic: 封面取色模式近白、主题模式回退主题文字色
        color: var(--detail-font-bright, var(--color-font));
        font-weight: 600;
        // Luminous Harmonic: 去掉 padding 跳动 (原 .52→.68 的上下变化会让整屏行高抖动)
        padding-top: calc(var(--playDetail-lrc-font-size, 16px) * .52);
        padding-bottom: calc(var(--playDetail-lrc-font-size, 16px) * .52);
        // Luminous Harmonic: Pure-music 当前行无光晕无阴影 (enableGlow 默认 false) —
        // 取色靠颜色本身, 发光只会让字发糊
        text-shadow: none;
      }
      &.line-mode.active .font-lrc, &.font-mode.played .font-lrc, &.font-mode.active .font-lrc {
        // Luminous Harmonic: 当前行用亮化版 accent（低亮度封面主色直接做文字色会发虚）
        color: var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary)));
        font-weight: 600;
      }
      &.font-mode .extended .font-lrc {
        transition: @transition-slow;
        transition-property: font-size, color;
      }

      &.font-mode > .line > .font-lrc {
        > span {
          transition: @transition-normal;
          transition-property: font-size;
          font-size: 1em;
          background-repeat: no-repeat;
          // Luminous Harmonic: 未唱字底色用近白（封面取色模式），清晰不虚
          background-color: color-mix(in srgb, var(--detail-font-bright, var(--color-font)) 76%, transparent);
          background-image: -webkit-linear-gradient(top, var(--detail-accent-color, var(--color-primary)), var(--detail-accent-color, var(--color-primary)));
          -webkit-text-fill-color: transparent;
          -webkit-background-clip: text;
          background-size: 0 100%;
        }
      }
      // Luminous Harmonic: 间奏/纯音乐空行 → 三点呼吸动画（Pure-music 同款）
      &.font-lrc:empty {
        position: relative;
        display: inline-block;
        width: 8px;
        height: 8px;
        background: radial-gradient(circle, currentColor 2.5px, transparent 3px) center / 8px 8px no-repeat;
        animation: lyric-dot-breathe 1.6s ease-in-out infinite;

        &::before,
        &::after {
          content: '';
          position: absolute;
          top: 0;
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, currentColor 2.5px, transparent 3px) center / 8px 8px no-repeat;
          animation: lyric-dot-breathe 1.6s ease-in-out infinite;
        }
        &::before { left: 11px; animation-delay: .2s; }
        &::after { left: 22px; animation-delay: .4s; }
      }
    }
  }
  // p {
  //   padding: 8px 0;
  //   line-height: 1.2;
  //   overflow-wrap: break-word;
  //   transition: @transition-normal !important;
  //   transition-property: color, font-size;
  // }
  // .lrc-active {
  //   color: var(--color-primary);
  //   font-size: 1.2em;
  // }
}
.lyricEmpty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(100%, 820px);
  height: 100%;
  color: var(--detail-font-bright, var(--color-font-label));
  text-shadow: var(--detail-font-shadow, none);
  font-size: var(--playDetail-lrc-font-size, 16px);
  opacity: .72;
  text-align: center;
}
@keyframes lyric-dot-breathe {
  0%, 100% { opacity: .3; transform: scale(.85); }
  40% { opacity: 1; transform: scale(1.15); }
}

.lrcActiveZoom {
  :global {
    .line-content {
      &.active {
        .extended {
          font-size: .94em;
        }
        .line {
          font-size: 1.1em;
        }
      }
    }
  }
}

.skip {
  position: absolute;
  top: calc(38% + var(--playDetail-lrc-font-size, 16px) + 4px);
  left: 0;
  // height: 6px;
  width: 100%;
  pointer-events: none;
  // opacity: .5;
  .line {
    border-top: 2px dotted var(--color-primary-dark-100);
    opacity: .15;
    margin-right: 30px;
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, transparent 15%, #fff 100%);
  }
  .label {
    position: absolute;
    right: 30px;
    top: -14px;
    line-height: 1.2;
    font-size: 12px;
    color: var(--detail-font-bright, var(--color-primary-dark-100));
    text-shadow: var(--detail-font-shadow, none);
    opacity: .7;
  }
  .skipBtn {
    position: absolute;
    right: 0;
    top: 0;
    transform: translateY(-50%);
    width: 30px;
    height: 30px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none !important;
    pointer-events: initial;
    transition: @transition-normal;
    transition-property: opacity;
    opacity: .8;
    &:hover {
      opacity: .6;
    }
  }
}
.followBtn {
  // Luminous Harmonic: 顶部 14px 让位给右栏视图切换按钮（viewToggleBtn），下移到其下方
  position: absolute;
  top: 52px;
  right: 12px;
  z-index: 3;
  width: 28px;
  height: 28px;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--glass-card, transparent) 88%, transparent);
  color: var(--color-primary);
  box-shadow: 0 4px 14px rgb(0 0 0 / .14);
  opacity: .88;
  transition: opacity @transition-fast, transform @transition-fast, background-color @transition-fast;

  &:hover {
    opacity: 1;
    transform: translateY(-1px);
    background: var(--glass-card-hover, transparent);
  }

  svg { width: 100%; height: 100%; }
}
.lyricSelectContent {
  position: absolute;
  left: 0;
  top: 0;
  // text-align: center;
  height: 100%;
  width: 100%;
  font-size: var(--playDetail-lrc-font-size, 16px);
  z-index: 10;
  color: var(--detail-font-bright, var(--color-400));
  text-shadow: var(--detail-font-shadow, none);

  .lyricSelectline {
    padding: calc(var(--playDetail-lrc-font-size, 16px) / 2) 1px;
    overflow-wrap: break-word;
    transition: @transition-normal !important;
    transition-property: color, font-size;
    line-height: 1.3;
  }
  .lyricSelectlineExtended {
    font-size: 14px;
  }
  .lrcActive {
    color: var(--color-primary);
  }
}

.lyricSpace {
  height: 70%;
}

</style>
