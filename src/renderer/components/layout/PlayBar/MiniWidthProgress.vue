<template>
  <div :class="$style.playerShell">
    <div :class="$style.player">
    <!-- Luminous Harmonic: DJ 音频律动可视化背景 -->
    <div :class="$style.picContent" :aria-label="$t('player__pic_tip')" @contextmenu="handleToMusicLocation" @click="showPlayerDetail">
      <img v-if="musicInfo.pic" :key="musicInfo.pic" :class="$style.coverImg" :src="musicInfo.pic" decoding="async" @error="imgError">
      <div v-else :class="$style.emptyPic">L<span>X</span></div>
    </div>
    <div :class="$style.infoContent">
      <div :class="$style.title" :aria-label="title + $t('copy_tip')" @click="handleCopy(title)">
        {{ title }}
      </div>
      <div :class="$style.status">
        <span>{{ statusText }}</span>
        <button v-if="isPlayerError" type="button" :class="$style.retryBtn" :aria-label="$t('player__retry')" @click.stop="retryPlayback">
          {{ $t('player__retry') }}
        </button>
      </div>
    </div>
    <div :class="$style.timeContent">
      <MiniCapsuleProgress
        :progress="progress"
        :current-time="nowPlayTime"
        :max-time="maxPlayTime"
        :current-time-label="nowPlayTimeStr"
        :max-time-label="maxPlayTimeStr"
        :is-playing="isPlay"
        :has-music="Boolean(playMusicInfo.musicInfo)"
        @seek="handleSeek"
      />
    </div>
    <control-btns :class="$style.toolBtns" />
    <div :class="$style.playBtnContent">
      <!-- Luminous Harmonic: 播放控制三连改用共享 PlayControls -->
      <PlayControls />
    </div>
    </div>
  </div>
</template>

<script>
import { computed, toRef } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { clipboardWriteText } from '@common/utils/electron'
import ControlBtns from './ControlBtns.vue'
import MiniCapsuleProgress from './MiniCapsuleProgress.vue'
import PlayControls from './PlayControls.vue'
import usePlayProgress from '@renderer/utils/compositions/usePlayProgress'
import { playProgress } from '@renderer/store/player/playProgress'
// import { lyric } from '@renderer/core/share/lyric'
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
import { appSetting } from '@renderer/store/setting'
import { togglePlay, playNext, playPrev } from '@renderer/core/player'
import { LIST_IDS } from '@common/constants'
import { formatMusicName } from '@renderer/utils'

export default {
  name: 'CorePlayBar',
  components: {
    ControlBtns,
    PlayControls,
    MiniCapsuleProgress,
  },
  setup() {
    const router = useRouter()

    const {
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
    } = usePlayProgress()
    const nowPlayTime = toRef(playProgress, 'nowPlayTime')

    // Luminous Harmonic: 波形进度条需要的原始时间 (秒)
    const maxPlayTime = toRef(playProgress, 'maxPlayTime')
    const handleSeek = (time) => {
      if (window.app_event?.setProgress) {
        window.app_event.setProgress(time)
      }
    }
    const retryPlayback = () => {
      window.app_event?.playerRetry?.()
    }

    const showPlayerDetail = () => {
      if (!playMusicInfo.musicInfo) return
      setShowPlayerDetail(true)
    }
    const handleCopy = (text) => {
      clipboardWriteText(text)
    }

    const imgError = () => {
      // console.log(e)
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

    const title = computed(() => {
      return musicInfo.name
        ? formatMusicName(appSetting['download.fileName'], musicInfo.name, musicInfo.singer)
        : ''
    })

    // onBeforeUnmount(() => {
    // window.eventHub.emit(eventPlayerNames.setTogglePlay)
    // })

    return {
      musicInfo,
      playMusicInfo,
      nowPlayTime,
      nowPlayTimeStr,
      maxPlayTimeStr,
      progress,
      maxPlayTime,
      handleSeek,
      handleCopy,
      imgError,
      statusText,
      isPlayerError,
      retryPlayback,
      title,
      showPlayerDetail,
      isPlay,
      togglePlay,
      playNext,
      playPrev,
      handleToMusicLocation,
      isShowPlayerDetail,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.player {
  position: relative;
  width: 100%;
  height: 76px;
  margin: 0;
  border: 1px solid var(--glass-stroke-strong, rgba(255, 255, 255, 0.2));
  border-radius: 999px;
  box-sizing: border-box;
  isolation: isolate;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 0;
  padding: 6px 14px 18px;
  background-color: color-mix(in srgb, var(--glass-surface-strong, var(--color-main-background)) calc(var(--glass-alpha, 0.8) * 100%), transparent);
  backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.4);
  -webkit-backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.4);
  box-shadow: 0 7px 22px rgba(30, 45, 90, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  background-clip: padding-box;
  overflow: hidden;
  z-index: 2;
  // box-shadow: 0px 0px 4px rgba(0, 0, 0, 0.1);
  * {
    box-sizing: border-box;
  }

  &:before {
    display: none;
    .mixin-after();
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    // Luminous Harmonic: 底部播放器强玻璃
    background-color: color-mix(in srgb, var(--glass-surface-strong, var(--color-main-background)) calc(var(--glass-alpha, 0.8) * 100%), transparent);
    backdrop-filter: blur(var(--glass-blur-strong, 20px)) saturate(1.4);
    border-top: 1px solid var(--glass-stroke, transparent);
    z-index: -1;
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    border: 1px solid color-mix(in srgb, var(--glass-stroke-strong, rgba(255, 255, 255, .2)) 82%, var(--color-primary) 18%);
    border-radius: inherit;
    pointer-events: none;
    z-index: 5;
  }
}

.playerShell {
  position: relative;
  flex: none;
  width: 100%;
  height: 84px;
  padding: 4px 10px;
  box-sizing: border-box;
  overflow: visible;
}

.picContent {
  width: 34px;
  height: 34px;
  aspect-ratio: 1 / 1;

  // Luminous Harmonic: 换歌封面过渡
  .coverImg {
    animation: pb-cover-enter 500ms cubic-bezier(.2, .7, .3, 1) both;
  }

  // color: var(--color-primary);
  // transition: @transition-normal;
  // transition-property: color;
  flex: none;
  opacity: 1;
  transition: opacity @transition-fast;
  // transition-property: opacity;
  display: flex;
  justify-content: center;
  // align-items: center;
  cursor: pointer;

  &:hover {
    opacity: .8;
  }

  // svg {
  //   fill: currentColor;
  // }
  img {
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.3);
    max-width: 100%;
    max-height: 100%;
    transition: @transition-normal;
    transition-property: border-color;
    // border-radius: 50%;
    border-radius: @radius-border;
    // border: 2px solid @color-theme_2-background_1;
  }

  .emptyPic {
    background-color: var(--color-primary-light-900-alpha-200);
    border-radius: @radius-border;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary-light-400-alpha-200);
    user-select: none;
    font-size: 20px;
    font-family: Consolas, "Courier New", monospace;

    span {
      padding-left: 3px;
    }
  }
}

.infoContent {
  padding: 0 10px;
  flex: 1 1 190px;
  width: auto;
  max-width: 230px;
  height: 34px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: flex-start;
  font-size: 12px;
  color: var(--color-font);
  min-width: 0;
  line-height: 1.5;
}

.title {
  max-width: 100%;
  font-size: 13px;
  font-weight: 500;
  height: 18px;
  line-height: 18px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.status {
  padding-top: 1px;
  height: 18px;
  line-height: 18px;
  font-size: 11px;
  color: var(--color-font-label);
  opacity: .78;
  .mixin-ellipsis-1();
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
}

.retryBtn {
  flex: none;
  padding: 0 6px;
  border: 1px solid var(--detail-accent-color, var(--color-primary-alpha-500));
  border-radius: 999px;
  background: var(--detail-accent-color, var(--color-primary-alpha-100));
  color: var(--detail-accent-color, var(--color-primary));
  font: inherit;
  font-size: 10px;
  line-height: 18px;
  cursor: pointer;
  &:hover { background: var(--color-primary-alpha-200); }
}

.timeContent {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 0;
  z-index: 2;
  height: 28px;
}

.toolBtns {
  flex: none;
  margin-left: auto;
  position: relative;
  z-index: 2;
}

// .timeContainer {
//   flex: none;
//   padding: 15px 0;
//   &:hover {
//     .progress {
//       opacity: 1;
//     }
//   }
// }
// .timeContent {
//   // width: 30%;
//   position: relative;
//   // flex: none;
//   color: var(--color-300);
//   font-size: 13px;
//   // padding-left: 10px;
//   // display: flex;
//   // flex-flow: column nowrap;
//   // align-items: center;
//   padding-bottom: 3px;
// }
// .progress {
//   position: absolute;
//   top: 100%;
//   left: 0;
//   width: 100%;
//   flex: auto;
//   // width: 160px;
//   // position: relative;
//   // padding-bottom: 6px;
//   // margin: 0 8px;
//   padding: 2px 0;
//   height: 8px;
//   transition: opacity @transition-normal;
//   opacity: .24;

//   .progressBar {
//     height: 2px;
//     border-radius: 0;
//   }
// }
// .time {
//   display: flex;
//   flex-flow: row nowrap;
//   justify-content: space-between;
// }

.playBtnContent {
  position: absolute;
  top: 43%;
  left: 50%;
  z-index: 2;
  height: 34px;
  transform: translate(-50%, -50%);
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  padding: 0 6px;
  gap: 8px;
}

.playBtn {
  flex: none;
  width: 19px;
  height: 19px;
  transition: @transition-fast;
  transition-property: color, opacity, transform;
  color: var(--color-font);
  opacity: 1;
  cursor: pointer;
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  outline: none;

  svg {
    fill: currentColor;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.2));
    width: 100%;
    height: 100%;
  }
  &:hover {
    opacity: 0.8;
    transform: scale(1.08);
  }
  &:active {
    opacity: 0.6;
    transform: scale(0.95);
  }
}

// Luminous Harmonic: 圆形主色播放/暂停按钮 (三模式主按钮统一 32px)
.togglePlayBtn {
  height: 32px;
  width: 32px;
  border-radius: 50%;
  // Luminous Harmonic: 详情页打开时跟随 accent, 关闭回退主题色
  background-color: var(--detail-accent-color, var(--color-primary));
  color: var(--color-on-primary, var(--color-primary-font, #fff));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px var(--color-primary-alpha-700, rgba(0, 0, 0, 0.25));
  transition: @transition-fast;
  transition-property: transform, box-shadow, background-color, opacity;
}

// Luminous Harmonic: 播放/暂停图标形变（240ms cubic-bezier(0.2,0,0,1) 交叉过渡）
.iconMorph {
  position: relative;
  display: block;
  width: 46%;
  height: 46%;
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: auto;
    fill: var(--color-on-primary, var(--color-primary-font, #fff)) !important;
    color: var(--color-on-primary, var(--color-primary-font, #fff)) !important;
    opacity: 1 !important;
    transition: opacity .24s cubic-bezier(.2, 0, 0, 1), transform .24s cubic-bezier(.2, 0, 0, 1);
  }
  :global(.icon-pause) { opacity: 0 !important; transform: scale(.5) rotate(-24deg); }
  :global(.icon-play) { opacity: 1 !important; transform: scale(1) rotate(0); }
}
.iconMorphActive {
  :global(.icon-pause) { opacity: 1 !important; transform: scale(1) rotate(0); }
  :global(.icon-play) { opacity: 0 !important; transform: scale(.5) rotate(24deg); }
}

.togglePlayBtn:hover {
  opacity: 1;
  transform: scale(1.06);
  box-shadow: 0 6px 20px var(--color-primary-alpha-600, rgba(0, 0, 0, 0.35));
}
.togglePlayBtn:active {
  opacity: 1;
  transform: scale(0.96);
}

// Luminous Harmonic: 换歌封面过渡 keyframes
@keyframes pb-cover-enter {
  from { opacity: 0; transform: translateY(8%) scale(.92); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

// Luminous Harmonic: DJ 律动可视化背景层
</style>
