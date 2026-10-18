import { computed, type Ref } from '@common/utils/vueTools'
import defaultSetting from '@common/defaultSetting'
import { appSetting, updateSetting } from '@renderer/store/setting'

type SettingKey = keyof LX.AppSetting

/**
 * 轻量深比较 —— 设置值只可能是原始值/数组/纯对象，足够用；
 * 比引入 lodash.isequal（无类型声明）或 JSON.stringify（键序敏感）都更合适。
 */
const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => deepEqual(v, b[i]))
  }
  const ka = Object.keys(a as Record<string, unknown>)
  const kb = Object.keys(b as Record<string, unknown>)
  if (ka.length !== kb.length) return false
  return ka.every(k => deepEqual(
    (a as Record<string, unknown>)[k],
    (b as Record<string, unknown>)[k],
  ))
}

/**
 * Luminous Harmonic: 设置项「恢复默认」支持。
 *
 * 只做「单项恢复」：某个设置项与默认值不一致时，该项旁显示「↺ 恢复默认」。
 * 说明：曾提供过「整分类全部恢复」的顶部提示条，因布局异常（被撑成整列高度、
 * 图标被放大）已彻底移除，不再恢复该功能。
 */
export const isSettingModified = (key: SettingKey): boolean => {
  return !deepEqual(appSetting[key], defaultSetting[key])
}

export const resetSetting = (key: SettingKey) => {
  updateSetting({ [key]: defaultSetting[key] } as Partial<LX.AppSetting>)
}

/**
 * 传入一组设置键，返回「哪些被改过」与「恢复单项」。
 * 键列表可写成嵌套数组，便于按小节分组。
 */
export const useSettingReset = (keys: SettingKey[] | Ref<SettingKey[]>) => {
  const flatKeys = computed<SettingKey[]>(() => {
    const raw = Array.isArray(keys) ? keys : keys.value
    return raw.flat(Infinity) as SettingKey[]
  })

  const modifiedKeys = computed<SettingKey[]>(() => flatKeys.value.filter(isSettingModified))

  const resetOne = (key: SettingKey) => {
    resetSetting(key)
  }

  return {
    /** 被改过的设置键 */
    modifiedKeys,
    /** 被改过的数量 */
    modifiedCount: computed(() => modifiedKeys.value.length),
    /** 被改过的键集合（给 setting-reset-btn 的 modified 受控模式用，避免每个控件重复比较） */
    modifiedSet: computed(() => new Set<string>(modifiedKeys.value)),
    /** 某一项是否被改过 */
    isModified: isSettingModified,
    /** 恢复单项 */
    resetOne,
  }
}
