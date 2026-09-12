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
      // Luminous Harmonic: 调色盘 — 自定义任意颜色 (原生 color input)
      label(
        :class="[$style.accentSwatch, $style.customSwatch, { [$style.accentActive]: isCustomAccent }]"
        :title="$t('setting__play_detail_ui_accent_custom')" :aria-label="$t('setting__play_detail_ui_accent_custom')"
      )
        input(type="color" :class="$style.colorInput" value="#7cc7e8" @input="handleCustomAccent" @change="handleCustomAccent")
        svg(v-if="isCustomAccent" :class="$style.customCheck" viewBox="0 0 24 24" aria-hidden="true")
          path(fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M4 12l5 5L20 6")

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
import { computed } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { setLyricMode } from '@renderer/core/lyric'

// Luminous Harmonic: 主题色板 — 与内置主题 primary 一致 (createThemes.js)
// Luminous Harmonic: 主题色板 — 取各内置主题 primary 的色相, 统一混白 45% 成淡色系
// (用户要求: 亮、清晰、干净; 原始 primary 过重过浓)
const ACCENT_SWATCHES = [
  { value: 'rgb(115, 155, 224)', label: '流光浅界' },
  { value: 'rgb(210, 224, 255)', label: '流光夜阑' },
  { value: 'rgb(157, 211, 183)', label: '绿意盎然' },
  { value: 'rgb(143, 198, 235)', label: '蓝田生玉' },
  { value: 'rgb(157, 187, 211)', label: '蛋雅深蓝' },
  { value: 'rgb(250, 209, 144)', label: '橙黄橘绿' },
  { value: 'rgb(232, 153, 151)', label: '热情似火' },
  { value: 'rgb(247, 186, 192)', label: '粉装玉琢' },
  { value: 'rgb(200, 164, 215)', label: '重斤球紫' },
  { value: 'rgb(174, 182, 190)', label: '灰常美丽' },
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
      // Luminous Harmonic: 自定义调色盘 — uiAccent 为具体颜色且不在预设中时视为自定义
      isCustomAccent: computed(() => {
        const v = appSetting['playDetail.uiAccent'] || 'cover'
        return v !== 'cover' && !ACCENT_SWATCHES.some(c => c.value == v)
      }),
      // Luminous Harmonic: 调色盘 → hex 转 rgb 存储 (对比度在详情页 writeAccentToRoot 统一调整)
      handleCustomAccent: (e) => {
        const hex = e.target.value
        const r = parseInt(hex.slice(1, 3), 16)
        const g = parseInt(hex.slice(3, 5), 16)
        const b = parseInt(hex.slice(5, 7), 16)
        updateSetting({ 'playDetail.uiAccent': `rgb(${r}, ${g}, ${b})` })
      },
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

.accentSwatch.customSwatch {
  overflow: hidden;
}
.colorInput {
  position: absolute;
  inset: -6px;
  width: calc(100% + 12px);
  height: calc(100% + 12px);
  border: none;
  padding: 0;
  cursor: pointer;
  background: none;
}
.customCheck {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--color-primary);
  border: 2px solid var(--color-content-background);
  pointer-events: none;
}
</style>
