<template lang="pug">
dt#desktop_lyric {{ $t('setting__desktop_lyric') }}
dd
  .gap-top
    base-checkbox(id="setting_desktop_lyric_enable" :model-value="appSetting['desktopLyric.enable']" :label="$t('setting__desktop_lyric_enable')" @update:model-value="updateSetting({ 'desktopLyric.enable': $event })")
  .gap-top
    h3 歌词条模式
    div
      base-checkbox.gap-left(id="setting_desktop_lyric_mode_normal" :model-value="appSetting['desktopLyric.mode']" need value="normal" :label="'常规歌词窗'" @update:model-value="updateSetting({ 'desktopLyric.mode': $event })")
      base-checkbox.gap-left(id="setting_desktop_lyric_mode_bar" :model-value="appSetting['desktopLyric.mode']" need value="bar" :label="'歌词条（左下角胶囊，含封面）'" @update:model-value="updateSetting({ 'desktopLyric.mode': $event })")
      base-checkbox.gap-left(id="setting_desktop_lyric_mode_island" :model-value="appSetting['desktopLyric.mode']" need value="island" :label="'灵动岛（固定在屏幕顶部中央，悬停/点击展开）'" @update:model-value="updateSetting({ 'desktopLyric.mode': $event })")
  //- Luminous Harmonic: 灵动岛专项设置
  template(v-if="appSetting['desktopLyric.mode'] == 'island'")
    .gap-top
      h3 灵动岛流光背景
      div
        base-checkbox.gap-left(id="setting_island_flow_dynamic" :model-value="appSetting['desktopLyric.island.flowMode']" need value="dynamic" :label="'动态流光（渐变光斑缓慢漂移）'" @update:model-value="updateSetting({ 'desktopLyric.island.flowMode': $event })")
        base-checkbox.gap-left(id="setting_island_flow_rhythm" :model-value="appSetting['desktopLyric.island.flowMode']" need value="rhythm" :label="'节奏律动（拾音器：随鼓点呼吸）'" @update:model-value="updateSetting({ 'desktopLyric.island.flowMode': $event })")
        base-checkbox.gap-left(id="setting_island_flow_none" :model-value="appSetting['desktopLyric.island.flowMode']" need value="none" :label="'纯净（无动效，最省性能）'" @update:model-value="updateSetting({ 'desktopLyric.island.flowMode': $event })")
    .gap-top
      h3 灵动岛取色来源
      div
        base-checkbox.gap-left(id="setting_island_color_detail" :model-value="appSetting['desktopLyric.island.colorSource']" need value="detail" :label="'跟随播放详情页（封面取色，与详情页同色）'" @update:model-value="updateSetting({ 'desktopLyric.island.colorSource': $event })")
        base-checkbox.gap-left(id="setting_island_color_theme" :model-value="appSetting['desktopLyric.island.colorSource']" need value="theme" :label="'跟随主题色'" @update:model-value="updateSetting({ 'desktopLyric.island.colorSource': $event })")
    .gap-top
      label(:class="$style.rangeLabel")
        span 流光强度（100 = 与详情页完全一致）
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.flowStrength'] }}
      input(type="range" :value="appSetting['desktopLyric.island.flowStrength']" min="0" max="100" step="1" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.flowStrength': Number($event.target.value) })")
      .p(:class="$style.islandTip") 流光结构（封面纹理 + 三圆斑遮罩 + 旋转）与详情页完全一致；强度只影响整体亮度。调高更接近详情页，但文字对比度会下降。
    .gap-top
      label(:class="$style.rangeLabel")
        span 灵动岛不透明度（只影响背景，文字始终不透明）
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.opacity'] }}%
      input(type="range" :value="appSetting['desktopLyric.island.opacity']" min="15" max="100" step="1" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.opacity': Number($event.target.value) })")
      .p(:class="$style.islandTip") 调低会让桌面内容透出来、更容易和壁纸融合；但过低会削弱流光并影响文字可读性。
    .gap-top
      label(:class="$style.rangeLabel")
        span 歌词字号（鼠标在歌词上滚动可直接调整）
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.lyricFontSize'] }}px
      input(type="range" :value="appSetting['desktopLyric.island.lyricFontSize']" min="11" max="26" step="1" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.lyricFontSize': Number($event.target.value) })")
    .gap-top
      base-checkbox(id="setting_island_show_cover" :model-value="appSetting['desktopLyric.island.showCover']" :label="'收起态显示歌曲封面'" @update:model-value="updateSetting({ 'desktopLyric.island.showCover': $event })")
    .gap-top
      h3 展开态歌词对齐
      div
        base-checkbox.gap-left(id="setting_island_align_left" :model-value="appSetting['desktopLyric.island.lyricAlign']" need value="left" :label="'左对齐'" @update:model-value="updateSetting({ 'desktopLyric.island.lyricAlign': $event })")
        base-checkbox.gap-left(id="setting_island_align_center" :model-value="appSetting['desktopLyric.island.lyricAlign']" need value="center" :label="'居中对齐'" @update:model-value="updateSetting({ 'desktopLyric.island.lyricAlign': $event })")
        base-checkbox.gap-left(id="setting_island_align_right" :model-value="appSetting['desktopLyric.island.lyricAlign']" need value="right" :label="'右对齐'" @update:model-value="updateSetting({ 'desktopLyric.island.lyricAlign': $event })")
    .gap-top
      h3 灵动岛展开方式
      div
        base-checkbox.gap-left(id="setting_island_trigger_hover" :model-value="appSetting['desktopLyric.island.expandTrigger']" need value="hover" :label="'悬停展开（鼠标移入自动放大）'" @update:model-value="updateSetting({ 'desktopLyric.island.expandTrigger': $event })")
        base-checkbox.gap-left(id="setting_island_trigger_click" :model-value="appSetting['desktopLyric.island.expandTrigger']" need value="click" :label="'点击展开（不响应鼠标经过）'" @update:model-value="updateSetting({ 'desktopLyric.island.expandTrigger': $event })")
    .gap-top
      label(:class="$style.rangeLabel")
        span 悬停多久后展开
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.hoverDelay'] }}ms
      input(type="range" :value="appSetting['desktopLyric.island.hoverDelay']" min="0" max="600" step="20" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.hoverDelay': Number($event.target.value) })")
    .gap-top
      label(:class="$style.rangeLabel")
        span 移出多久后收起
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.leaveDelay'] }}ms
      input(type="range" :value="appSetting['desktopLyric.island.leaveDelay']" min="200" max="3000" step="100" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.leaveDelay': Number($event.target.value) })")
    .gap-top
      label(:class="$style.rangeLabel")
        span 展开态歌词行数
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.lyricLines'] }} 行
      input(type="range" :value="appSetting['desktopLyric.island.lyricLines']" min="1" max="5" step="2" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.lyricLines': Number($event.target.value) })")
    .gap-top
      label(:class="$style.rangeLabel")
        span 展开态宽度
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.expandWidth'] }}px
      input(type="range" :value="appSetting['desktopLyric.island.expandWidth']" min="360" max="720" step="10" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.expandWidth': Number($event.target.value) })")
    .gap-top
      label(:class="$style.rangeLabel")
        span 展开态高度
        span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.expandHeight'] }}px
      input(type="range" :value="appSetting['desktopLyric.island.expandHeight']" min="140" max="360" step="10" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.expandHeight': Number($event.target.value) })")
      .p(:class="[$style.islandTip, { [$style.islandTipWarn]: appSetting['desktopLyric.island.expandHeight'] < islandMinHeight }]")
        | 至少 {{ islandMinHeight }}px 才能完整显示 {{ appSetting['desktopLyric.island.lyricLines'] }} 行歌词（控制行 + 进度行固定占约 107px）。
        template(v-if="appSetting['desktopLyric.island.expandHeight'] < islandMinHeight")
          |  当前偏矮，最后一行会被裁掉。
    .gap-top
      button(type="button" :class="$style.islandResetBtn" @click="handleResetIslandPosition") 复位灵动岛位置
    .gap-top
      .p(:class="$style.islandTip") 进度条样式（波浪/直线）跟随「外观与主题 → 播放栏波浪进度条」设置。点击展开态歌词行可跳转到该行时间。
  .gap-top(v-if="appSetting['desktopLyric.mode'] == 'island'")
    h3 灵动岛停靠边
    div
      base-checkbox.gap-left(v-for="dock in islandDocks" :key="dock.id" :id="'setting_desktop_lyric_island_dock_' + dock.id" :model-value="appSetting['desktopLyric.island.dock']" need :value="dock.id" :label="dock.name" @update:model-value="updateSetting({ 'desktopLyric.island.dock': $event })")
  .gap-top(v-if="appSetting['desktopLyric.mode'] == 'island'")
    base-checkbox(id="setting_desktop_lyric_island_auto_width" :model-value="appSetting['desktopLyric.island.autoWidth'] !== false" label="胶囊宽度按内容自适应（歌词短时自动收窄）" @update:model-value="updateSetting({ 'desktopLyric.island.autoWidth': $event })")
  .gap-top(v-if="appSetting['desktopLyric.mode'] == 'island' && appSetting['desktopLyric.island.autoWidth'] === false")
    label(:class="$style.rangeLabel")
      span 收起态宽度（胶囊长度）
      span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.width'] }}px
    input(type="range" :value="appSetting['desktopLyric.island.width']" min="180" max="520" step="10" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.width': Number($event.target.value) })")
  .gap-top(v-if="appSetting['desktopLyric.mode'] == 'island'")
    label(:class="$style.rangeLabel")
      span 距屏幕边缘（0 = 完全贴边）
      span(:class="$style.rangeValue") {{ appSetting['desktopLyric.island.margin'] }}px
    input(type="range" :value="appSetting['desktopLyric.island.margin']" min="0" max="40" step="1" :class="$style.range" @input="updateSetting({ 'desktopLyric.island.margin': Number($event.target.value) })")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_lock" :model-value="appSetting['desktopLyric.isLock']" :label="$t('setting__desktop_lyric_lock')" @update:model-value="updateSetting({ 'desktopLyric.isLock': $event })")
  .gap-top(v-if="appSetting['desktopLyric.mode'] == 'bar'")
    base-checkbox(id="setting_desktop_lyric_taskbar_interactive" :model-value="appSetting['desktopLyric.taskbarInteractive']" :label="'任务栏歌词允许鼠标交互（关闭后鼠标穿透）'" @update:model-value="updateSetting({ 'desktopLyric.taskbarInteractive': $event })")
  .gap-top(v-if="appSetting['desktopLyric.mode'] == 'bar'")
    label(:class="$style.rangeLabel")
      span 歌词条宽度（调宽可让更长的歌词完整显示）
      span(:class="$style.rangeValue") {{ appSetting['desktopLyric.width'] }}px
    input(type="range" :value="appSetting['desktopLyric.width']" min="320" max="1200" step="20" :class="$style.range" @input="updateSetting({ 'desktopLyric.width': Number($event.target.value) })")
    .p(:class="$style.islandTip") 歌名/歌手最多占 160px，其余宽度都给歌词。一般 600–720px 能容纳常见长句。
  .gap-top
    base-checkbox(id="setting_desktop_lyric_fullscreen_hide" :model-value="appSetting['desktopLyric.fullscreenHide']" :label="$t('setting__desktop_lyric_fullscreen_hide')" @update:model-value="updateSetting({ 'desktopLyric.fullscreenHide': $event })")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_pause_hide" :model-value="appSetting['desktopLyric.pauseHide']" :label="$t('setting__desktop_lyric_pause_hide')" @update:model-value="updateSetting({ 'desktopLyric.pauseHide': $event })")
  .gap-top(v-if="appSetting['desktopLyric.mode'] != 'island'")
    base-checkbox(id="setting_desktop_lyric_audio_visualization" :model-value="appSetting['desktopLyric.audioVisualization']" :label="$t('setting__desktop_lyric_audio_visualization')" @update:model-value="updateSetting({ 'desktopLyric.audioVisualization': $event })")
  .gap-top(v-if="appSetting['desktopLyric.audioVisualization']")
    h3 {{ $t('setting__desktop_lyric_audio_visualization_style') }}
    base-selection(:class="$style.visualizerSelection" :list="visualizerStyleList" :model-value="appSetting['desktopLyric.audioVisualizationStyle']" item-key="id" item-name="label" @update:model-value="updateSetting({ 'desktopLyric.audioVisualizationStyle': $event })")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_delayScroll" :model-value="appSetting['desktopLyric.isDelayScroll']" :label="$t('setting__desktop_lyric_delay_scroll')" @update:model-value="updateSetting({ 'desktopLyric.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_alwaysOnTop" :model-value="appSetting['desktopLyric.isAlwaysOnTop']" :label="$t('setting__desktop_lyric_always_on_top')" @update:model-value="updateSetting({ 'desktopLyric.isAlwaysOnTop': $event })")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_showTaskbar" :model-value="appSetting['desktopLyric.isShowTaskbar']" :label="$t('setting__desktop_lyric_show_taskbar')" @update:model-value="updateSetting({ 'desktopLyric.isShowTaskbar': $event })")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__desktop_lyric_show_taskbar_tip')")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_alwaysOnTopLoop" :model-value="appSetting['desktopLyric.isAlwaysOnTopLoop']" :label="$t('setting__desktop_lyric_always_on_top_loop')" @update:model-value="updateSetting({ 'desktopLyric.isAlwaysOnTopLoop': $event })")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__desktop_lyric_always_on_top_loop_tip')")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_lockScreen" :model-value="appSetting['desktopLyric.isLockScreen']" :label="$t('setting__desktop_lyric_lock_screen')" @update:model-value="updateSetting({ 'desktopLyric.isLockScreen': $event })")
  .gap-top(v-if="!isLinux")
    base-checkbox(id="setting_desktop_lyric_hoverHide" :model-value="appSetting['desktopLyric.isHoverHide']" :label="$t('setting__desktop_lyric_hover_hide')" @update:model-value="updateSetting({ 'desktopLyric.isHoverHide': $event })")
    svg-icon(class="help-icon" name="help-circle-outline" :aria-label="$t('setting__desktop_lyric_hover_hide_tip')")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_ellipsis" :model-value="appSetting['desktopLyric.style.ellipsis']" :label="$t('setting__desktop_lyric_ellipsis')" @update:model-value="updateSetting({ 'desktopLyric.style.ellipsis': $event })")
  .gap-top
    base-checkbox(id="setting_desktop_lyric_zoom" :model-value="appSetting['desktopLyric.style.isZoomActiveLrc']" :label="$t('desktop_lyric__lrc_active_zoom_on')" @update:model-value="updateSetting({ 'desktopLyric.style.isZoomActiveLrc': $event })")
  //- .gap-top
    base-checkbox(id="setting_desktop_lyric_fontWeight" :model-value="appSetting['desktopLyric.style.fontWeight']" @update:model-value="updateSetting({ 'desktopLyric.style.fontWeight': $event })" :label="$t('setting__desktop_lyric_font_weight')")

dd
  h3#setting__desktop_lyric_font_weight {{ $t('setting__desktop_lyric_font_weight') }}
  div
    base-checkbox.gap-left(id="setting_setting__desktop_lyric_font_weight_font" :model-value="appSetting['desktopLyric.style.isFontWeightFont']" :label="$t('setting__desktop_lyric_font_weight_font')" @update:model-value="updateSetting({ 'desktopLyric.style.isFontWeightFont': $event })")
    base-checkbox.gap-left(id="setting_setting__desktop_lyric_font_weight_line" :model-value="appSetting['desktopLyric.style.isFontWeightLine']" :label="$t('setting__desktop_lyric_font_weight_line')" @update:model-value="updateSetting({ 'desktopLyric.style.isFontWeightLine': $event })")
    base-checkbox.gap-left(id="setting_setting__desktop_lyric_font_weight_extended" :model-value="appSetting['desktopLyric.style.isFontWeightExtended']" :label="$t('setting__desktop_lyric_font_weight_extended')" @update:model-value="updateSetting({ 'desktopLyric.style.isFontWeightExtended': $event })")


dd
  h3#desktop_lyric_direction {{ $t('setting__desktop_lyric_direction') }}
  div
    base-checkbox.gap-left(id="setting_desktop_lyric_direction_horizontal" :model-value="appSetting['desktopLyric.direction']" need value="horizontal" :label="$t('setting__desktop_lyric_direction_horizontal')" @update:model-value="updateSetting({ 'desktopLyric.direction': $event })")
    base-checkbox.gap-left(id="setting_desktop_lyric_direction_vertical" :model-value="appSetting['desktopLyric.direction']" need value="vertical" :label="$t('setting__desktop_lyric_direction_vertical')" @update:model-value="updateSetting({ 'desktopLyric.direction': $event })")

dd
  h3#desktop_lyric_scroll_align {{ $t('setting__desktop_lyric_scroll_align') }}
  div
    base-checkbox.gap-left(id="setting_desktop_lyric_scroll_align_top" :model-value="appSetting['desktopLyric.scrollAlign']" need value="top" :label="$t('setting__desktop_lyric_scroll_align_top')" @update:model-value="updateSetting({ 'desktopLyric.scrollAlign': $event })")
    base-checkbox.gap-left(id="setting_desktop_lyric_scroll_align_center" :model-value="appSetting['desktopLyric.scrollAlign']" need value="center" :label="$t('setting__desktop_lyric_scroll_align_center')" @update:model-value="updateSetting({ 'desktopLyric.scrollAlign': $event })")

dd
  h3#desktop_lyric_align {{ $t('setting__desktop_lyric_align') }}
  div
    base-checkbox.gap-left(id="setting_desktop_lyric_align_left" :model-value="appSetting['desktopLyric.style.align']" need value="left" :label="$t('setting__desktop_lyric_align_left')" @update:model-value="updateSetting({ 'desktopLyric.style.align': $event })")
    base-checkbox.gap-left(id="setting_desktop_lyric_align_center" :model-value="appSetting['desktopLyric.style.align']" need value="center" :label="$t('setting__desktop_lyric_align_center')" @update:model-value="updateSetting({ 'desktopLyric.style.align': $event })")
    base-checkbox.gap-left(id="setting_desktop_lyric_align_right" :model-value="appSetting['desktopLyric.style.align']" need value="right" :label="$t('setting__desktop_lyric_align_right')" @update:model-value="updateSetting({ 'desktopLyric.style.align': $event })")

dd
  h3#desktop_lyric_line_gap {{ $t('setting__desktop_lyric_line_gap', { num: appSetting['desktopLyric.style.lineGap'] }) }}
  div
    .p
      base-btn.btn(min @click="changeLineGap(-1)") {{ $t('setting__desktop_lyric_line_gap_dec') }}
      base-btn.btn(min @click="changeLineGap(1)") {{ $t('setting__desktop_lyric_line_gap_add') }}
dd
  h3#desktop_lyric_color {{ $t('setting__desktop_lyric_color') }}
  div
    .p.gap-top
      div(:class="$style.groupContent")
        div(:class="$style.item")
          div(ref="lyric_unplay_color_ref" :class="$style.color")
          div(:class="$style.label") {{ $t('setting__desktop_lyric_unplay_color') }}
        div(:class="$style.item")
          div(ref="lyric_played_color_ref" :class="$style.color")
          div(:class="$style.label") {{ $t('setting__desktop_lyric_played_color') }}
        div(:class="$style.item")
          div(ref="lyric_shadow_color_ref" :class="$style.color")
          div(:class="$style.label") {{ $t('setting__desktop_lyric_shadow_color') }}
    .p.gap-top
      base-btn.btn(min @click="resetColor") {{ $t('setting__desktop_lyric_color_reset') }}
dd
  h3#desktop_lyric_font {{ $t('setting__desktop_lyric_font') }}
  div
    base-selection.gap-teft(:list="fontList" :model-value="appSetting['desktopLyric.style.font']" item-key="id" item-name="label" @update:model-value="updateSetting({ 'desktopLyric.style.font': $event })")

dd
  h3#desktop_lyric_reset {{ $t('setting__desktop_lyric_reset') }}
  div
    .p.gap-top
      base-btn.btn(min @click="resetWindowSetting") {{ $t('setting__desktop_lyric_reset_window') }}

</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import { getSystemFonts } from '@renderer/utils/ipc'
import { isLinux } from '@common/utils'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { useI18n } from '@renderer/plugins/i18n'
import { pickrTools } from '@renderer/utils/pickrTools'

const defaultUnplayColors = [
  'rgba(255, 255, 255, 1)',
  'rgba(255, 236, 144, 1)',
  'rgba(144, 255, 206, 1)',
  'rgba(32, 255, 132, 1)',
  'rgba(255, 226, 32, 1)',
  'rgba(57, 203, 255, 1)',
  'rgba(217, 57, 255, 1)',
  'rgba(255, 57, 71, 1)',
]
const defaultPlayedColors = [
  'rgba(255, 236, 144, 1)',
  'rgba(144, 255, 206, 1)',
  'rgba(32, 255, 132, 1)',
  'rgba(255, 226, 32, 1)',
  'rgba(57, 203, 255, 1)',
  'rgba(7, 197, 86, 1)',
  'rgba(25, 181, 254, 1)',
  'rgba(217, 57, 255, 1)',
  'rgba(255, 57, 71, 1)',
]
const defaultShadowColors = [
  'rgba(0, 0, 0, 0.15)',
]

const useLyricUnplayColor = () => {
  const lyric_unplay_color_ref = ref(null)
  let tools

  const initLyricUnplayColor = (color, changed, reset) => {
    if (!lyric_unplay_color_ref.value) return
    tools = pickrTools.create(lyric_unplay_color_ref.value, color, defaultUnplayColors, changed, reset)
  }
  const destroyLyricUnplayColor = () => {
    if (!tools) return
    tools.destroy()
    tools = null
  }
  const setLyricUnplayColor = (color) => {
    tools?.setColor(color)
  }

  return {
    lyric_unplay_color_ref,
    initLyricUnplayColor,
    destroyLyricUnplayColor,
    setLyricUnplayColor,
  }
}

const useLyricPlayedColor = () => {
  const lyric_played_color_ref = ref(null)
  let tools

  const initLyricPlayedColor = (color, changed, reset) => {
    if (!lyric_played_color_ref.value) return
    tools = pickrTools.create(lyric_played_color_ref.value, color, defaultPlayedColors, changed, reset)
  }
  const destroyLyricPlayedColor = () => {
    if (!tools) return
    tools.destroy()
    tools = null
  }
  const setLyricPlayedColor = (color) => {
    tools?.setColor(color)
  }

  return {
    lyric_played_color_ref,
    initLyricPlayedColor,
    destroyLyricPlayedColor,
    setLyricPlayedColor,
  }
}

const useLyricShadowColor = () => {
  const lyric_shadow_color_ref = ref(null)
  let tools

  const initLyricShadowColor = (color, changed, reset) => {
    if (!lyric_shadow_color_ref.value) return
    tools = pickrTools.create(lyric_shadow_color_ref.value, color, defaultShadowColors, changed, reset)
  }
  const destroyLyricShadowColor = () => {
    if (!tools) return
    tools.destroy()
    tools = null
  }
  const setLyricShadowColor = (color) => {
    tools?.setColor(color)
  }

  return {
    lyric_shadow_color_ref,
    initLyricShadowColor,
    destroyLyricShadowColor,
    setLyricShadowColor,
  }
}

const useLyricColor = () => {
  const { lyric_unplay_color_ref, initLyricUnplayColor, destroyLyricUnplayColor, setLyricUnplayColor } = useLyricUnplayColor()
  const { lyric_played_color_ref, initLyricPlayedColor, destroyLyricPlayedColor, setLyricPlayedColor } = useLyricPlayedColor()
  const { lyric_shadow_color_ref, initLyricShadowColor, destroyLyricShadowColor, setLyricShadowColor } = useLyricShadowColor()

  const initColors = () => {
    // 手动改色 → 关闭「跟随详情页」，改用自己的颜色
    initLyricUnplayColor(appSetting['desktopLyric.style.lyricUnplayColor'], (color) => {
      updateSetting({
        'desktopLyric.style.colorFollowDetail': false,
        'desktopLyric.style.lyricUnplayColor': color,
      })
    })
    initLyricPlayedColor(appSetting['desktopLyric.style.lyricPlayedColor'], (color) => {
      updateSetting({
        'desktopLyric.style.colorFollowDetail': false,
        'desktopLyric.style.lyricPlayedColor': color,
      })
    })
    initLyricShadowColor(appSetting['desktopLyric.style.lyricShadowColor'], (color) => {
      updateSetting({
        'desktopLyric.style.colorFollowDetail': false,
        'desktopLyric.style.lyricShadowColor': color,
      })
    })
  }

  const destroyColors = () => {
    destroyLyricUnplayColor()
    destroyLyricPlayedColor()
    destroyLyricShadowColor()
  }

  const resetColor = () => {
    const defaultSetting = {
      // 重置 = 恢复「跟随详情页」同步（用户明确要求）
      'desktopLyric.style.colorFollowDetail': true,
      'desktopLyric.style.lyricUnplayColor': 'rgba(255, 255, 255, 1)',
      'desktopLyric.style.lyricPlayedColor': 'rgba(7, 197, 86, 1)',
      'desktopLyric.style.lyricShadowColor': 'rgba(0, 0, 0, 0.18)',
    }
    updateSetting(defaultSetting)
    setLyricUnplayColor(defaultSetting['desktopLyric.style.lyricUnplayColor'])
    setLyricPlayedColor(defaultSetting['desktopLyric.style.lyricPlayedColor'])
    setLyricShadowColor(defaultSetting['desktopLyric.style.lyricShadowColor'])
  }

  onMounted(() => {
    initColors()
  })
  onBeforeUnmount(() => {
    destroyColors()
  })

  return {
    lyric_unplay_color_ref,
    lyric_played_color_ref,
    lyric_shadow_color_ref,
    resetColor,
  }
}

export default {
  name: 'SettingDesktopLyric',
  setup() {
    const t = useI18n()

    const changeLineGap = (step) => {
      let gap = appSetting['desktopLyric.style.lineGap'] + step
      updateSetting({ 'desktopLyric.style.lineGap': Math.min(Math.max(gap, 0), 25) })
    }

    const {
      lyric_unplay_color_ref,
      lyric_played_color_ref,
      lyric_shadow_color_ref,
      resetColor,
    } = useLyricColor()

    const systemFontList = ref([])
    const fontList = computed(() => {
      return [{ id: '', label: t('setting__desktop_lyric_font_default') }, ...systemFontList.value]
    })
    const visualizerStyleList = [
      { id: 'bars', label: t('setting__desktop_lyric_visualizer_bars') },
      { id: 'wave', label: t('setting__desktop_lyric_visualizer_wave') },
      { id: 'orbit', label: t('setting__desktop_lyric_visualizer_orbit') },
      { id: 'candle', label: t('setting__desktop_lyric_visualizer_candle') },
    ]
    void getSystemFonts().then(fonts => {
      systemFontList.value = fonts.map(f => ({ id: f, label: f.replace(/(^"|"$)/g, '') }))
    })

    /**
     * 展开态卡片完整显示歌词所需的最小高度：
     * 控制行 + 进度行 + 内边距固定约 107px，歌词区 = 行数 × 字号 × 1.6。
     * 低于这个值最后一行会被裁掉（用户踩过）。
     */
    const islandMinHeight = computed(() => {
      const rows = Number(appSetting['desktopLyric.island.lyricLines']) || 3
      const font = Number(appSetting['desktopLyric.island.lyricFontSize']) || 19
      return Math.round(107 + rows * font * 1.6)
    })

    const resetWindowSetting = () => {
      updateSetting({
        'desktopLyric.width': 660,
        'desktopLyric.height': 300,
        'desktopLyric.x': null,
        'desktopLyric.y': null,
      })
    }

    // Luminous Harmonic: 灵动岛复位 —— 清空坐标并把停靠边拉回顶部中央
    const handleResetIslandPosition = () => {
      updateSetting({
        'desktopLyric.island.dock': 'top',
        'desktopLyric.x': null,
        'desktopLyric.y': null,
      })
    }

    return {
      appSetting,
      updateSetting,
      changeLineGap,
      lyric_unplay_color_ref,
      lyric_played_color_ref,
      lyric_shadow_color_ref,
      resetColor,
      resetWindowSetting,
      handleResetIslandPosition,
      islandMinHeight,

      fontList,
      visualizerStyleList,
      isLinux,
      // Luminous Harmonic: 灵动岛停靠边选项
      islandDocks: [
        { id: 'bottom', name: '底部' },
        { id: 'top', name: '顶部' },
        { id: 'left', name: '左侧' },
        { id: 'right', name: '右侧' },
      ],
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.groupContent {
  display: flex;
  flex-flow: row wrap;
}
.item {
  padding-right: 40px;
  width: 70px;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
}
.color {
  width: 80%;
  aspect-ratio: 1 / 1;
  background-color: var(--pcr-color);
  border-radius: @radius-border;
  cursor: pointer;
  transition: @transition-fast !important;
  transition-property: background-color, opacity !important;
  box-shadow: 0 0 3px var(--color-primary-light-100-alpha-300);
  &:hover {
    opacity: .7;
  }
}
.label {
  .mixin-ellipsis-2();
  padding-top: 10px;
  text-align: center;
  line-height: 1.1;
}
.visualizerSelection {
  max-width: 240px;
}

// Luminous Harmonic: 灵动岛设置 —— 滑块行 / 复位按钮 / 说明
.rangeLabel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  padding: 2px 0;
}
.rangeValue {
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.range {
  width: 100%;
  accent-color: var(--color-primary);
}
.islandResetBtn {
  padding: 5px 14px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
  border-radius: 8px;
  background: transparent;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color .2s ease;

  &:hover { background: color-mix(in srgb, var(--color-primary) 14%, transparent); }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
}
.islandTip {
  margin: 0;
  font-size: 12px;
  color: var(--color-font-label);
  line-height: 1.5;
}
// 高度不足以完整显示歌词行时的警示色
.islandTipWarn {
  color: var(--color-warning, #e6a23c);
}

</style>
