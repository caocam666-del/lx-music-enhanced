<template>
  <div :class="$style.player" :style="detailAccentStyle">
    <div :class="$style.leftSection">
      <div
        :class="$style.picContent"
        :aria-label="$t('player__pic_tip')"
        @contextmenu="handleToMusicLocation"
        @click="showPlayerDetail"
      >
        <img v-if="musicInfo.pic" :key="musicInfo.pic" :class="$style.coverImg" :src="musicInfo.pic" decoding="async" @error="imgError">
        <div v-else :class="$style.emptyPic">L<span>X</span></div>
      </div>
      <div :class="$style.infoContent">
        <div :class="$style.title" :aria-label="musicTitle + $t('copy_tip')" @click="handleCopy(musicTitle)">
          {{ musicTitle || $t('player__no_music') }}
        </div>
        <div :class="$style.singer">{{ musicSinger || '\u00a0' }}</div>
        <!-- Luminous Harmonic: 状态行仅出错时显示 — 部分音源会把歌词文本写进 statusText,
             三行堆叠会撑破 32px 主行把封面区顶出胶囊 (用户反馈的"偏上") -->
        <div v-if="isPlayerError && statusText" :class="$style.status">
          <span>{{ statusText }}</span>
          <button type="button" :class="$style.retryBtn" :aria-label="$t('player__retry')" @click.stop="retryPlayback">
            {{ $t('player__retry') }}
          </button>
        </div>
      </div>
      <button :class="$style.likeBtn" :aria-label="$t('player__add_music_to')" @click="addMusicTo">
        <svg viewBox="0 0 512 512" aria-hidden="true">
          <use xlink:href="#icon-love" />
        </svg>
      </button>
    </div>

    <div :class="$style.lyricSlot" :title="lyric.text">
      {{ lyric.text || '\u00a0' }}
    </div>

    <div :class="$style.playControls" :style="detailAccentStyle">
      <!-- Luminous Harmonic: 播放控制三连改用共享 PlayControls -->
      <PlayControls />
    </div>

    <div v-if="playMusicInfo.musicInfo && appSetting['common.playBarVisualization'] !== false" :class="$style.audioVisualizer">
      <ProgressVisualizer
        :class="[$style.visualizer, { [$style.visualizerPaused]: !isPlay }]"
        :visualizer-height="34"
        variant="middle"
      />
    </div>

    <div :class="$style.progressRow" :style="detailAccentStyle">
      <span :class="$style.timeLabel">{{ nowPlayTimeStr }}</span>
      <common-progress-bar
        :class-name="$style.progress"
        :progress="progress"
        :handle-transition-end="handleTransitionEnd"
        :is-active-transition="isActiveTransition"
        :wave="appSetting['common.playBarWave'] !== false"
      />
      <span :class="$style.timeLabel">{{ maxPlayTimeStr }}</span>
    </div>

    <control-btns :class="$style.rightSection" :show-add="false" />
    <common-list-add-modal v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo" />
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { clipboardWriteText } from '@common/utils/electron'
import { appSetting } from '@renderer/store/setting'
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
  isPlay,
  playInfo,
  playMusicInfo,
  coverAccent,
  isShowPlayerDetail,
} from '@renderer/store/player/state'
import { setMusicInfo, setShowPlayerDetail } from '@renderer/store/player/action'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'
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
    const isShowAddMusicTo = ref(false)

    // Luminous Harmonic: 详情页打开时计算 accent 颜色 (封面/主题色), 关闭时 null 让 CSS fallback 主题色
    const detailAccentStyle = computed(() => {
      if (!isShowPlayerDetail.value) return null
      const mode = appSetting['playDetail.backgroundMode']
      const color = mode == 'theme' ? 'var(--color-primary)' : `rgb(${coverAccent.value})`
      return { '--detail-accent-color': color }
    })

    const showPlayerDetail = () => {
      if (playMusicInfo.musicInfo) setShowPlayerDetail(true)
    }
    const addMusicTo = () => {
      if (musicInfo.id) isShowAddMusicTo.value = true
    }
    const retryPlayback = () => {
      window.app_event?.playerRetry?.()
    }
    const handleCopy = (text) => {
      if (text) clipboardWriteText(text)
    }
    const imgError = () => {
      setMusicInfo({ pic: null })
    }
    const handleToMusicLocation = () => {
      const listId = playMusicInfo.listId
      if (!listId || listId == LIST_IDS.DOWNLOAD || !playMusicInfo.musicInfo || playInfo.playIndex == -1) return
      void router.push({
        path: '/list',
        query: { id: listId, scrollIndex: playInfo.playIndex },
      })
    }

    return {
      appSetting,
      musicInfo,
      playMusicInfo,
      statusText,
      isPlayerError,
      retryPlayback,
      lyric,
      isPlay,
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      isActiveTransition,
      handleTransitionEnd,
      musicTitle: computed(() => musicInfo.name || ''),
      musicSinger: computed(() => musicInfo.singer || ''),
      isShowAddMusicTo,
      detailAccentStyle,
      showPlayerDetail,
      addMusicTo,
      handleCopy,
      imgError,
      handleToMusicLocation,
      togglePlay,
      playNext,
      playPrev,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.player {
  position: relative;
  // Keep the capsule inside the full-width player host so both rounded edges
  // remain visible even when the window has a vertical scrollbar.
  width: calc(100% - 40px);
  max-width: calc(100% - 40px);
  // Luminous Harmonic: 高度撑满 #player.player-tall 可用区 (容器 7rem, 减去上下 margin 14px)
  margin: 6px 20px 8px;
  padding: 4px 18px;
  box-sizing: border-box;
  // Luminous Harmonic: 双行网格 — row1: 封面/歌词/控制/频谱/功能键; row2: 进度条整行 (用户指定布局)。
  // #player.player-tall 提供了更高的容器, 胶囊撑满其可用高度
  display: grid;
  grid-template-columns: minmax(250px, 1.15fr) minmax(180px, 1fr) 190px minmax(160px, .9fr) max-content;
  // Luminous Harmonic: 固定 70px (与全宽 72/迷你 76 一致的视觉高度):
  // padding 10 + 主行 32 + 间距 4 + 进度条 24 = 70, 全部元素完整显示
  height: 70px;
  grid-template-rows: 34px auto;
  gap: 4px 16px;
  align-items: center;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid var(--glass-stroke, var(--color-primary-alpha-800));
  border-radius: 18px;
  color: var(--color-font);
  -webkit-app-region: no-drag;

  &::before {
    .mixin-after();
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background-color: color-mix(in srgb, var(--glass-surface-strong, var(--color-content-background)) calc(var(--glass-alpha, .8) * 100%), transparent);
    -webkit-backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.25);
    backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.25);
    box-shadow: var(--glass-shadow, 0 8px 24px var(--color-primary-alpha-900));
    transition: background-color .45s ease, border-color .45s ease, box-shadow .45s ease;
  }

  * { box-sizing: border-box; }
}

.leftSection,
.lyricSlot,
.playControls,
.audioVisualizer,
.rightSection,
.progressRow {
  position: relative;
  z-index: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.leftSection {
  grid-column: 1;
  grid-row: 1 / 3;
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.picContent {
  flex: none;
  width: 34px;
  height: 34px;
  overflow: hidden;
  border-radius: 9px;
  cursor: pointer;
  background: var(--color-primary-light-900-alpha-200);
  transition: transform @transition-fast, box-shadow @transition-fast, opacity @transition-fast;

  // Luminous Harmonic: 换歌封面过渡 — 淡入 + 上移 + 缩放
  .coverImg {
    animation: pb-cover-enter 500ms cubic-bezier(.2, .7, .3, 1) both;
  }

  &:hover {
    opacity: .9;
    transform: translateY(-1px);
    box-shadow: 0 0 0 1px var(--color-primary-alpha-600), 0 5px 14px var(--color-primary-alpha-800);
  }

  img { width: 100%; height: 100%; object-fit: cover; }
}

.emptyPic {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: var(--color-primary-light-400-alpha-200);
  font: 700 20px Consolas, "Courier New", monospace;

  span { padding-left: 3px; }
}

.infoContent {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 3px;
  // Luminous Harmonic: 钳制在主行预算内 (32px = 歌名+歌手两行) — 任何第三行 (如音源写入的
  // statusText) 都不会把信息块撑出胶囊
  max-height: 34px;
  overflow: hidden;
}

.title,
.singer {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  color: var(--color-font);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: color .4s ease;

  &:hover { color: var(--color-primary); }
}

.singer {
  color: var(--color-font-label);
  font-size: 11px;
  opacity: .76;
}

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  color: var(--color-font-label);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.retryBtn {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--color-primary-alpha-500);
  border-radius: 999px;
  background: var(--color-primary-alpha-100);
  color: var(--color-primary);
  font: inherit;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
  &:hover { background: var(--color-primary-alpha-200); }
}

.likeBtn {
  flex: none;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-font-label);
  cursor: pointer;
  transition: color @transition-fast, transform @transition-fast, opacity @transition-fast;

  svg { width: 16px; height: 16px; fill: currentColor; }
  &:hover { color: var(--color-primary); transform: scale(1.08); }
  &:active { transform: scale(.94); }
}

.lyricSlot {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  min-width: 0;
  padding: 0 14px;
  overflow: hidden;
  color: var(--color-font-label);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: .82;
  pointer-events: none;
  transition: color .45s ease, opacity .3s ease;
}

.playControls {
  grid-column: 3;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.controlBtn {
  display: flex;
  flex: none;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  // Luminous Harmonic: 详情页打开时跟随 accent (封面/主题色), 关闭时回退主色
  color: var(--detail-accent-color, var(--color-primary));
  cursor: pointer;
  transition: color @transition-fast, transform @transition-fast, opacity @transition-fast, box-shadow .4s ease;

  svg { width: 15px; height: 15px; fill: currentColor; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .35)); }
  &:hover { color: var(--detail-accent-color, var(--color-primary)); transform: scale(1.08); }
  &:active { transform: scale(.94); }
}

.togglePlayBtn {
  // Luminous Harmonic: 三模式主按钮统一 32px
  width: 32px;
  height: 32px;
  margin: 0 2px;
  color: var(--color-on-primary, var(--color-primary-font));
  // Luminous Harmonic: 详情页打开时跟随 accent, 关闭回退主题色
  background: var(--detail-accent-color, var(--color-primary));
  box-shadow: 0 4px 14px var(--detail-accent-color, var(--color-primary-alpha-700));

  &:hover {
    color: var(--color-on-primary, var(--color-primary-font));
    transform: scale(1.06);
    box-shadow: 0 5px 18px var(--color-primary-alpha-600);
  }
}

// Luminous Harmonic: 播放/暂停图标形变（240ms cubic-bezier(0.2,0,0,1) 交叉过渡）
.iconMorph {
  position: relative;
  display: block;
  width: 16px;
  height: 16px;
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: currentColor;
    transition: opacity .24s cubic-bezier(.2, 0, 0, 1), transform .24s cubic-bezier(.2, 0, 0, 1);
  }
  :global(.icon-pause) { opacity: 0; transform: scale(.5) rotate(-24deg); }
  :global(.icon-play) { opacity: 1; transform: scale(1) rotate(0); }
}
.iconMorphActive {
  :global(.icon-pause) { opacity: 1; transform: scale(1) rotate(0); }
  :global(.icon-play) { opacity: 0; transform: scale(.5) rotate(24deg); }
}

.audioVisualizer {
  grid-column: 4;
  grid-row: 1;
  position: relative;
  width: clamp(180px, 18vw, 270px);
  height: 34px;
  justify-self: center;
  overflow: hidden;
  opacity: .68;
}

.visualizer {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  opacity: .78;
  pointer-events: none;
  transition: opacity 280ms ease;
}

.visualizerPaused { opacity: 0; }

.progressRow {
  // Luminous Harmonic: 双行布局 — 进度条在第二行, 从歌词列起到行尾 (用户画框位置;
  // 不占封面列, 否则跨两行的封面区会被挤到隐含列)
  grid-column: 2 / 5;
  grid-row: 2;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.progress {
  width: 100%;
  height: 16px;
}

.timeLabel {
  // Luminous Harmonic: 详情页打开时跟随 accent, 关闭回退主色
  color: var(--detail-accent-color, var(--color-primary));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, .45));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  height: 24px;
  white-space: nowrap;
}

.rightSection {
  grid-column: 5;
  grid-row: 1 / 3;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  opacity: .78;
  transition: opacity .35s ease;

  &:hover { opacity: 1; }
}

@media (max-width: 1000px) {
  .player { grid-template-columns: minmax(220px, 1.1fr) minmax(150px, 1fr) minmax(150px, .9fr) minmax(190px, 1.1fr) max-content; gap: 4px 10px; padding-left: 12px; padding-right: 12px; }
  .leftSection { gap: 8px; }
  .picContent { width: 34px; height: 34px; }
}

@media (max-width: 820px) {
  .player { width: calc(100% - 20px); max-width: calc(100% - 20px); margin-left: 10px; margin-right: 10px; grid-template-columns: 50px minmax(150px, 1fr) minmax(150px, .9fr) max-content; }
  .leftSection { grid-column: 1; }
  .infoContent, .likeBtn { display: none; }
  .picContent { width: 34px; height: 34px; }
  .lyricSlot { display: none; }
  .playControls { grid-column: 2; }
  .audioVisualizer { display: none; }
  .rightSection { grid-column: 3; }
  .progressRow { grid-column: 1 / -1; grid-row: 2; }
}

@media (max-width: 620px) {
  .player { grid-template-columns: 44px minmax(150px, 1fr) max-content; gap: 4px 8px; padding-left: 8px; padding-right: 8px; }
  .picContent { width: 34px; height: 34px; }
  .playControls { grid-column: 2; }
  .rightSection { grid-column: 3; }
  .progressRow { grid-column: 1 / -1; grid-row: 2; }
}

@media (prefers-reduced-motion: reduce) {
  .player::before,
  .visualizer,
  .controlBtn,
  .likeBtn { transition: none; }
}
// Luminous Harmonic: 换歌封面过渡 keyframes
@keyframes pb-cover-enter {
  from { opacity: 0; transform: translateY(8%) scale(.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
