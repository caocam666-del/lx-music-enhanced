// import { getListFromState } from './list'
// import { downloadList } from './download'


// export const getList = (listId: string | null): LX.Download.ListItem[] | LX.Music.MusicInfo[] => {
//   return listId == 'download' ? downloadList : getListFromState(listId)
// }
import { encodePath, isUrl } from '@common/utils/common'
import { joinPath } from '@common/utils/nodejs'
import { markRaw, shallowReactive } from '@common/utils/vueTools'
import { getThemes as getTheme } from '@renderer/utils/ipc'
import { qualityList, themeInfo, themeShouldUseDarkColors } from './index'

export const assertApiSupport = (source: LX.Source): boolean => {
  return source == 'local' || qualityList.value[source] != null
}

export const buildBgUrl = (originUrl: string, dataPath: string): string => {
  return isUrl(originUrl)
    ? `url(${originUrl})`
    : `url(file:///${encodePath(joinPath(dataPath, originUrl).replaceAll('\\', '/'))})`
}

export const getThemes = (callback: (themeInfo: LX.ThemeInfo) => void) => {
  if (themeInfo.themes.length) {
    callback(themeInfo)
    return
  }
  void getTheme().then(info => {
    themeInfo.themes = markRaw(info.themes)
    themeInfo.userThemes = shallowReactive(info.userThemes)
    themeInfo.dataPath = info.dataPath
    callback(themeInfo)
  })
}

const parseThemeColor = (value?: string): [number, number, number] | null => {
  if (!value) return null
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const full = hex[1].length == 3 ? hex[1].split('').map(item => item + item).join('') : hex[1]
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)]
  }
  const rgb = value.match(/[\d.]+/g)
  return rgb?.length && rgb.length >= 3 ? [Number(rgb[0]), Number(rgb[1]), Number(rgb[2])] : null
}

const getLuminance = ([r, g, b]: [number, number, number]) => {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return channel(r) * 0.2126 + channel(g) * 0.7152 + channel(b) * 0.0722
}

const getContrastRatio = (first: [number, number, number], second: [number, number, number]) => {
  const light = Math.max(getLuminance(first), getLuminance(second))
  const dark = Math.min(getLuminance(first), getLuminance(second))
  return (light + 0.05) / (dark + 0.05)
}

const getReadableOnColor = (background: [number, number, number]) => {
  const white: [number, number, number] = [255, 255, 255]
  const black: [number, number, number] = [17, 19, 24]
  return getContrastRatio(background, white) >= getContrastRatio(background, black) ? '#ffffff' : '#111318'
}

const applyContrastTokens = (colors: Record<string, string>) => {
  const primary = parseThemeColor(colors['--color-primary'])
  const background = parseThemeColor(colors['--color-content-background'])
  const configuredOnPrimary = parseThemeColor(colors['--color-on-primary'] ?? colors['--color-primary-font'])
  if (!primary) return colors

  const readableOnPrimary = getReadableOnColor(primary)
  const primaryContrast = configuredOnPrimary ? getContrastRatio(primary, configuredOnPrimary) : 0
  const shouldRepairPrimary = primaryContrast < 4.5
  if (shouldRepairPrimary) {
    console.warn('[theme] primary contrast is below WCAG AA; using a readable button foreground')
  }
  if (background) {
    const bodyFont = parseThemeColor(colors['--color-1000'])
    if (bodyFont && getContrastRatio(background, bodyFont) < 4.5) {
      console.warn('[theme] content/background contrast is below WCAG AA')
    }
  }
  return {
    ...colors,
    '--color-on-primary': shouldRepairPrimary ? readableOnPrimary : (colors['--color-on-primary'] ?? readableOnPrimary),
    '--player-on-accent': shouldRepairPrimary ? readableOnPrimary : (colors['--color-on-primary'] ?? readableOnPrimary),
    '--theme-contrast-warning': shouldRepairPrimary ? '1' : '0',
  }
}

export const buildThemeColors = (theme: LX.Theme, dataPath: string) => {
  if (theme.isCustom && theme.config.extInfo['--background-image'] != 'none') {
    theme = copyTheme(theme)
    theme.config.extInfo['--background-image'] = buildBgUrl(theme.config.extInfo['--background-image'], dataPath)
  }
  const colors: Record<string, string> = {
    ...theme.config.themeColors,
    ...theme.config.extInfo,
  }

  return applyContrastTokens(colors)
}

export const copyTheme = (theme: LX.Theme): LX.Theme => {
  return {
    ...theme,
    config: {
      ...theme.config,
      extInfo: { ...theme.config.extInfo },
      themeColors: { ...theme.config.themeColors },
    },
  }
}

export const findTheme = (themeInfo: LX.ThemeInfo, id: string): LX.Theme | undefined => {
  let theme = themeInfo.themes.find(theme => theme.id == id)
  if (theme) return theme
  theme = themeInfo.userThemes.find(theme => theme.id == id)
  return theme
}

export const applyTheme = (id: string, lightId: string, darkId: string, dataPath: string) => {
  getThemes((themeInfo) => {
    let themeId = id == 'auto'
      ? themeShouldUseDarkColors.value
        ? darkId
        : lightId
      : id

    let theme = findTheme(themeInfo, themeId)
    if (!theme) {
      themeId = id == 'auto' && themeShouldUseDarkColors.value ? 'black' : 'green'
      theme = themeInfo.themes.find(theme => theme.id == themeId)!
    }
    window.setTheme(buildThemeColors(theme, dataPath))
  })
}
