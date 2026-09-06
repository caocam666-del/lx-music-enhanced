<template lang="pug">
div(:class="$style.footerLeftControlBtns")
  button(:class="[$style.footerLeftControlBtn, $style.lrcBtn]" :aria-label="toggleDesktopLyricBtnTitle" @click="toggleDesktopLyric" @contextmenu="toggleLockDesktopLyric")
    svg(v-show="appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="125%" viewBox="0 0 512 512" space="preserve")
      use(xlink:href="#icon-desktop-lyric-on")
    svg(v-show="!appSetting['desktopLyric.enable']" version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="125%" viewBox="0 0 512 512" space="preserve")
      use(xlink:href="#icon-desktop-lyric-off")
  button(:class="[$style.footerLeftControlBtn, { [$style.active]: appSetting['player.audioVisualization'] }]" :aria-label="$t('audio_visualization')" @click="toggleAudioVisualization")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="95%" viewBox="0 0 24 24" space="preserve")
      use(xlink:href="#icon-audio-wave")
  // Luminous Harmonic: 歌词/播放列表 视图切换 — 纯图标三线设计:
  // 歌词 = 上下短中间长三条线; 播放列表 = 上中下等长三条线 (图标指向点击后将切换到的视图)
  button(:class="[$style.footerLeftControlBtn, { [$style.active]: detailView === 'playlist' }]" :aria-label="detailView === 'playlist' ? $t('player__detail_view_lyric') : $t('player__detail_view_playlist')" :title="detailView === 'playlist' ? $t('player__detail_view_lyric') : $t('player__detail_view_playlist')" @click="toggleDetailView")
    svg(v-if="detailView !== 'playlist'" version="1.1" xmlns="http://www.w3.org/2000/svg" width="95%" viewBox="0 0 24 24" space="preserve")
      g(fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round")
        line(x1="8" y1="6" x2="16" y2="6")
        line(x1="4" y1="12" x2="20" y2="12")
        line(x1="8" y1="18" x2="16" y2="18")
    svg(v-else version="1.1" xmlns="http://www.w3.org/2000/svg" width="95%" viewBox="0 0 24 24" space="preserve")
      g(fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round")
        line(x1="4" y1="6" x2="20" y2="6")
        line(x1="4" y1="12" x2="20" y2="12")
        line(x1="4" y1="18" x2="20" y2="18")
  button(:class="[$style.footerLeftControlBtn, {[$style.active]: isShowPlayComment}]" :aria-label="$t('comment__show')" @click="toggleVisibleComment")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" width="95%" viewBox="0 0 24 24" space="preserve")
      use(xlink:href="#icon-comment")
  common-sound-effect-btn
  common-playback-rate-btn
  common-volume-btn
  common-toggle-play-mode-btn
  button(:class="$style.footerLeftControlBtn" :aria-label="$t('player__add_music_to')" @click="isShowAddMusicTo = true")
    svg(version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" space="preserve")
      use(xlink:href="#icon-add-2")
  common-list-add-modal(v-model:show="isShowAddMusicTo" :music-info="playMusicInfo.musicInfo")

</template>

<script>
import { ref } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'

import {
  isShowPlayComment,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayComment,
} from '@renderer/store/player/action'

import { detailView, toggleDetailView } from '../detailViewState'
import useNextTogglePlay from '@renderer/utils/compositions/useNextTogglePlay'
import useToggleDesktopLyric from '@renderer/utils/compositions/useToggleDesktopLyric'
import { dialog } from '@renderer/plugins/Dialog'
import { setMediaDeviceId } from '@renderer/plugins/player'
import { appSetting, saveMediaDeviceId, setEnableAudioVisualization } from '@renderer/store/setting'

export default {
  setup() {
    const t = useI18n()

    const toggleVisibleComment = () => {
      setShowPlayComment(!isShowPlayComment.value)
    }
    const {
      nextTogglePlayName,
      toggleNextPlayMode,
    } = useNextTogglePlay()

    const {
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
    } = useToggleDesktopLyric()

    const isShowAddMusicTo = ref(false)

    const toggleAudioVisualization = async() => {
      const newSetting = !appSetting['player.audioVisualization']
      if (newSetting && appSetting['player.mediaDeviceId'] != 'default') {
        const confirm = await dialog.confirm({
          message: t('setting__player_audio_visualization_tip'),
          cancelButtonText: t('cancel_button_text'),
          confirmButtonText: t('confirm_button_text'),
        })
        if (!confirm) return
        await setMediaDeviceId('default').catch(_ => _)
        saveMediaDeviceId('default')
      }
      setEnableAudioVisualization(newSetting)
    }

    return {
      appSetting,
      detailView,
      toggleDetailView,
      isShowPlayComment,
      toggleVisibleComment,
      nextTogglePlayName,
      toggleNextPlayMode,
      toggleDesktopLyricBtnTitle,
      toggleDesktopLyric,
      toggleLockDesktopLyric,
      toggleAudioVisualization,
      isShowAddMusicTo,
      playMusicInfo,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.footerLeftControlBtns {
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;

  button {
    width: 20px;
    height: 20px;
    // 借鉴 Pure-music Monet: 功能键图标随封面强调色变化（亮化版），深阴影保证清晰
    color: var(--detail-accent-bright, var(--color-font));
    text-shadow: var(--detail-font-shadow, 0 1px 3px rgb(0 0 0 / .7));
  }

  // Luminous Harmonic: 视图切换按钮激活态 — 主题色描边+浅底 (与其他按钮的 active 风格一致)
  .viewToggleActive {
    color: var(--color-primary) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-primary) 40%, transparent);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  .footerLeftControlBtn {
    position: relative;
    opacity: .85;
    cursor: pointer;
    transition: opacity @transition-normal;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    border: none;
    padding: 0;

    // Luminous Harmonic: 用透明伪元素把命中区外扩 5px（视觉布局不变，符合 44px 可点击标准的折中）
    &::before {
      content: '';
      position: absolute;
      inset: -5px;
    }

    &:hover {
      opacity: 1;
    }

    &.active {
      // 激活态用强调色（亮化版）突出
      color: color-mix(in srgb, var(--detail-accent-bright, var(--detail-accent-color, var(--color-primary))) 88%, white);
      opacity: 1;
    }
  }

  .lrcBtn {
    width: 20px;
  }
}

</style>
