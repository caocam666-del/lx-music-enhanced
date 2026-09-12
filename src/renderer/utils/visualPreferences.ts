// Luminous Harmonic: 界面视觉偏好 (外观与主题页的滑块) 的统一读取与应用。
// 之前只有 App.vue 启动时恢复了 --glass-alpha/--lx-bg-alpha 两个变量,
// 圆角/背景强度/背景模糊在启动时缺失, 必须手动进外观与主题页才恢复 (applyUI onMounted),
// 表现为"每次打开软件都是半透明/效果不对"。现在启动与设置页共用本函数, 保证两边一致。

export const readVisualPreference = (key: string, fallback: number, min: number, max: number): number => {
  const value = Number(localStorage.getItem(key))
  if (!Number.isFinite(value) || localStorage.getItem(key) === null) return fallback
  return Math.min(max, Math.max(min, value))
}

export const applyVisualPreferences = (): void => {
  const radius = readVisualPreference('lx-uiRadius', 12, 0, 24)
  const glassAlpha = readVisualPreference('lx-glassAlpha', 80, 30, 100)
  const bgAlpha = readVisualPreference('lx-bgAlpha', 100, 40, 100)
  const wallpaperStrength = readVisualPreference('lx-wallpaper-strength', 40, 0, 100)
  const wallpaperBlur = readVisualPreference('lx-wallpaper-blur', 0, 0, 30)

  const style = document.documentElement.style
  style.setProperty('--lx-radius', radius + 'px')
  style.setProperty('--lx-radius-sm', Math.round(radius * 0.67) + 'px')
  style.setProperty('--lx-radius-lg', Math.round(radius * 1.33) + 'px')
  const setRadius = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.style.borderRadius = radius + 'px'
  }
  setRadius('body')
  setRadius('root')
  style.setProperty('--glass-alpha', String(glassAlpha / 100))
  style.setProperty('--lx-bg-alpha', String(bgAlpha / 100))
  style.setProperty('--lx-wallpaper-strength', String(wallpaperStrength))
  style.setProperty('--lx-wallpaper-blur', wallpaperBlur + 'px')
}
