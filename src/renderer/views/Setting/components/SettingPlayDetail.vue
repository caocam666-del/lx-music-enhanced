<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_blur" :model-value="appSetting['playDetail.isLyricBlur']" :label="$t('setting__play_detail_lyric_blur')" @update:model-value="updateSetting({'playDetail.isLyricBlur': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_artwork_center" :model-value="appSetting['playDetail.isShowArtworkCenter']" :label="$t('setting__play_detail_artwork_center')" @update:model-value="updateSetting({'playDetail.isShowArtworkCenter': $event})")
  .gap-top
    h3#play_detail_background {{ $t('setting__play_detail_background') }}
    base-checkbox.gap-left(id="setting_play_detail_background_cover" name="setting_play_detail_background" :model-value="appSetting['playDetail.backgroundMode']" need value="cover" :label="$t('setting__play_detail_background_cover')" @update:model-value="setBackgroundMode")
    base-checkbox.gap-left(id="setting_play_detail_background_theme" name="setting_play_detail_background" :model-value="appSetting['playDetail.backgroundMode']" need value="theme" :label="$t('setting__play_detail_background_theme')" @update:model-value="setBackgroundMode")

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

dd
  // Luminous Harmonic: 歌词高亮模式 — 逐字/逐行 二选一（显式互斥，切换立即生效）
  h3#play_detail_lrc_mode {{ $t('setting__play_detail_lrc_mode') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_lrc_font" :model-value="appSetting['playDetail.style.lrcFontMode'] === true" :label="$t('setting__play_detail_lrc_font')" @update:model-value="setLrcFontMode(true)")
    base-checkbox.gap-left(id="setting_play_detail_lrc_line" :model-value="appSetting['playDetail.style.lrcFontMode'] === false" :label="$t('setting__play_detail_lrc_line')" @update:model-value="setLrcFontMode(false)")

</template>

<script>
import { appSetting, updateSetting } from '@renderer/store/setting'
import { setLyricMode } from '@renderer/core/lyric'

export default {
  name: 'SettingPlayDetail',
  setup() {
    const setBackgroundMode = mode => {
      appSetting['playDetail.backgroundMode'] = mode
      updateSetting({ 'playDetail.backgroundMode': mode })
    }
    const setLrcFontMode = value => {
      const boolValue = value === true
      updateSetting({ 'playDetail.style.lrcFontMode': boolValue })
      // 立即重建歌词引擎，让逐字/逐行切换立即生效
      setLyricMode(boolValue)
    }
    return {
      appSetting,
      updateSetting,
      setBackgroundMode,
      setLrcFontMode,
    }
  },
}
</script>
