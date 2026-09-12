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
  // Luminous Harmonic: 流光背景动效 — 动态流光 (缓慢漂移) / 节奏律动 (跟随音乐节奏呼吸, Pure-music AudioReactiveFlow)
  .gap-top
    h3#play_detail_flow {{ $t('setting__play_detail_flow') }}
    base-checkbox.gap-left(id="setting_play_detail_flow_dynamic" name="setting_play_detail_flow" :model-value="appSetting['playDetail.flowMode']" need value="dynamic" :label="$t('setting__play_detail_flow_dynamic')" @update:model-value="updateSetting({'playDetail.flowMode': $event})")
    base-checkbox.gap-left(id="setting_play_detail_flow_rhythm" name="setting_play_detail_flow" :model-value="appSetting['playDetail.flowMode']" need value="rhythm" :label="$t('setting__play_detail_flow_rhythm')" @update:model-value="updateSetting({'playDetail.flowMode': $event})")
  // Luminous Harmonic: 功能组件颜色 — 歌词高亮/进度条/播放控制/功能按钮的强调色来源:
  // 封面取色 或 主题色板; 所选颜色自动做对比度调整 (与背景亮度差 ≥ 0.28), 保证任何封面下清晰
  .gap-top
    h3#play_detail_ui_accent {{ $t('setting__play_detail_ui_accent') }}
    div(:class="$style.accentRow")
      button(
        v-for="c in accentSwatches" :key="c.value" type="button"
        :class="[$style.accentSwatch, { [$style.accentActive]: (appSetting['playDetail.uiAccent'] || 'cover') == c.value }]"
        :style="c.value == 'cover' ? null : { background: c.value }"
        :title="c.label" :aria-label="c.label"
        @click="updateSetting({'playDetail.uiAccent': c.value})"
      )
        span(v-if="c.value == 'cover'" :class="$style.coverIcon") {{ $t('setting__play_detail_ui_accent_cover_short') }}

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

// Luminous Harmonic: 主题色板 — 与内置主题 primary 一致 (createThemes.js)
const ACCENT_SWATCHES = [
  { value: 'rgb(0, 74, 198)', label: '流光浅界' },
  { value: 'rgb(173, 198, 255)', label: '流光夜阑' },
  { value: 'rgb(77, 175, 124)', label: '绿意盎然' },
  { value: 'rgb(52, 152, 219)', label: '蓝田生玉' },
  { value: 'rgb(77, 131, 175)', label: '蛋雅深蓝' },
  { value: 'rgb(245, 171, 53)', label: '橙黄橘绿' },
  { value: 'rgb(214, 69, 65)', label: '热情似火' },
  { value: 'rgb(241, 130, 141)', label: '粉装玉琢' },
  { value: 'rgb(155, 89, 182)', label: '重斤球紫' },
  { value: 'rgb(108, 122, 137)', label: '灰常美丽' },
]

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
      accentSwatches: [
        { value: 'cover', label: window.i18n.t('setting__play_detail_ui_accent_cover') },
        ...ACCENT_SWATCHES,
      ],
    }
  },
}
</script>

<style lang="less" module>
// Luminous Harmonic: 功能组件颜色色板 — 圆形色块 + 选中描边; 首项为封面取色 (渐变球)
.accentRow {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.accentSwatch {
  position: relative;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 2px solid color-mix(in srgb, var(--color-font) 18%, transparent);
  border-radius: 50%;
  background: #888;
  cursor: pointer;
  outline: none;
  transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;

  &:hover { transform: scale(1.12); }

  &.accentActive {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 40%, transparent);

    &::after {
      content: '';
      position: absolute;
      right: -2px;
      bottom: -2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--color-primary);
      border: 2px solid var(--color-content-background);
    }
  }
}
.coverIcon {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: conic-gradient(from 210deg, #f5ab35, #d64541, #9b59b6, #3498db, #4daf7c, #f5ab35);
}
</style>
