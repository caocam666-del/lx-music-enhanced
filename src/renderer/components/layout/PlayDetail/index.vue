<template lang="pug">
//- Luminous Harmonic: Pure-music 风格详情页（保留圆形封面 + 转动）
//- 布局: 左侧封面 → 歌曲/歌手/专辑 → 进度条(横跨) → 底部工具栏(左中右) ; 右侧 LyricPlayer
//- 进出场: 自定义 360ms 入场(entrance 曲线 slide+fade) / 220ms 出场, 替代 animate.css 1s 默认时长
transition(
  :enter-active-class="detailEnterActive" :enter-from-class="detailEnterFrom"
  :leave-active-class="detailLeaveActive" :leave-to-class="detailLeaveTo"
  @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  .container(v-if="isShowPlayerDetail" :class="{ fullscreen: isFullscreen, playing: isPlay, paused: !isPlay, themeBackground: appSetting['playDetail.backgroundMode'] == 'theme' }" :style="detailStyle" @contextmenu="handleContextMenu")
    .bg
    // Luminous Harmonic: 流光层 (基于封面主色 accent 的径向渐变 + 旋转, 两种取色模式都渲染)
    // Luminous Harmonic: 环境光斑 — 调色板驱动的三色漂移 blob (Apple Music 风格, Cider 同款思路)
    .bgCoverBlur(v-if="musicInfo.pic")
      span.bgBlob.bgBlob1
      span.bgBlob.bgBlob2
      span.bgBlob.bgBlob3
    .bgWash
    // Luminous Harmonic: 亮度自适应蒙层（Pure-music 思路）— 封面亮 → 蒙层加深,
    // 把背景亮度钳制在暗区, 保证任何封面色下文字/UI 都清晰
    .bgScrim
    //- Luminous Harmonic: 兜底"X 关闭"按钮, 永远可见 (不依赖 visibled), z-index 高于容器
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'")
    ControlBtnsRightHeader(v-else)
    .main
      //- 左主区
      .left
        // 封面（圆形保留 + 转动 + 换歌过渡）
        .artworkStage
          .artwork(ref="artworkRef" :key="musicInfo.pic || 'no-pic'" class="coverTransition")
            img.img(
              v-if="musicInfo.pic"
              :src="musicInfo.pic"
              :style="{ animationPlayState: isPlay ? 'running' : 'paused' }"
              @load="handleCoverLoad"
            )
            .emptyArtwork(v-else) LX
            span.artworkCenter(v-if="appSetting['playDetail.isShowArtworkCenter']")
          // Luminous Harmonic: 环形频谱 — SVG 重写, 用 inline style 设 size 跟随 .artwork 实际尺寸, 频谱位置精确
          common-audio-visualizer(v-if="appSetting['player.audioVisualization'] && visibled" :style="{ width: soundFieldSize + 'px', height: soundFieldSize + 'px' }" :size="soundFieldSize" :inner-radius-ratio="artworkCoverRatio" class="soundField")
        // 封面正下方：歌名 + 歌手 + 专辑（Pure-music 信息层级; 歌手/专辑可点击跳搜索）
        .meta
          h2.songName {{ musicInfo.name }}
          .singer.linklike(v-if="musicInfo.singer" :title="$t('player__detail_search_singer')" @click.stop="searchKeyword(musicInfo.singer)") {{ musicInfo.singer }}
          .album.linklike(v-if="musicInfo.album" :title="$t('player__detail_search_album')" @click.stop="searchKeyword(musicInfo.album)") {{ musicInfo.album }}
      //- Luminous Harmonic: 右栏视图切换（Pure-music 两态循环: 歌词/播放列表; 评论视图由评论按钮进出）
      button.viewToggleBtn(:aria-label="detailView === 'playlist' ? $t('player__detail_view_lyric') : $t('player__detail_view_playlist')" :title="detailView === 'playlist' ? $t('player__detail_view_lyric') : $t('player__detail_view_playlist')" @click="toggleDetailView")
        svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" space="preserve")
          use(v-if="detailView !== 'playlist'" xlink:href="#icon-musicFile")
          use(v-else xlink:href="#icon-text")
      //- 右栏：歌词/播放列表/评论 三态视图（评论改为视图内嵌，不再 absolute 叠加遮挡歌词）
      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut" mode="out-in")
        LyricPlayer(v-if="visibled && detailView === 'lyric'" :key="'lyric-' + (musicInfo.id || 'no-music')")
        detail-playlist(v-else-if="visibled && detailView === 'playlist'" :key="'playlist'")
        music-comment(v-else-if="visibled && detailView === 'comment'" :key="'comment-' + (musicInfo.id || 'no-music')" class="comment" :show="true" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
      play-bar(v-if="visibled")
</template>


<script>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  isPlay,
  musicInfo,
  playMusicInfo,
  coverAccent,
  coverPalette,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import { useRouter } from '@common/utils/vueRouter'
import LyricPlayer from './LyricPlayer.vue'
import PlayBar from './PlayBar.vue'
import DetailPlaylist from './components/DetailPlaylist.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { getCoverPalette } from '@renderer/utils/coverPalette'

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    DetailPlaylist,
    MusicComment,
  },
  setup() {
    const visibled = ref(false)
    // Luminous Harmonic: 详情页进出过渡类名 — 360ms 入场(上滑+淡入, entrance 曲线) / 220ms 出场
    const detailEnterActive = 'detail-slide-enter-active'
    const detailEnterFrom = 'detail-slide-enter-from'
    const detailLeaveActive = 'detail-slide-leave-active'
    const detailLeaveTo = 'detail-slide-leave-to'
    // Luminous Harmonic: 右栏视图状态（歌词/播放列表 两态循环, 评论视图由评论按钮进出）
    const detailView = ref('lyric')
    let lastMainView = 'lyric'
    const toggleDetailView = () => {
      // 评论视图下点击切回歌词；其余在 歌词/播放列表 两态间循环
      detailView.value = detailView.value === 'lyric' ? 'playlist' : 'lyric'
    }
    watch(isShowPlayComment, show => {
      if (show) {
        if (detailView.value !== 'comment') lastMainView = detailView.value
        detailView.value = 'comment'
      } else if (detailView.value === 'comment') {
        detailView.value = lastMainView
      }
    })
    const detailStyle = computed(() => ({
      '--detail-background-mode': appSetting['playDetail.backgroundMode'],
      // .container 内部元素 (bg/artwork/歌词) 需要 --detail-accent-color 恒存在:
      // theme 模式嵌套 var(--color-primary), cover 模式用封面主色
      '--detail-accent-color': appSetting['playDetail.backgroundMode'] == 'theme' ? 'var(--color-primary)' : `rgb(${coverAccent.value})`,
      '--detail-cover-image': appSetting['playDetail.backgroundMode'] == 'theme' || !musicInfo.pic ? 'none' : `url("${musicInfo.pic}")`,
      '--detail-theme-image': appSetting['playDetail.backgroundMode'] == 'theme' ? 'none' : 'var(--background-image)',
    }))

    // Luminous Harmonic: 把 accent color 写到 documentElement, 让 PlayBar (在 .container 外) 也能读取
    // 仅详情页打开时写, 关闭时移除 → 中等模式回退主题色
    // 借鉴 Pure-music 的取色对比策略:
    //  - 封面色只作"强调色" (进度条/按钮背景/歌词高亮)
    //  - 文字/图标用独立的中性高对比色 --detail-font-bright (任何封面色下都清晰)
    //  - 强调色上的文字用亮度对比函数 --detail-on-accent (暗→白, 亮→黑)
    // Luminous Harmonic: k-means 调色板变量 — 前 3 色驱动 .bg 多层径向渐变
    // (注册为 <color> 的 @property + :root transition, 调色板变化 360ms 平滑过渡)
    const PALETTE_VARS = ['--detail-pal-1', '--detail-pal-2', '--detail-pal-3']
    const removePaletteVars = () => {
      for (const v of PALETTE_VARS) document.documentElement.style.removeProperty(v)
    }
    const writePaletteVars = () => {
      if (appSetting['playDetail.backgroundMode'] == 'theme' || !coverPalette.value.length) return
      PALETTE_VARS.forEach((v, i) => {
        const color = coverPalette.value[i]
        if (color) document.documentElement.style.setProperty(v, `rgb(${color})`)
      })
    }

    const writeAccentToRoot = () => {
      if (!isShowPlayerDetail.value) {
        document.documentElement.style.removeProperty('--detail-accent-color')
        document.documentElement.style.removeProperty('--detail-accent-bright')
        document.documentElement.style.removeProperty('--detail-on-accent')
        document.documentElement.style.removeProperty('--detail-font-bright')
        document.documentElement.style.removeProperty('--detail-font-shadow')
        document.documentElement.style.removeProperty('--detail-lyric-shadow')
        document.documentElement.style.removeProperty('--detail-scrim-opacity')
        removePaletteVars()
        return
      }
      if (appSetting['playDetail.backgroundMode'] == 'theme') {
        // 主题模式：accent 用主题色，强调亮化版轻微提亮保证进度条清晰；
        // 文字用主题文字色（--detail-font-bright 回退 --color-font），阴影关闭（主题背景可控，无需强阴影）
        document.documentElement.style.removeProperty('--detail-accent-color')
        document.documentElement.style.setProperty('--detail-accent-bright', 'color-mix(in srgb, var(--color-primary) 82%, white)')
        document.documentElement.style.removeProperty('--detail-on-accent')
        document.documentElement.style.setProperty('--detail-font-bright', 'var(--color-font)')
        document.documentElement.style.setProperty('--detail-font-shadow', 'none')
        document.documentElement.style.removeProperty('--detail-lyric-shadow')
        // 主题背景可控，轻微蒙层统一对比
        document.documentElement.style.setProperty('--detail-scrim-opacity', '0.18')
        removePaletteVars()
        return
      }
      const accent = `rgb(${coverAccent.value})`
      document.documentElement.style.setProperty('--detail-accent-color', accent)
      // 亮度阈值: 过暗的封面主色混白提亮（强调用途）
      const parts = String(coverAccent.value).split(',').map(n => Number(n) || 0)
      const luminance = (parts[0] * 299 + parts[1] * 587 + parts[2] * 114) / 1000
      const whiteMix = luminance < 120 ? 0.5 : (luminance < 180 ? 0.22 : 0)
      document.documentElement.style.setProperty('--detail-accent-bright', whiteMix > 0
        ? `color-mix(in srgb, ${accent} ${Math.round((1 - whiteMix) * 100)}%, white)`
        : accent)
      // 强调色上的文字对比色（Pure-music: luminance > 0.179 用黑, 否则白）
      document.documentElement.style.setProperty('--detail-on-accent', luminance > 140 ? '#111318' : '#ffffff')
      // 中性高对比文字色：封面取色背景深浅不定，文字固定用近白 + 阴影保证清晰
      document.documentElement.style.setProperty('--detail-font-bright', '#f4f5f7')
      document.documentElement.style.setProperty('--detail-font-shadow', '0 1px 3px rgb(0 0 0 / .7), 0 0 12px rgb(0 0 0 / .45)')
      // Luminous Harmonic: 歌词专用轻阴影 — 只留 1px 贴边暗线保可读性 (含 12px 光晕的
      // --detail-font-shadow 挂到全部歌词行会在暗背景上显"脏", 用户反馈)
      document.documentElement.style.setProperty('--detail-lyric-shadow', '0 1px 2px rgb(0 0 0 / .4)')
      // Luminous Harmonic: 亮度自适应蒙层（Pure-music 背景亮度钳制思路）
      // 封面越亮 → 蒙层越深，把背景亮度锁在暗区，任何封面色下文字/UI 都清晰
      // (三档较早期方案上调: 流光亮斑峰值叠加时 0.34 档不足以压住, 导致文字发虚)
      const scrim = luminance < 70 ? 0.42 : (luminance < 140 ? 0.56 : 0.68)
      document.documentElement.style.setProperty('--detail-scrim-opacity', String(scrim))
    }
    watch([() => appSetting['playDetail.backgroundMode'], coverAccent, isShowPlayerDetail], writeAccentToRoot, { immediate: true })
    watch([coverPalette, isShowPlayerDetail, () => appSetting['playDetail.backgroundMode']], writePaletteVars)
    onBeforeUnmount(() => {
      document.documentElement.style.removeProperty('--detail-accent-color')
      document.documentElement.style.removeProperty('--detail-accent-bright')
      document.documentElement.style.removeProperty('--detail-on-accent')
      document.documentElement.style.removeProperty('--detail-font-bright')
      document.documentElement.style.removeProperty('--detail-font-shadow')
      document.documentElement.style.removeProperty('--detail-lyric-shadow')
      document.documentElement.style.removeProperty('--detail-scrim-opacity')
      removePaletteVars()
    })

    // Luminous Harmonic: 频谱跟随 .artwork 实际尺寸 — 用 ref 测 .artwork width, 让 .soundField = artwork + 40px
    const artworkRef = ref(null)
    const artworkSize = ref(320)
    const updateArtworkSize = () => {
      if (artworkRef.value) {
        const w = artworkRef.value.getBoundingClientRect().width
        if (w > 0) artworkSize.value = Math.round(w)
      }
    }
    let artworkResizeObserver = null
    onMounted(() => {
      updateArtworkSize()
      window.addEventListener('resize', updateArtworkSize)
      if (artworkRef.value && typeof ResizeObserver !== 'undefined') {
        artworkResizeObserver = new ResizeObserver(updateArtworkSize)
        artworkResizeObserver.observe(artworkRef.value)
      }
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', updateArtworkSize)
      artworkResizeObserver?.disconnect()
    })
    // 频谱容器 size = artworkSize + 72, innerR = (size/2) * innerRadiusRatio
    // Luminous Harmonic: 外扩从 40px 提到 72px — 频谱条长从 18px 增到 ~34px, 环形频谱肉眼可见
    const soundFieldSize = computed(() => artworkSize.value + 72)
    const artworkCoverRatio = computed(() => {
      const total = soundFieldSize.value
      if (total <= 0) return 0.85
      return artworkSize.value / total
    })
    const handleCoverLoad = event => {
      const image = event.target
      if (!image?.naturalWidth || !image.naturalHeight) return
      // Luminous Harmonic: 升级为 Lab k-means 调色板取色 (Pure-music 手法) —
      // 替代原 1x1 平均色: 主色更准, 且产出 4 色调色板驱动多层流光背景
      const result = getCoverPalette(image, image.currentSrc || image.src || '')
      if (!result) return
      coverAccent.value = result.accent
      coverPalette.value = result.palette
    }

    let clickTime = 0

    const hide = () => {
      setShowPlayerDetail(false)
    }

    // Luminous Harmonic: 歌手/专辑点击 → 跳搜索页搜该关键词（对标 Pure-music 的信息跳转）
    const router = useRouter()
    const searchKeyword = keyword => {
      if (!keyword) return
      setShowPlayerDetail(false)
      void router.push({ path: '/search', query: { text: keyword } }).catch(_ => _)
    }

    // Luminous Harmonic: ESC 快捷键退出播放详情页
    const handleEscapeKeydown = (e) => {
      if (e.key !== 'Escape') return
      if (!isShowPlayerDetail.value) return
      const tag = (e.target?.tagName || '').toLowerCase()
      if (['input', 'textarea', 'select'].includes(tag)) return
      if (e.target?.isContentEditable) return
      hide()
      e.preventDefault()
      e.stopPropagation()
    }
    onMounted(() => { window.addEventListener('keydown', handleEscapeKeydown, true) })
    onBeforeUnmount(() => { window.removeEventListener('keydown', handleEscapeKeydown, true) })
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()
      visibled.value = true
      // Luminous Harmonic: 详情页打开后 .artwork 已渲染, 重新测尺寸让频谱精确贴合封面
      void nextTick(updateArtworkSize)
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false
      unregisterAutoHideMounse()
    }

    watch(isFullscreen, isFullscreen => {
      (isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    return {
      appSetting,
      detailStyle,
      detailEnterActive,
      detailEnterFrom,
      detailLeaveActive,
      detailLeaveTo,
      detailView,
      toggleDetailView,
      handleCoverLoad,
      coverAccent,
      soundFieldSize,
      artworkCoverRatio,
      artworkRef,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      isPlay,
      hide,
      searchKeyword,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
      visibled,
      isFullscreen,
    }
  },
}
</script>


<style lang="less">
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * .26;

// Luminous Harmonic: 调色板变量注册为可插值颜色 (Chromium @property) —
// 换歌时 .bg 多层渐变 360ms 平滑过渡, 而非瞬间跳变 (background-image 本身不可过渡)
@property --detail-pal-1 { syntax: '<color>'; inherits: true; initial-value: rgba(0, 0, 0, 0); }
@property --detail-pal-2 { syntax: '<color>'; inherits: true; initial-value: rgba(0, 0, 0, 0); }
@property --detail-pal-3 { syntax: '<color>'; inherits: true; initial-value: rgba(0, 0, 0, 0); }
:root {
  transition: --detail-pal-1 .36s ease-out, --detail-pal-2 .36s ease-out, --detail-pal-3 .36s ease-out;
}

// Luminous Harmonic: 详情页进出过渡 — 入场 360ms 上滑淡入 (Pure-music 播放页同款), 出场 220ms
.detail-slide-enter-active {
  animation: detail-slide-in 360ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
.detail-slide-leave-active {
  animation: detail-slide-out 220ms cubic-bezier(0.4, 0, 0.2, 1) both;
  pointer-events: none;
}
@keyframes detail-slide-in {
  from { opacity: 0; transform: translateY(4%); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes detail-slide-out {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(2%); }
}
@media (prefers-reduced-motion: reduce) {
  .detail-slide-enter-active,
  .detail-slide-leave-active {
    animation-duration: 1ms;
  }
}


.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  // Luminous Harmonic: 容器背景半透明 → 让 .bg/.bgCoverBlur 流光层透出
  z-index: 10;
  -webkit-app-region: no-drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  contain: strict;
  isolation: isolate;
  box-sizing: border-box;
  // Luminous Harmonic: 流光模糊背景透出 → 容器背景半透明（让 .bgCoverBlur 可见）
  background-color: color-mix(in srgb, var(--color-content-background) 78%, transparent);

  * { box-sizing: border-box; }
}
.bg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  // Luminous Harmonic: 4 层径向渐变分别使用 k-means 调色板前 3 色 + accent (原来 4 层同色)
  background:
    radial-gradient(72% 62% at 25% 28%, color-mix(in srgb, var(--detail-pal-1, var(--detail-accent-color)) 56%, transparent), transparent 70%),
    radial-gradient(62% 55% at 78% 22%, color-mix(in srgb, var(--detail-pal-2, var(--detail-accent-color)) 44%, transparent), transparent 72%),
    radial-gradient(60% 70% at 48% 82%, color-mix(in srgb, var(--detail-pal-3, var(--detail-accent-color)) 38%, transparent), transparent 76%),
    radial-gradient(45% 45% at 16% 86%, color-mix(in srgb, var(--detail-accent-color) 30%, transparent), transparent 72%),
    var(--detail-cover-image),
    var(--detail-theme-image) var(--background-image-position) no-repeat;
  background-size: auto, auto, auto, auto, cover, var(--background-image-size);
  background-position: center, center, center, center, center, var(--background-image-position);
  filter: blur(36px) saturate(1.18);
  transform: scale(1.12);
  opacity: .82;
  z-index: -3;
  // Luminous Harmonic: 背景径向渐变层持续旋转 — Pure-music 流光效果
  animation: detail-bg-rotate 24s linear infinite;
  &:before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, color-mix(in srgb, var(--detail-accent-color) 22%, transparent), transparent 48%, color-mix(in srgb, var(--color-app-background) 72%, transparent));
  }
  &:after {
    position: absolute;
    left: 0; top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background: linear-gradient(180deg, color-mix(in srgb, var(--detail-accent-color) 12%, transparent), color-mix(in srgb, var(--color-main-background) 76%, transparent));
  }
}
@keyframes detail-bg-rotate {
  from { transform: rotate(0deg) scale(1.1); }
  to { transform: rotate(360deg) scale(1.22); }
}
// Luminous Harmonic: 亮度自适应蒙层（Pure-music 思路）
// 位于所有背景层之上、内容层之下；封面越亮蒙层越深，背景亮度被钳制在暗区
.bgScrim {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: rgb(0 0 0 / var(--detail-scrim-opacity, .45));
  transition: background-color .45s ease;
}
.themeBackground {
  .bg {
    background:
      radial-gradient(58% 46% at 24% 20%, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent 70%),
      radial-gradient(46% 40% at 78% 30%, color-mix(in srgb, var(--color-primary) 15%, transparent), transparent 72%),
      radial-gradient(56% 54% at 60% 84%, color-mix(in srgb, var(--color-primary) 13%, transparent), transparent 76%),
      radial-gradient(42% 42% at 16% 88%, color-mix(in srgb, var(--color-primary) 11%, transparent), transparent 72%),
      radial-gradient(circle at 16% 14%, color-mix(in srgb, var(--color-primary) 26%, transparent), transparent 50%),
      radial-gradient(circle at 84% 86%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 52%),
      linear-gradient(135deg, var(--color-app-background), var(--color-content-background) 58%, var(--color-main-background));
    background-size: auto, auto, auto, auto, auto, auto, auto;
    background-position: center, center, center, center, center, center, center;
  }
}
// Luminous Harmonic: 流光层 — 基于封面主色 accent 的多层 radial-gradient 旋转 (不模糊整张封面)
// Luminous Harmonic: 环境光斑容器 — 三色调色板 blob 各自漂移 + 容器缓慢摇摆, 形成有机流动
.bgCoverBlur {
  position: absolute;
  inset: -12%;
  z-index: -2;
  pointer-events: none;
  animation: detail-blob-sway 40s ease-in-out infinite alternate;
}
.bgBlob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px) saturate(1.35);
  will-change: transform;
  opacity: .58;
}
.bgBlob1 {
  width: 46%;
  height: 46%;
  left: -6%;
  top: -10%;
  background: radial-gradient(circle, color-mix(in srgb, var(--detail-pal-1, var(--detail-accent-color)) 78%, transparent), transparent 70%);
  animation: detail-blob-drift-1 26s ease-in-out infinite alternate;
}
.bgBlob2 {
  width: 40%;
  height: 40%;
  right: -8%;
  top: 14%;
  background: radial-gradient(circle, color-mix(in srgb, var(--detail-pal-2, var(--detail-accent-color)) 70%, transparent), transparent 70%);
  animation: detail-blob-drift-2 34s ease-in-out infinite alternate;
  opacity: .52;
}
.bgBlob3 {
  width: 34%;
  height: 34%;
  left: 28%;
  bottom: -12%;
  background: radial-gradient(circle, color-mix(in srgb, var(--detail-pal-3, var(--detail-accent-color)) 62%, transparent), transparent 70%);
  animation: detail-blob-drift-3 42s ease-in-out infinite alternate;
  opacity: .48;
}
@keyframes detail-blob-drift-1 {
  from { transform: translate(0, 0) scale(1); }
  to { transform: translate(7%, 5%) scale(1.18); }
}
@keyframes detail-blob-drift-2 {
  from { transform: translate(0, 0) scale(1.05); }
  to { transform: translate(-6%, 7%) scale(.92); }
}
@keyframes detail-blob-drift-3 {
  from { transform: translate(0, 0) scale(.95); }
  to { transform: translate(5%, -6%) scale(1.15); }
}
@keyframes detail-blob-sway {
  from { transform: rotate(0deg); }
  to { transform: rotate(8deg); }
}
.bgWash {
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background: linear-gradient(110deg, color-mix(in srgb, var(--detail-accent-color) 14%, transparent), transparent 42%), linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-main-background) 12%, transparent));
  -webkit-backdrop-filter: blur(8px) saturate(1.08);
  backdrop-filter: blur(8px) saturate(1.08);
}

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  margin: 0 44px;
  gap: 4vw;
  position: relative;
  z-index: 1;
}
.left {
  flex: 0 0 min(40%, 480px);
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  padding: 24px 20px 18px;
  overflow: hidden;
  transition: flex-basis @transition-normal;
}

// Luminous Harmonic: Pure-music 风格 - 歌曲/歌手/专辑在封面正下方
.meta {
  text-align: center;
  margin-top: 18px;
  margin-bottom: 8px;
  max-width: 380px;
  width: 100%;
}
.songName {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  // Luminous Harmonic: 封面取色模式近白、主题模式回退主题文字色（蒙层压暗背景下始终清晰）
  color: var(--detail-font-bright, var(--color-font));
  letter-spacing: .2px;
  // Luminous Harmonic: 阴影统一走 --detail-font-shadow（主题模式为 none，封面取色模式为深柔影）
  text-shadow: var(--detail-font-shadow, 0 1px 2px rgb(0 0 0 / .55));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.singer {
  margin-top: 8px;
  font-size: 14px;
  // Luminous Harmonic: 封面取色模式近白、主题模式回退主题文字色
  color: var(--detail-font-bright, var(--color-font));
  opacity: .95;
  // Luminous Harmonic: 阴影统一走 --detail-font-shadow，避免主题模式下发脏
  text-shadow: var(--detail-font-shadow, 0 1px 3px rgb(0 0 0 / .7));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
// Luminous Harmonic: 专辑行（Pure-music 信息层级：标题/艺术家/专辑）
.album {
  margin-top: 6px;
  font-size: 12px;
  color: var(--detail-font-bright, var(--color-font));
  opacity: .8;
  text-shadow: var(--detail-font-shadow, none);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// Luminous Harmonic: 歌手/专辑可点击跳搜索 — hover 下划线提示可交互
.linklike {
  cursor: pointer;
  transition: opacity @motion-fast @ease-standard;

  &:hover {
    opacity: 1 !important;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

// Luminous Harmonic: 原"占位底部工具栏"的 8 组死样式（.progressBar/.bar/.toolbar*/.btn/.btnPlay）已随
// 占位脚本一并移除 — 底部控制实际由 PlayBar 组件渲染

.artworkStage {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  min-height: 0;
}
// Luminous Harmonic: 换歌封面过渡 — 淡入 + 上移 8% + 缩放 0.92→1（500ms，Pure-music 同款）
.coverTransition {
  animation: detail-cover-enter 500ms cubic-bezier(.2, .7, .3, 1) both;
}
@keyframes detail-cover-enter {
  from {
    opacity: 0;
    transform: translateY(8%) scale(.92);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.artwork {
  position: relative;
  // Luminous Harmonic: 尺寸同时受宽高约束（Pure-music min(maxWidth, maxHeight-reserved) 思路）—
  // 矮窗口时封面收缩而不是把歌名/歌手区裁掉; 140px 兜底防止极端比例下消失
  width: min(clamp(220px, 24vw, 320px), max(140px, calc(100vh - 380px)));
  min-width: 0;
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border-radius: 50%;
  padding: 10px;
  background: conic-gradient(from 20deg, color-mix(in srgb, var(--detail-accent-color) 72%, transparent), rgb(255 255 255 / .16), color-mix(in srgb, var(--detail-accent-color) 24%, transparent), color-mix(in srgb, var(--color-app-background) 70%, transparent), color-mix(in srgb, var(--detail-accent-color) 72%, transparent));
  box-shadow: 0 22px 60px color-mix(in srgb, var(--color-app-background) 34%, transparent), 0 0 0 1px rgb(255 255 255 / .16), 0 0 70px color-mix(in srgb, var(--detail-accent-color) 26%, transparent);
  isolation: isolate;
  z-index: 1;
  &::before {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgb(255 255 255 / .22);
    border-radius: 50%;
    pointer-events: none;
    z-index: 1;
  }
}
.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  opacity: .96;
  // Luminous Harmonic: 动画默认 running, 暂停由 inline style :animation-play-state 控制 (isPlay 绑定)
  animation: detail-artwork-spin 24s linear infinite;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / .12);
}
.artworkCenter {
  position: absolute;
  z-index: 2;
  // Luminous Harmonic: 黑胶中心点缩小弱化（14px 芯 + 3px 环），减少对封面主体的遮挡
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-app-background) 82%, transparent);
  border: 3px solid rgb(255 255 255 / .72);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--detail-accent-color) 38%, transparent), 0 2px 8px color-mix(in srgb, var(--color-app-background) 38%, transparent);
  pointer-events: none;
}
.emptyArtwork {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: rgb(255 255 255 / .86);
  background: radial-gradient(circle, color-mix(in srgb, var(--detail-accent-color) 70%, transparent), color-mix(in srgb, var(--color-app-background) 86%, transparent));
  font: 700 28px Consolas, monospace;
}
.soundField {
  // Luminous Harmonic: SVG 频谱 — 用 inline style 控制 size, position: absolute 居中于 .artworkStage
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  // Luminous Harmonic: SVG color 继承 — 让频谱条读 accent (详情页 accent 透传)
  color: var(--detail-accent-color, var(--color-primary)) !important;
  pointer-events: none;
  overflow: visible !important;
}

@keyframes detail-artwork-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 760px) {
  .main { margin: 0 16px; gap: 12px; }
  .left { flex-basis: 34%; padding: 22px 10px 12px; }
  // Luminous Harmonic: 去掉 min-width:120px（极窄窗口 <410px 时会溢出裁切），改由宽度约束自适应
  .artwork { width: min(30vw, 220px); min-width: 0; padding: 7px; }
  .artworkCenter { width: 16px; height: 16px; border-width: 4px; }
  .songName { font-size: 18px; }
  .singer { font-size: 12px; margin-top: 5px; }
  .album { font-size: 11px; margin-top: 4px; }
}

// Luminous Harmonic: 评论视图 — 右栏视图化后为常规流内布局（不再 absolute 叠加遮挡歌词）
.comment {
  position: relative;
  width: 100%;
  height: 100%;
  margin-left: 0;
}

// Luminous Harmonic: 右栏视图切换按钮（歌词/播放列表两态循环）— 与 followBtn 同款玻璃小圆钮
// top 74px = 顶栏 60px + 14px，对齐右栏顶部，避开顶栏右侧的窗口控制按钮
.viewToggleBtn {
  position: absolute;
  top: 74px;
  right: 12px;
  z-index: 4;
  width: 28px;
  height: 28px;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 42%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--glass-card, transparent) 88%, transparent);
  color: var(--color-primary);
  box-shadow: 0 4px 14px rgb(0 0 0 / .14);
  opacity: .88;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity @transition-fast, transform @transition-fast, background-color @transition-fast;

  &:hover {
    opacity: 1;
    transform: translateY(-1px);
    background: var(--glass-card-hover, transparent);
  }

  svg { width: 100%; height: 100%; fill: currentColor; }
}

@media (prefers-reduced-motion: reduce) {
  .bg { animation: none; }
  .bgCoverBlur,
  .bgBlob { animation: none; }
}
</style>
