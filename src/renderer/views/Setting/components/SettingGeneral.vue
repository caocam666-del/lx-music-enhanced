<template lang="pug">
dt#general {{ $t('setting__general') }}
dd
  div
    .gap-top
      base-checkbox(id="setting_show_animate" :model-value="appSetting['common.isShowAnimation']" :label="$t('setting__basic_show_animation')" @update:model-value="updateSetting({'common.isShowAnimation': $event})")
    .gap-top
      base-checkbox(id="setting_animate" :disabled="!appSetting['common.isShowAnimation']" :model-value="appSetting['common.randomAnimate']" :label="$t('setting__basic_animation')" @update:model-value="updateSetting({'common.randomAnimate': $event})")
    .gap-top
      base-checkbox(id="setting_start_in_fullscreen" :model-value="appSetting['common.startInFullscreen']" :label="$t('setting__basic_start_in_fullscreen')" @update:model-value="updateSetting({'common.startInFullscreen': $event})")
    .gap-top
      base-checkbox(id="setting_to_tray" :model-value="appSetting['tray.enable']" :label="$t('setting__basic_to_tray')" @update:model-value="updateSetting({'tray.enable': $event})")
    .p.gap-top
      base-btn.btn(min @click="isShowPlayTimeoutModal = true") {{ $t('setting__play_timeout')}} {{ timeLabel ? ` (${timeLabel})` : '' }}

dd
  h3#general_lang {{ $t('setting__basic_lang') }}
  div
    base-checkbox.gap-left(
      v-for="item in langList" :id="`setting_lang_${item.locale}`" :key="item.locale" name="setting_lang"
      need :model-value="appSetting['common.langId']" :value="item.locale" :label="item.name" @update:model-value="updateSetting({'common.langId': $event})")

dd
  h3#general_sourcename {{ $t('setting__basic_sourcename') }}
  div
    base-checkbox.gap-left(
      v-for="item in sourceNameTypes" :id="`setting_abasic_sourcename_${item.id}`" :key="item.id"
      name="setting_basic_sourcename" need :model-value="appSetting['common.sourceNameType']" :value="item.id" :label="item.label" @update:model-value="updateSetting({'common.sourceNameType': $event})")

dd
  h3#general_tray_theme {{ $t('setting__other_tray_theme') }}
  div
    base-checkbox.gap-left(
      v-for="item in trayThemeList" :id="'setting_tray_theme_' + item.id" :key="item.id" :model-value="appSetting['tray.themeId']" name="setting_tray_theme"
      need :label="item.label" :value="item.id" @update:model-value="updateSetting({'tray.themeId': $event})")

play-timeout-modal(v-model="isShowPlayTimeoutModal")
</template>

<script>
// Luminous Harmonic: 设置页重构 — 「通用」分组
// 内容自原 SettingBasic.vue (通用行为/语言/来源名称) 与 SettingOther.vue (托盘图标) 平移, 功能不变
import { computed, ref } from '@common/utils/vueTools'
import { langList, useI18n } from '@root/lang'
import { useTimeout } from '@renderer/core/player/timeoutStop'
import PlayTimeoutModal from './PlayTimeoutModal.vue'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { TRAY_AUTO_ID } from '@common/constants'

export default {
  name: 'SettingGeneral',
  components: {
    PlayTimeoutModal,
  },
  setup() {
    const t = useI18n()

    const isShowPlayTimeoutModal = ref(false)
    const { timeLabel } = useTimeout()

    const sourceNameTypes = computed(() => {
      return [
        { id: 'real', label: t('setting__basic_sourcename_real') },
        { id: 'alias', label: t('setting__basic_sourcename_alias') },
      ]
    })

    const trayThemeList = computed(() => {
      return [
        { id: 0, name: 'native', label: t('setting__other_tray_theme_native') },
        { id: 2, name: 'black', label: t('setting__other_tray_theme_black') },
        { id: 1, name: 'origin', label: t('setting__other_tray_theme_origin') },
        { id: TRAY_AUTO_ID, name: 'auto', label: t('setting__other_tray_theme_auto') },
      ]
    })

    return {
      appSetting,
      updateSetting,
      isShowPlayTimeoutModal,
      timeLabel,
      langList,
      sourceNameTypes,
      trayThemeList,
    }
  },
}
</script>
