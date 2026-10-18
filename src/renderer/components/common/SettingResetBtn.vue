<template lang="pug">
//- Luminous Harmonic: 设置项「↺ 恢复默认」按钮
//- 两种用法：
//-   1) 单项模式：传 setting-key，组件自己判断是否被改过
//-   2) 受控模式：传 modified（父组件用 modifiedSet 统一算好，避免每个控件重复计算）
button.resetBtn(
  v-if="show" type="button"
  :aria-label="$t('setting__reset_one', { name: label || settingKey })"
  :title="$t('setting__reset_one', { name: label || settingKey })"
  @click="handleClick")
  svg(viewBox="0 0 24 24" aria-hidden="true")
    path(fill="currentColor" d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z")
</template>

<script>
import { computed } from '@common/utils/vueTools'
import defaultSetting from '@common/defaultSetting'
import { updateSetting } from '@renderer/store/setting'
import { isSettingModified } from '@renderer/utils/compositions/useSettingReset'

export default {
  name: 'CommonSettingResetBtn',
  props: {
    // 设置键，例如 'player.autoSkipOnError'
    settingKey: {
      type: String,
      required: true,
    },
    // 受控模式：为 true/true 时显示（不传则由组件自己比较默认值）
    modified: {
      type: Boolean,
      default: null,
    },
    // 无障碍/提示里显示的名称（一般传该项的 i18n 文案）
    label: {
      type: String,
      default: '',
    },
  },
  emits: ['reset'],
  setup(props, { emit }) {
    const show = computed(() => {
      if (props.modified != null) return props.modified
      return isSettingModified(props.settingKey)
    })
    const handleClick = () => {
      updateSetting({ [props.settingKey]: defaultSetting[props.settingKey] })
      emit('reset', props.settingKey)
    }
    return { show, handleClick }
  },
}
</script>

<style lang="less" module>
.resetBtn {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-left: 6px;
  padding: 3px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-font-label);
  cursor: pointer;
  vertical-align: middle;
  transition: color .2s ease, background-color .2s ease, transform .2s ease;

  svg { width: 100%; height: 100%; fill: currentColor; }

  &:hover {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 16%, transparent);
    transform: rotate(-45deg);
  }
  &:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }
}
</style>
