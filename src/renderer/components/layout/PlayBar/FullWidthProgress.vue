<template>
  <div :class="$style.wrap">
    <!--
      Luminous Harmonic: 播放栏悬浮胶囊
      - 真"横跨底部": #player 现在是 #container 直接子级, 占满整个窗口底部宽度
      - 但视觉上仍是"悬浮胶囊": 内部 .player 用 max-width: 1080px + margin auto 居中,
        窗口多宽都不会"长满"挤到边 (用户反馈"播放栏做的那么宽按钮那么大")
      - 浅色透明毛玻璃 (主题感知: 深色→暗玻璃 / 浅色→白玻璃)
      - 进度条在胶囊内部底部一行
      - 控件紧凑化: 封面 40px, 主播放 34px, 间距小
    -->
    <div :class="$style.player">
      <ProgressVisualizer v-if="playMusicInfo.musicInfo && appSetting['common.playBarVisualization'] !== false" :class="[$style.visualizerBg, { [$style.visualizerPaused]: !isPlay }]" />
      <!-- 顶部行: 控件主体 -->
      <div :class="$style.topRow">
        <!-- 左段: 方形封面 + 歌名/歌手 + ❤ -->
        <div :class="$style.leftSeg">
          <div :class="$style.picContent" :aria-label="$t('player__pic_tip')" @contextmenu="handleToMusicLocation" @click="showPlayerDetail">
            <img v-if="musicInfo.pic" :key="musicInfo.pic" :class="$style.coverImg" :src="musicInfo.pic" decoding="async" @error="imgError">
            <div v-else :class="$style.emptyPic">L<span>X</span></div>
          </div>
          <div :class="$style.infoContent">
            <div :class="$style.title" :aria-label="(musicInfo.name || '') + $t('copy_tip')" @click="handleCopy(musicInfo.name)">
              {{ musicInfo.name || $t('player__no_music') }}
            </div>
            <div :class="$style.singer" :aria-label="singerAlbum + $t('copy_tip')" @click="handleCopy(singerAlbum)">
              {{ singerAlbum || '\u00a0' }}
            </div>
            <div v-if="isPlayerError" :class="$style.status">
              <span>{{ statusText }}</span>
              <button type="button" :class="$style.retryBtn" :aria-label="$t('player__retry')" @click.stop="retryPlayback">
                {{ $t('player__retry') }}
              </button>
            </div>
          </div>
        </div>

        <!-- 中段: shuffle | prev | ▶大圆 | next | 全屏 (紧凑化) -->
        <div :class="$style.lyricContent" :title="lyric.text">
          {{ lyric.text || '\u00a0' }}
        </div>
        <div :class="$style.midSeg">
          <!-- Luminous Harmonic: 播放控制三连改用共享 PlayControls (原三模式各写一份) -->
          <PlayControls />
          <div :class="$style.iconBtn" :aria-label="$t('player__fullscreen') || '全屏播放'" @click="showPlayerDetail">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
              <path d="M5 5h6v2H7v4H5V5zm0 14v-6h2v4h4v2H5zm14-6v6h-6v-2h4v-4h2zm0-8v6h-2V7h-4V5h6z" fill="currentColor" />
            </svg>
          </div>
          <button :class="$style.likeBtn" :aria-label="$t('player__add_music_to')" @click="addMusicTo">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <!-- 右段: FLAC + control-btns (歌词/音量/列表) -->
        <div :class="$style.rightSeg">
          <span :class="$style.flacBadge">FLAC</span>
          <control-btns />
        </div>
      </div>

      <!-- 底部行: 进度条 (在胶囊内部) — 波浪开关: 开 = middle 同款 SVG 正弦波; 关 = canvas 波形粒子 -->
      <div :class="$style.bottomRow">
        <span :class="$style.timeLabel">{{ nowPlayTimeStr }}</span>
        <common-progress-bar
          v-if="appSetting['common.playBarWave']"
          :class="$style.waveProgress"
          :progress="progress"
          :handle-transition-end="handleTransitionEnd"
          :is-active-transition="isActiveTransition"
          :wave="true"
        />
        <common-progress-bar
          v-else
          :class="$style.waveProgress"
          :progress="progress"
          :handle-transition-end="handleTransitionEnd"
          :is-active-transition="isActiveTransition"
        />
        <span :class="$style.timeLabel">{{ maxPlayTimeStr }}</span>
      </div>
    </div>

    <!-- 喜欢按钮触发的加到歌单模态框 -->
    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
  </div>
</template>

<script>
import { ref, computed } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { clipboardWriteText } from '@common/utils/electron'
import ControlBtns from './ControlBtns.vue'
import PlayControls from './PlayControls.vue'
import ProgressVisualizer from './ProgressVisualizer.vue'
import CommonListAddModal from '@renderer/components/common/ListAddModal.vue'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { lyric } from '@renderer/store/player/lyric'
import {
  statusText,
  isPlayerError,
  musicInfo,
  isShowPlayerDetail,
  isPlay,
  playInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setMusicInfo,
  setShowPlayerDetail,
} from '@renderer/store/player/action'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'
import { appSetting } from '@renderer/store/setting'
import { LIST_IDS } from '@common/constants'

export default {
  name: 'CorePlayBar',
  components: {
    ControlBtns,
    PlayControls,
    ProgressVisualizer,
    CommonListAddModal,
  },
  setup() {
    const router = useRouter()

    const {
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
    } = usePlayProgress()

    const retryPlayback = () => {
      window.app_event?.playerRetry?.()
    }

    const isShowAddMusicTo = ref(false)

    const showPlayerDetail = () => {
      if (!playMusicInfo.musicInfo) return
      setShowPlayerDetail(true)
    }
    const handleCopy = (text) => {
      if (!text) return
      clipboardWriteText(text)
    }
    const addMusicTo = () => {
      if (!musicInfo.id) return
      isShowAddMusicTo.value = true
    }

    const imgError = () => {
      setMusicInfo({ pic: null })
    }

    const handleToMusicLocation = () => {
      const listId = playMusicInfo.listId
      if (!listId || listId == LIST_IDS.DOWNLOAD || !playMusicInfo.musicInfo) return
      if (playInfo.playIndex == -1) return
      void router.push({
        path: '/list',
        query: {
          id: listId,
          scrollIndex: playInfo.playIndex,
        },
      })
    }

    // Spotify 风: 歌名 + 歌手-专辑 双行
    const singerAlbum = computed(() => {
      const s = musicInfo.singer
      const a = musicInfo.album
      if (s && a) return `${s} - ${a}`
      return s || a || ''
    })

    return {
      appSetting,
      musicInfo,
      playMusicInfo,
      statusText,
      isPlayerError,
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
      handleCopy,
      isShowAddMusicTo,
      addMusicTo,
      isPlay,
      togglePlay,
      playNext,
      playPrev,
      handleToMusicLocation,
      showPlayerDetail,
      isShowPlayerDetail,
      singerAlbum,
      imgError,
      lyric,
      retryPlayback,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
@import '@renderer/assets/styles/glass.less';

// ============ 外层 wrap: 填满 #player 容器 (110px), 用 flex 居中胶囊 ============
.wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: row nowrap;
  align-items: stretch;
  justify-content: center;
  pointer-events: auto;
}

// ============ 播放栏悬浮胶囊 (真横跨底部 + 紧凑) ============
// #player 容器已经是 #container 直接子级, 占满窗口底部宽度
// 这里限制 .player 自己的宽度 + 居中, 让胶囊像真正"悬浮"在底部中间,
// 窗口再宽也不会"长满"挤到边 (解决用户反馈"播放栏做的那么宽")
.player {
  flex: 0 1 1080px;          // 优先 1080px, 窗口太窄才收缩
  // Luminous Harmonic: 硬高度约束 — 内容预算 2 + topRow(40) + bottomRow(30) = 72px,
  // 无论任何子内容异常膨胀都由 overflow:hidden 兜底, 防止胶囊撑破 #player(84px) 覆盖页面
  height: 72px;
  min-height: 0;
  // 用户要求: 悬浮胶囊两边要和页面两端有距离, 禁止重叠 → 左右各 24px 留白
  // 同时整体高度要降低 (去臃肿): 上下留白收紧 上6 / 下8
  margin: 6px 24px 8px;
  padding: 2px 16px 0;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  border-radius: 14px;
  // 浅色透明毛玻璃 (主题感知)
  background-color: color-mix(in srgb, var(--glass-surface-strong, rgba(255, 255, 255, 0.78)) calc(var(--glass-alpha, 0.8) * 100%), transparent);
  -webkit-backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.4);
  backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.4);
  border: 1px solid var(--glass-stroke-strong, rgba(255, 255, 255, 0.65));
  box-shadow: var(--glass-shadow, 0 10px 30px -10px rgba(0, 0, 0, 0.5));
  color: var(--color-font);
  -webkit-app-region: no-drag;
  overflow: hidden;
  // 进入动画
  animation: player-capsule-in 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.visualizerBg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
  opacity: 0.38;
  transition: opacity 0.55s ease;
}

.visualizerPaused {
  opacity: 0;
}

.lyricContent {
  // Keep lyric in the dedicated slot between the like button and FLAC controls.
  position: absolute;
  left: calc(50% + 105px);
  right: 210px;
  width: auto;
  min-width: 0;
  padding: 0 10px;
  margin: 0;
  color: var(--color-font);
  font-size: 12px;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.86;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.16);
  pointer-events: none;
}

@keyframes player-capsule-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

// ============ 顶部行: 控件 (封面+控制+音量) ============
.topRow {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

// ============ 左段: 方形封面 + 双行文字 + ❤ ============
.leftSeg {
  flex: 0 0 270px;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  max-width: 270px;
  height: 100%;
}

.picContent {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.06);
  transition: opacity @transition-fast;

  // Luminous Harmonic: 换歌封面过渡
  .coverImg {
    animation: pb-cover-enter 500ms cubic-bezier(.2, .7, .3, 1) both;
  }

  &:hover { opacity: .85; }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.emptyPic {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--color-primary-light-700-alpha-500), var(--color-primary));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary-font, #fff);
  font-weight: 700;
  user-select: none;
  font-size: 12px;
  font-family: Consolas, "Courier New", monospace;

  span { padding-left: 2px; }
}

.infoContent {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 1px;
  line-height: 1.25;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-font);
  cursor: pointer;
  .mixin-ellipsis-1();
  transition: color @transition-fast;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  &:hover { color: var(--color-primary); }
}

.singer {
  font-size: 10.5px;
  color: var(--color-font);
  cursor: pointer;
  .mixin-ellipsis-1();
  transition: color @transition-fast;
  opacity: 0.72;
  &:hover { color: var(--color-font); opacity: 1; }
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 190px;
  overflow: hidden;
  color: var(--color-font-label);
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.retryBtn {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--detail-accent-color, var(--color-primary-alpha-500));
  border-radius: 999px;
  background: var(--detail-accent-color, var(--color-primary-alpha-100));
  color: var(--detail-accent-color, var(--color-primary));
  font: inherit;
  cursor: pointer;
  &:hover { background: var(--color-primary-alpha-200); }
}

.likeBtn {
  flex: none;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  outline: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--color-font);
  transition: color @transition-fast, background-color @transition-fast, transform @transition-fast;

  svg { fill: currentColor; pointer-events: none; }
  &:hover {
    color: var(--player-like);
    background-color: color-mix(in srgb, var(--player-like) 12%, transparent);
  }
  &:active { transform: scale(0.92); }
}

// ============ 中段: shuffle | prev | ▶大圆 | next | 全屏 (紧凑化) ============
.midSeg {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  z-index: 2;
}

.iconBtn {
  flex: none;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: transparent;
  border: none;
  outline: none;
  padding: 0;
  cursor: pointer;
  color: var(--color-font);
  transition: color @transition-fast, background-color @transition-fast, transform @transition-fast;

  svg {
    fill: currentColor;
    pointer-events: none;
  }

  &:hover {
    color: var(--color-font);
    // Luminous Harmonic: 中性半透明底 — 浅色主题下白玻璃上也可见
    background-color: color-mix(in srgb, var(--color-font) 10%, transparent);
    transform: scale(1.05);
  }
  &:active { transform: scale(0.94); }
}

// 大圆播放按钮: 主色填充 (三模式统一 32px)
.togglePlayBtn {
  width: 32px;
  height: 32px;
  // Luminous Harmonic: 详情页打开时跟随 accent, 关闭回退主题色
  background-color: var(--detail-accent-color, var(--color-primary));
  color: var(--color-on-primary, var(--color-primary-font, #fff));
  margin: 0 4px;
  box-shadow: 0 3px 10px var(--player-glow);

  &:hover {
    background-color: var(--color-primary-light-200);
    color: var(--color-on-primary, var(--color-primary-font, #fff));
    transform: scale(1.06);
    box-shadow: 0 5px 14px var(--player-glow);
  }
  &:active { transform: scale(0.94); }
}

// Luminous Harmonic: 播放/暂停图标形变（240ms cubic-bezier(0.2,0,0,1) 交叉过渡）
.iconMorph {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  svg, svg use { fill: var(--color-on-primary, var(--color-primary-font, #fff)) !important; color: var(--color-on-primary, var(--color-primary-font, #fff)) !important; opacity: 1 !important; }
  svg {
    position: absolute;
    inset: 0;
    margin: auto;
    transition: opacity .24s cubic-bezier(.2, 0, 0, 1), transform .24s cubic-bezier(.2, 0, 0, 1);
  }
  :global(.icon-pause) { opacity: 0 !important; transform: scale(.5) rotate(-24deg); }
  :global(.icon-play) { opacity: 1 !important; transform: scale(1) rotate(0); }
}
.iconMorphActive {
  :global(.icon-pause) { opacity: 1 !important; transform: scale(1) rotate(0); }
  :global(.icon-play) { opacity: 0 !important; transform: scale(.5) rotate(24deg); }
}

// ============ 右段: FLAC + control-btns ============
.rightSeg {
  position: absolute;
  right: 0;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .lyricContent { display: none; }
}

.flacBadge {
  flex: none;
  margin-right: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--detail-accent-color, var(--color-primary));
  background-color: color-mix(in srgb, var(--player-accent) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--player-accent) 30%, transparent);
  user-select: none;
}

// ============ 底部行: 进度条 (在胶囊内部底部) ============
.bottomRow {
  flex: none;
  height: 26px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-font-label);
  user-select: none;
  position: relative;
  z-index: 1;
}

.waveProgress {
  flex: 1 1 auto;
  min-width: 120px;
  height: 26px;
}

.timeLabel {
  flex: none;
  min-width: 38px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  // Luminous Harmonic: 详情页打开时跟随 accent, 关闭回退主题色
  // (修复: 原先下方重复的 color 声明把这里覆盖成了死代码)
  color: var(--detail-accent-color, var(--color-primary));
  line-height: 1;
  font-size: 11px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.progressBar {
  flex: 1 1 auto;
  min-width: 0;
}
// Luminous Harmonic: 换歌封面过渡 keyframes
@keyframes pb-cover-enter {
  from { opacity: 0; transform: translateY(8%) scale(.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
