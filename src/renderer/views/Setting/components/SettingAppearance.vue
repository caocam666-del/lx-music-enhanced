<template lang="pug">
dt#appearance {{ $t('setting__appearance') }}
dd
  h3#basic_theme {{ $t('setting__basic_theme') }}
  div
    ul(:class="$style.theme")
      li(v-for="theme in themeList" :key="theme.id" :aria-label="theme.name" :style="theme.styles" :class="[$style.themeItem, {[$style.active]: themeId == theme.id}]" @click="toggleTheme(theme)" @contextmenu="handleEditTheme(theme)")
        div(:class="$style.bg")
        span(:class="$style.label") {{ theme.name }}
      li(v-if="showAllTheme || themeId == 'auto'" :aria-label="$t('theme_auto_tip')" :style="autoTheme" :class="[$style.themeItem, $style.auto, {[$style.active]: themeId == 'auto'}]" @click="handleSetThemeAuto" @contextmenu="isShowThemeSelectorModal = true")
        div(:class="$style.bg")
          div(:class="$style.bgContent")
            div(:class="$style.light")
            div(:class="$style.dark")
        span(:class="$style.label") {{ $t('theme_auto') }}
      li(v-if="showAllTheme" :aria-label="$t('theme_add')" :class="[$style.themeItem, $style.add]" @click="handleEditTheme()")
        div(:class="$style.bg")
          div(:class="$style.bgContent")
            svg-icon(:class="$style.icon" name="plus")
        span(:class="$style.label") {{ $t('theme_add') }}
      li(v-if="!showAllTheme" :aria-label="$t('theme_more_btn_show')" :class="[$style.themeItem, $style.moreThme]" @click="showAllTheme = true")
        span(:class="$style.label") {{ $t('theme_more_btn_show') }}
        svg-icon(name="angle-right-solid" :class="$style.activeIcon")

dd
  h3#basic_window_size {{ $t('setting__basic_window_size') }}
  div
    base-checkbox.gap-left(
      v-for="item in windowSizeList" :id="`setting_window_size_${item.id}`" :key="item.id"
      name="setting_window_size" need :model-value="appSetting['common.windowSizeId']" :disabled="isFullscreen" :value="item.id" :label="$t('setting__basic_window_size_' + item.name)"
      @update:model-value="updateSetting({'common.windowSizeId': $event})")

dd
  h3#basic_font_size {{ $t('setting__basic_font_size') }}
  div
    base-checkbox.gap-left(
      v-for="item in fontSizeList" :id="`setting_basic_font_size_${item.id}`" :key="item.id"
      name="setting_basic_font_size" need :model-value="appSetting['common.fontSize']" :value="item.id"
      :label="item.label" :disabled="isFullscreen" @update:model-value="updateSetting({'common.fontSize': $event})")

dd
  h3#basic_font {{ $t('setting__basic_font') }}
  div(style="--selection-width: 12rem;")
    base-selection.gap-left(:list="fontList" :model-value="fonts[0]" item-key="id" item-name="label" @update:model-value="updateFonts($event, fonts[1])")
    base-selection.gap-left(v-if="fonts[0]" :list="fontList" :model-value="fonts[1]" item-key="id" item-name="label" @update:model-value="updateFonts(fonts[0], $event)")

dd
  h3#basic_control_btn_position {{ $t('setting__basic_control_btn_position') }}
  div
    base-checkbox.gap-left(
      v-for="item in controlBtnPositionList" :id="`setting_basic_control_btn_position_${item.id}`" :key="item.id"
      name="setting_basic_control_btn_position" need :model-value="appSetting['common.controlBtnPosition']" :value="item.id" :label="item.name" @update:model-value="updateSetting({'common.controlBtnPosition': $event})")
dd
  h3#basic_appearance 界面微调
  div
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span 界面圆角
        span(style="font-size:11px;color:var(--color-font-label);min-width:42px;text-align:right") {{ uiRadius }}px
      input(type="range" v-model.number="uiRadius" min="0" max="24" step="1" style="width:100%;accent-color:var(--color-primary)")
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span 卡片透明度
        span(style="font-size:11px;color:var(--color-font-label);min-width:48px;text-align:right") {{ glassAlpha }}%
      input(type="range" v-model.number="glassAlpha" min="30" max="100" step="5" style="width:100%;accent-color:var(--color-primary)")
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span 背景透明度
        span(style="font-size:11px;color:var(--color-font-label);min-width:42px;text-align:right") {{ bgAlpha }}%
      input(type="range" v-model.number="bgAlpha" min="40" max="100" step="5" style="width:100%;accent-color:var(--color-primary)")
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span 背景强度
        span(style="font-size:11px;color:var(--color-font-label);min-width:42px;text-align:right") {{ lxWallpaperStrength }}%
      input(type="range" v-model.number="lxWallpaperStrength" min="0" max="100" step="5" style="width:100%;accent-color:var(--color-primary)")
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span 背景模糊
        span(style="font-size:11px;color:var(--color-font-label);min-width:42px;text-align:right") {{ lxWallpaperBlur }}px
      input(type="range" v-model.number="lxWallpaperBlur" min="0" max="30" step="1" style="width:100%;accent-color:var(--color-primary)")
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span Wallpaper Engine 动态壁纸
        span(style="display:flex;gap:6px")
          button(style="padding:4px 10px;border-radius:6px;border:1px solid var(--glass-stroke);background:color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);color:var(--color-font);cursor:pointer;font-size:12px" @click="isShowWEModal = true") 本机 Wallpaper Engine 壁纸
          button(v-if="weActive" style="padding:4px 10px;border-radius:6px;border:1px solid var(--glass-stroke);background:color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);color:var(--color-font);cursor:pointer;font-size:12px" @click="clearWEWallpaper") 清除
    .gap-top
      label(style="display:flex;align-items:center;justify-content:space-between;padding:6px 0")
        span 自定义壁纸
        span(style="display:flex;gap:6px")
          input(type="file" ref="wallpaperInput" accept="image/*" style="display:none" @change="handleWallpaperSelect")
          button(style="padding:4px 10px;border-radius:6px;border:1px solid var(--glass-stroke);background:color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);color:var(--color-font);cursor:pointer;font-size:12px" @click="$refs.wallpaperInput.click()") 选择图片
          button(v-if="wallpaper" style="padding:4px 10px;border-radius:6px;border:1px solid var(--glass-stroke);background:color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);color:var(--color-font);cursor:pointer;font-size:12px" @click="clearWallpaper") 清除

dd
  h3#basic_playbar_progress_style {{ $t('setting__basic_playbar_progress_style') }}
  div
    base-checkbox.gap-left(
      id="setting_basic_playbar_progress_style_mini" name="setting_basic_playbar_progress_style"
      need :model-value="appSetting['common.playBarProgressStyle']" value="mini" :label="$t('setting__basic_playbar_progress_style_mini')" @update:model-value="updateSetting({'common.playBarProgressStyle': $event})")
    base-checkbox.gap-left(
      id="setting_basic_playbar_progress_style_middle" name="setting_basic_playbar_progress_style"
      need :model-value="appSetting['common.playBarProgressStyle']" value="middle" :label="$t('setting__basic_playbar_progress_style_middle')" @update:model-value="updateSetting({'common.playBarProgressStyle': $event})")
    base-checkbox.gap-left(
      id="setting_basic_playbar_progress_style_full" name="setting_basic_playbar_progress_style"
      need :model-value="appSetting['common.playBarProgressStyle']" value="full" :label="$t('setting__basic_playbar_progress_style_full')" @update:model-value="updateSetting({'common.playBarProgressStyle': $event})")

dd
  h3#basic_playbar_wave {{ $t('setting__basic_playbar_wave') }}
  div
    // Luminous Harmonic: 用字符串值走 radio 模式 — base-checkbox 的 need 模式在布尔 model 下
    // handleInput 恒发 true, 导致"关闭"点不动 (原 bug)
    base-checkbox.gap-left(id="setting_basic_playbar_wave_on" name="setting_basic_playbar_wave"
      need :model-value="appSetting['common.playBarWave'] ? 'on' : 'off'" value="on" :label="$t('setting__basic_playbar_wave_on')" @update:model-value="updateSetting({'common.playBarWave': $event == 'on'})")
    base-checkbox.gap-left(id="setting_basic_playbar_wave_off" name="setting_basic_playbar_wave"
      need :model-value="appSetting['common.playBarWave'] ? 'on' : 'off'" value="off" :label="$t('setting__basic_playbar_wave_off')" @update:model-value="updateSetting({'common.playBarWave': $event == 'on'})")

dd
  h3#basic_playbar_visualization {{ $t('setting__basic_playbar_visualization') }}
  div
    base-checkbox.gap-left(id="setting_basic_playbar_visualization_on" name="setting_basic_playbar_visualization"
      need :model-value="appSetting['common.playBarVisualization'] ? 'on' : 'off'" value="on" :label="$t('setting__basic_playbar_visualization_on')" @update:model-value="updateSetting({'common.playBarVisualization': $event == 'on'})")
    base-checkbox.gap-left(id="setting_basic_playbar_visualization_off" name="setting_basic_playbar_visualization"
      need :model-value="appSetting['common.playBarVisualization'] ? 'on' : 'off'" value="off" :label="$t('setting__basic_playbar_visualization_off')" @update:model-value="updateSetting({'common.playBarVisualization': $event == 'on'})")

ThemeSelectorModal(v-model="isShowThemeSelectorModal")
ThemeEditModal(v-model="isShowThemeEditModal" :theme-id="editThemeId" @submit="handleRefreshTheme")
WallpaperEngineModal(v-model="isShowWEModal")
</template>

<script>
// Luminous Harmonic: 设置页重构 — 「外观与主题」分组
// 内容自原 SettingBasic.vue 平移 (主题/窗口/字体/控制按钮/界面微调/播放栏样式), 功能不变
import { computed, ref, watch, reactive, shallowReactive, onMounted } from '@common/utils/vueTools'
import { windowSizeList, isFullscreen, themeId } from '@renderer/store'
import { useI18n } from '@root/lang'
import { getSystemFonts } from '@renderer/utils/ipc'
import { dialog } from '@renderer/plugins/Dialog'

import ThemeSelectorModal from './ThemeSelectorModal.vue'
import ThemeEditModal from './ThemeEditModal/index.vue'
import WallpaperEngineModal from './WallpaperEngineModal.vue'
import { appSetting, updateSetting } from '@renderer/store/setting'
// Luminous Harmonic: applyWallpaperEngine 必须导入 — 之前清除按钮调用未导入的函数直接抛错 (点击无效)
import { applyWallpaper, applyWallpaperEngine } from '@renderer/utils/wallpaper'
import { applyVisualPreferences } from '@renderer/utils/visualPreferences'
import { getThemes, applyTheme, findTheme, buildBgUrl } from '@renderer/store/utils'

export default {
  name: 'SettingAppearance',
  components: {
    ThemeSelectorModal,
    ThemeEditModal,
    WallpaperEngineModal,
  },
  setup() {
    const t = useI18n()

    const showAllTheme = ref(false)
    const defaultThemesRaw = shallowReactive([])
    const builtInThemeNames = {
      luminous_light: '白驹过隙',
      luminous_dark: '暗夜拾光',
    }
    const defaultThemes = computed(() => {
      return defaultThemesRaw.map(theme => ({
        ...theme,
        isDefault: true,
        name: builtInThemeNames[theme.id] || t('theme_' + theme.id),
      }))
    })
    const userThemes = shallowReactive([])
    const allThemes = computed(() => {
      return [...defaultThemes.value, ...userThemes]
    })
    const themeList = computed(() => {
      if (!allThemes.value.length) return []
      return showAllTheme.value
        ? allThemes.value
        : themeId.value == 'auto'
          ? []
          : [allThemes.value.find(t => t.id == themeId.value) ?? allThemes.value[0]]
    })
    const autoTheme = reactive({})
    const updateAutoTheme = (info) => {
      let light = findTheme(info, appSetting['theme.lightId'])
      light ??= info.themes.find(theme => theme.id == 'green')
      let dark = findTheme(info, appSetting['theme.darkId'])
      dark ??= info.themes.find(theme => theme.id == 'black')
      autoTheme['--color-primary-theme-light'] = light.config.themeColors['--color-theme']
      autoTheme['--background-image-theme-light'] = light.isCustom
        ? light.config.extInfo['--background-image'] == 'none'
          ? 'none'
          : buildBgUrl(light.config.extInfo['--background-image'], info.dataPath)
        : light.config.extInfo['--background-image']
      autoTheme['--color-primary-theme-dark'] = dark.config.themeColors['--color-theme']
      autoTheme['--background-image-theme-dark'] = dark.isCustom
        ? dark.config.extInfo['--background-image'] == 'none'
          ? 'none'
          : buildBgUrl(dark.config.extInfo['--background-image'], info.dataPath)
        : dark.config.extInfo['--background-image']
    }

    let dataPath = ''
    const init = () => {
      getThemes((info) => {
        dataPath = info.dataPath
        defaultThemesRaw.splice(0, defaultThemesRaw.length, ...info.themes.map(t => {
          return {
            id: t.id,
            styles: {
              '--color-primary-theme': t.config.themeColors['--color-theme'],
              '--background-image-theme': t.config.extInfo['--background-image'],
            },
          }
        }))
        userThemes.splice(0, userThemes.length, ...info.userThemes.map(t => {
          return {
            id: t.id,
            name: t.name,
            styles: {
              '--color-primary-theme': t.config.themeColors['--color-theme'],
              '--background-image-theme': t.config.extInfo['--background-image'] == 'none'
                ? 'none'
                : buildBgUrl(t.config.extInfo['--background-image'], info.dataPath),
            },
          }
        }))
        updateAutoTheme(info)
      })
    }
    const editThemeId = ref('')
    const handleEditTheme = (theme) => {
      if (theme?.isDefault) return
      if (!theme && userThemes.length >= 10) {
        void dialog({
          message: t('theme_max_tip'),
          confirmButtonText: t('alert_button_text'),
        })
        return
      }
      editThemeId.value = theme ? theme.id : ''
      isShowThemeEditModal.value = true
    }
    const handleRefreshTheme = () => {
      init()
    }
    init()
    const toggleTheme = (theme) => {
      if (themeId.value == theme.id) return
      themeId.value = theme.id
      applyTheme(theme.id, appSetting['theme.lightId'], appSetting['theme.darkId'], dataPath)
      updateSetting({ 'theme.id': theme.id })
    }

    watch(() => [appSetting['theme.lightId'], appSetting['theme.darkId']], () => {
      getThemes(updateAutoTheme)
    })
    const isShowWEModal = ref(false)
    const weActive = ref(false)
    const clearWEWallpaper = () => {
      applyWallpaperEngine(null)
      weActive.value = false
      // 清除 WE 壁纸后恢复自定义图片壁纸 (若已设置)
      if (wallpaper.value) applyWallpaperLocal()
    }
    const isShowThemeSelectorModal = ref(false)
    const handleSetThemeAuto = () => {
      if (themeId.value == 'auto') return
      if (window.localStorage.getItem('theme-auto-tip') != 'true') {
        window.localStorage.setItem('theme-auto-tip', 'true')
        void dialog({
          message: t('setting__basic_theme_auto_tip'),
          confirmButtonText: t('ok'),
        })
      }
      toggleTheme({ id: 'auto' })
    }
    const isShowThemeEditModal = ref(false)

    const controlBtnPositionList = computed(() => {
      return [
        { id: 'left', name: t('setting__basic_control_btn_position_left') },
        { id: 'right', name: t('setting__basic_control_btn_position_right') },
      ]
    })

    const systemFontList = ref([])
    const fontList = computed(() => {
      return [{ id: '', label: t('setting__desktop_lyric_font_default') }, ...systemFontList.value]
    })
    void getSystemFonts().then(fonts => {
      systemFontList.value = fonts.map(f => ({ id: f, label: f.replace(/(^"|"$)/g, '') }))
    })

    const fonts = computed(() => {
      if (!appSetting['common.font']) return ['', '']
      let [f1 = '', f2 = ''] = appSetting['common.font'].split(',')
      return [f1.trim(), f2.trim()]
    })
    const updateFonts = (font1, font2) => {
      let font = []
      if (font1) font.push(font1)
      if (font2) font.push(font2)
      updateSetting({ 'common.font': font.join(', ') })
    }
    const fontSizeList = computed(() => {
      return [
        { id: 14, label: t('setting__basic_font_size_14px') },
        { id: 15, label: t('setting__basic_font_size_15px') },
        { id: 16, label: t('setting__basic_font_size_16px') },
        { id: 17, label: t('setting__basic_font_size_17px') },
        { id: 18, label: t('setting__basic_font_size_18px') },
        { id: 19, label: t('setting__basic_font_size_19px') },
      ]
    })


    // Luminous Harmonic: 圆角 / 透明度滑块 (localStorage 持久化避免切换后重置)
    const uiRadius = ref(Number(localStorage.getItem('lx-uiRadius')) || 12)
    const glassAlpha = ref(Number(localStorage.getItem('lx-glassAlpha')) || 80)
    const bgAlpha = ref(Number(localStorage.getItem('lx-bgAlpha')) || 100)
    // Luminous Harmonic: 背景强度/模糊 (对标 PureMusic 背景设置) —
    // 强度以亮度自适应透明度为基准做倍率 (40 = 原行为), 模糊为像素值
    const lxWallpaperStrength = ref(Number(localStorage.getItem('lx-wallpaper-strength')) || 40)
    const lxWallpaperBlur = ref(Number(localStorage.getItem('lx-wallpaper-blur')) || 0)
    const applyUI = () => {
      // Luminous Harmonic: 持久化到 localStorage (切页面后不丢失)
      localStorage.setItem('lx-uiRadius', uiRadius.value)
      localStorage.setItem('lx-glassAlpha', glassAlpha.value)
      localStorage.setItem('lx-bgAlpha', bgAlpha.value)
      localStorage.setItem('lx-wallpaper-strength', lxWallpaperStrength.value)
      localStorage.setItem('lx-wallpaper-blur', lxWallpaperBlur.value)
      // 实际应用统一走共享实现 (与 App.vue 启动恢复一致)
      applyVisualPreferences()
    }
    watch(uiRadius, applyUI)
    watch(glassAlpha, applyUI)
    watch(bgAlpha, applyUI)
    watch(lxWallpaperStrength, applyUI)
    watch(lxWallpaperBlur, applyUI)
    onMounted(applyUI)

    // Luminous Harmonic: 自定义壁纸
    const wallpaper = ref(localStorage.getItem('lx-wallpaper') ?? '')
    const handleWallpaperSelect = (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target.result
        wallpaper.value = dataUrl
        applyWallpaperLocal()
      }
      reader.readAsDataURL(file)
    }
    const clearWallpaper = () => {
      wallpaper.value = ''
      applyWallpaperLocal()
    }
    const applyWallpaperLocal = () => {
      // Luminous Harmonic: 走共享工具 — 含亮度自适应透明度 (--lx-wallpaper-opacity)
      applyWallpaper(wallpaper.value)
      localStorage.setItem('lx-wallpaper', wallpaper.value)
    }
    // Luminous Harmonic: WE 壁纸/自定义壁纸的启动恢复统一由 App.vue 负责 (全局唯一挂载点)。
    // 之前这里 onMounted 时再次 restoreWallpaperEngine/applyWallpaperLocal — 每次进入设置页
    // 都会重设 video.src / bg 背景 → 视频重载、背景重绘, 表现为"从别的界面点进外观与主题就闪一下"。
    // 这里只读取 WE 激活状态用于显示"清除"按钮。
    try { weActive.value = !!JSON.parse(localStorage.getItem('lx-we-current') ?? 'null')?.id } catch (_) {}

    return {
      uiRadius,
      lxWallpaperStrength,
      lxWallpaperBlur,
      glassAlpha,
      bgAlpha,
      wallpaper,
      handleWallpaperSelect,
      clearWallpaper,
      appSetting,
      updateSetting,
      userThemes,
      autoTheme,
      showAllTheme,
      themeList,
      fonts,
      updateFonts,
      isShowWEModal,
      weActive,
      clearWEWallpaper,
      isShowThemeSelectorModal,
      isShowThemeEditModal,
      handleSetThemeAuto,
      windowSizeList,
      controlBtnPositionList,
      fontList,
      isFullscreen,
      toggleTheme,
      themeId,
      handleRefreshTheme,
      editThemeId,
      handleEditTheme,
      fontSizeList,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.theme {
  display: flex;
  flex-flow: row wrap;
  margin-bottom: -20px;

  .themeItem {
    display: flex;
    flex-flow: column nowrap;
    align-items: center;
    cursor: pointer;
    margin-right: 8px;
    transition: .3s ease;
    transition-property: color, opacity;
    margin-bottom: 18px;
    width: 86px;

    &:hover {
      opacity: .7;
    }

    &:last-child {
      margin-right: 0;
    }

    &.active {
      color: var(--color-primary-font-active);
      .bg {
        border-color: var(--color-primary-font-active);
      }

      &:hover {
        opacity: 1;
      }
    }

    .bg {
      display: block;
      width: 36px;
      height: 36px;
      margin-bottom: 5px;
      border: 2Px solid transparent;
      padding: 2Px;
      transition: border-color .3s ease;
      border-radius: 5px;
      &:after {
        display: block;
        content: ' ';
        width: 100%;
        height: 100%;
        border-radius: @radius-border;
        background-position: center;
        background-size: cover;
        background-repeat: no-repeat;
        background-color: var(--color-primary-theme);
        background-image: var(--background-image-theme);
      }
    }

    .label {
      width: 100%;
      text-align: center;
      height: 1.2em;
    }

    &.auto {

      &.active {
        color: var(--color-primary-font-active);
        .bg {
          border-color: var(--color-primary-font-active);
        }
      }

      >.bg {
        &:after {
          content: none;
        }
      }
      .bgContent {
        position: relative;
        height: 100%;
        overflow: hidden;
        border-radius: 5px;
      }
      .light, .dark {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        &:after {
          display: block;
          content: ' ';
          width: 100%;
          height: 100%;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
        }
      }
      .light {
        &:after {
          clip-path: polygon(0 0, 100% 0, 0 100%);
        }
        svg {
          fill: var(--color-primary-theme-light);
        }
        &:after {
          background-color: var(--color-primary-theme-light);
          background-image: var(--background-image-theme-light);
        }
      }
      .dark {
        &:after {
          clip-path: polygon(0 100%, 100% 0, 100% 100%);
        }
        svg {
          fill: var(--color-primary-theme-dark);
        }
        &:after {
          background-color: var(--color-primary-theme-dark);
          background-image: var(--background-image-theme-dark);
        }
      }
    }

    &.add {
      >.bg {
        &:after {
          content: none;
        }
        .bgContent {
          transition: .3s ease;
          transition-property: border, color;
          box-sizing: border-box;
          border: 1Px dashed var(--color-primary-light-100-alpha-300);
          color: var(--color-primary-light-100-alpha-300);
          position: relative;
          height: 100%;
          overflow: hidden;
          border-radius: 5px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon {
          width: 66%;
          height: auto;
        }
      }
      .label {
        color: var(--color-primary-dark-100-alpha-300);
      }
    }

    &.moreThme {
      flex-direction: row;
      width: auto;
      gap: 5px;
      color: var(--color-primary-font-active);
      .label {
        height: auto;
      }
    }
  }
}
</style>
