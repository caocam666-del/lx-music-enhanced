//! 更新默认主题配置后，需要执行 npm run build:theme 重新构建index.json

const fs = require('fs')
const path = require('path')
const { createThemeColors } = require('./utils')

// Luminous Harmonic 玻璃拟态 token: 按深/浅色统一注入所有主题
// 说明: backdrop-filter 的模糊半径/透明度基于 stitch 设计稿 (深: 40% + 40px, 浅: 70% + 20px)
const createGlassTokens = isDark => isDark
  ? {
      '--glass-surface': 'rgba(30, 32, 36, 0.40)',
      '--glass-surface-strong': 'rgba(22, 24, 28, 0.62)',
      '--glass-surface-weak': 'rgba(20, 22, 27, 0.30)',
      '--glass-card': 'rgba(255, 255, 255, 0.04)',
      '--glass-card-hover': 'rgba(255, 255, 255, 0.09)',
      '--glass-stroke': 'rgba(255, 255, 255, 0.08)',
      '--glass-stroke-strong': 'rgba(255, 255, 255, 0.14)',
      '--glass-shadow': '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
      '--glass-blur': '24px',
      '--glass-blur-strong': '40px',
      // 流光背景（深）
      '--luminous-bg-base': '#111318',
      '--luminous-blob-opacity': '0.55',
      '--luminous-blob-1': '#4b8eff',
      '--luminous-blob-2': '#7d01b1',
      '--luminous-blob-3': '#ff506c',
      // 滚动条 / 滑块轨道（深）
      '--color-scrollbar': 'rgba(255, 255, 255, 0.10)',
      '--color-scrollbar-hover': 'rgba(255, 255, 255, 0.20)',
      '--color-slider-track': 'rgba(255, 255, 255, 0.10)',
    }
  : {
      '--glass-surface': 'rgba(255, 255, 255, 0.70)',
      '--glass-surface-strong': 'rgba(255, 255, 255, 0.78)',
      '--glass-surface-weak': 'rgba(255, 255, 255, 0.55)',
      '--glass-card': 'rgba(255, 255, 255, 0.55)',
      '--glass-card-hover': 'rgba(255, 255, 255, 0.85)',
      '--glass-stroke': 'rgba(255, 255, 255, 0.40)',
      '--glass-stroke-strong': 'rgba(255, 255, 255, 0.65)',
      '--glass-shadow': '0 8px 32px rgba(15, 23, 42, 0.06)',
      '--glass-blur': '12px',
      '--glass-blur-strong': '20px',
      // 流光背景（浅）
      '--luminous-bg-base': '#f7f9fb',
      '--luminous-blob-opacity': '0.30',
      '--luminous-blob-1': '#4b8eff',
      '--luminous-blob-2': '#a855f7',
      '--luminous-blob-3': '#fb7185',
      // 滚动条 / 滑块轨道（浅）
      '--color-scrollbar': 'rgba(15, 23, 42, 0.14)',
      '--color-scrollbar-hover': 'rgba(15, 23, 42, 0.26)',
      '--color-slider-track': 'rgba(15, 23, 42, 0.08)',
    }

// Luminous Harmonic: 非流光内置主题用各自主题色给玻璃加上底色 (绿意盎然 → 绿玻璃底色)
// 根据主题主色生成对应的玻璃背景与背景图
const createThemeGlass = (primary, isDark, backgroundImage) => {
  // 将 'rgb(r, g, b)' 拆成 [r, g, b]
  const match = primary.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!match) return {}
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const fontColor = luminance > 0.62 ? '#111318' : '#ffffff'
  const clamp = value => Math.min(255, Math.max(0, value))
  const base = isDark
    ? 'rgb(' + Math.round(clamp(r * 0.08 + 10)) + ', ' + Math.round(clamp(g * 0.08 + 12)) + ', ' + Math.round(clamp(b * 0.08 + 16)) + ')'
    : 'rgb(' + Math.round(clamp(r * 0.08 + 238)) + ', ' + Math.round(clamp(g * 0.08 + 240)) + ', ' + Math.round(clamp(b * 0.08 + 242)) + ')'
  const generatedBackground = isDark
    ? 'radial-gradient(at 12% 10%, rgba(' + r + ', ' + g + ', ' + b + ', 0.34) 0px, transparent 52%), radial-gradient(at 88% 88%, rgba(' + Math.min(r + 45, 255) + ', ' + Math.min(g + 45, 255) + ', ' + Math.min(b + 45, 255) + ', 0.22) 0px, transparent 48%), linear-gradient(135deg, ' + base + ' 0%, rgb(12, 15, 22) 100%)'
    : 'radial-gradient(at 12% 10%, rgba(' + r + ', ' + g + ', ' + b + ', 0.22) 0px, transparent 52%), radial-gradient(at 88% 88%, rgba(' + Math.min(r + 45, 255) + ', ' + Math.min(g + 45, 255) + ', ' + Math.min(b + 45, 255) + ', 0.16) 0px, transparent 48%), linear-gradient(135deg, ' + base + ' 0%, rgb(248, 250, 252) 100%)'
  return {
    // 流光球跟随主题色 (低饱和, 低透明度)
    '--luminous-blob-1': `rgba(${r}, ${g}, ${b}, 0.45)`,
    '--luminous-blob-2': `rgba(${Math.min(r + 30, 255)}, ${Math.min(g + 30, 255)}, ${Math.min(b + 30, 255)}, 0.30)`,
    '--luminous-blob-3': `rgba(${Math.max(r - 30, 0)}, ${Math.max(g - 30, 0)}, ${Math.max(b - 30, 0)}, 0.35)`,
    '--luminous-blob-opacity': isDark ? '0.58' : '0.42',
    // 背景: 主色低饱和 (浅色主题用更白底)
    '--luminous-bg-base': base,
    // 流光背景图: 主色径向渐变
    '--background-image': backgroundImage && backgroundImage !== 'none' ? backgroundImage : generatedBackground,
    '--color-primary-font': fontColor,
    '--color-on-primary': fontColor,
    '--color-content-background': base,
    '--glass-surface': isDark ? 'rgba(18, 22, 30, 0.48)' : 'rgba(255, 255, 255, 0.68)',
    '--glass-surface-strong': isDark ? 'rgba(14, 18, 26, 0.72)' : 'rgba(255, 255, 255, 0.82)',
    '--glass-card': isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.56)',
    '--glass-card-hover': isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.86)',
    '--glass-stroke': isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)',
    '--glass-stroke-strong': isDark ? 'rgba(255, 255, 255, 0.20)' : 'rgba(15, 23, 42, 0.18)',
  }
}

const defaultThemes = [
  {
    id: 'luminous_light',
    name: '流光浅界',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(0, 74, 198)', // DESIGN.md 权威值 #004ac6
      font: 'rgb(25, 28, 30)',
      '--color-primary-font': '#ffffff',
      '--color-app-background': 'rgba(255, 255, 255, 0.12)',
      '--color-content-background': '#f7f9fb', // Luminous Harmonic: 实体底色 (窗口 transparent:true 时兜底, 不透明)
      '--color-main-background': 'rgba(255, 255, 255, 0.70)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'radial-gradient(at 15% 18%, rgba(37, 99, 235, 0.14) 0px, transparent 52%), radial-gradient(at 85% 12%, rgba(147, 51, 234, 0.10) 0px, transparent 50%), radial-gradient(at 72% 88%, rgba(37, 99, 235, 0.10) 0px, transparent 52%), linear-gradient(180deg, #f7f9fb 0%, #eef2f7 100%)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#505f76',
      '--color-badge-tertiary': '#bc4800',
    },
  },
  {
    id: 'luminous_dark',
    name: '流光夜阑',
    isDark: true,
    isDarkFont: false,
    config: {
      primary: 'rgb(173, 198, 255)', // DESIGN.md 权威值 #adc6ff（电子蓝）
      font: 'rgb(226, 226, 232)',
      '--color-primary-font': '#111318', // 主色钮上的深色图标/文字
      '--color-app-background': 'rgba(0, 0, 0, 0)',
      '--color-content-background': '#111318', // Luminous Harmonic: 实体底色 (窗口 transparent:true 时兜底, 不透明)
      '--color-main-background': 'rgba(24, 26, 31, 0.62)',
      '--color-nav-font': 'var(--color-primary-light-300)',
      '--background-image': 'radial-gradient(at 18% 15%, rgba(75, 142, 255, 0.16) 0px, transparent 52%), radial-gradient(at 82% 18%, rgba(125, 1, 177, 0.15) 0px, transparent 55%), radial-gradient(at 65% 88%, rgba(255, 80, 108, 0.08) 0px, transparent 50%), linear-gradient(180deg, #111318 0%, #0c0e12 100%)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#e9b3ff',
      '--color-badge-tertiary': '#ffb2b7',
    },
  },
  {
    id: 'green',
    name: '绿意盎然',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(77, 175, 124)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#4baed5',
      '--color-badge-tertiary': '#e7aa36',
    },
  },
  {
    id: 'blue',
    name: '蓝田生玉',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(52, 152, 219)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#5cbf9b',
      '--color-badge-tertiary': '#5cbf9b',
    },
  },
  {
    id: 'blue_plus',
    name: '蛋雅深蓝',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(77, 131, 175)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-600)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': 'rgba(66.6, 150.7, 171, 1)',
      '--color-badge-tertiary': 'rgba(54, 196, 231, 1)',
    },
  },
  {
    id: 'orange',
    name: '橙黄橘绿',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(245, 171, 53)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#9ed458',
      '--color-badge-tertiary': '#9ed458',
    },
  },
  {
    id: 'red',
    name: '热情似火',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(214, 69, 65)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#dfbb6b',
      '--color-badge-tertiary': '#dfbb6b',
    },
  },
  {
    id: 'pink',
    name: '粉装玉琢',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(241, 130, 141)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#f5b684',
      '--color-badge-tertiary': '#f5b684',
    },
  },
  {
    id: 'purple',
    name: '重斤球紫',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(155, 89, 182)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#e5a39f',
      '--color-badge-tertiary': '#e5a39f',
    },
  },
  {
    id: 'grey',
    name: '灰常美丽',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(108, 122, 137)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#b19b9f',
      '--color-badge-tertiary': '#b19b9f',
    },
  },
  {
    id: 'ming',
    name: '青出于黑',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(51, 110, 123)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#6376a2',
      '--color-badge-tertiary': '#6376a2',
    },
  },
  {
    id: 'blue2',
    name: '清热板蓝',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(79, 98, 208)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'var(--color-primary-light-600-alpha-700)',
      '--color-main-background': 'rgba(255, 255, 255, 1)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'none',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#b080db',
      '--color-badge-tertiary': '#b080db',
    },
  },
  {
    id: 'black',
    name: '黑灯瞎火',
    isDark: true,
    isDarkFont: false,
    config: {
      primary: 'rgb(150, 150, 150)',
      font: 'rgb(229, 229, 229)',
      '--color-app-background': 'rgba(0, 0, 0, 0)',
      '--color-main-background': 'rgba(19, 19, 19, 0.9)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/landingMoon.png)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary-dark-200)',
      '--color-badge-secondary': 'var(--color-primary)',
      '--color-badge-tertiary': 'var(--color-primary-dark-300)',
    },
  },
  {
    id: 'mid_autumn',
    name: '月里嫦娥',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(74, 55, 82)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'rgba(255, 255, 255, 0)',
      '--color-main-background': 'rgba(255, 255, 255, 0.9)',
      '--color-nav-font': 'var(--color-primary-light-600)',
      '--background-image': 'url(./theme_images/jqbg.jpg)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',


      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': '#af9479',
      '--color-badge-tertiary': '#af9479',
    },
  },
  {
    id: 'naruto',
    name: '木叶之村',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(87, 144, 167)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'rgba(255, 255, 255, 0.15)',
      '--color-main-background': 'rgba(255, 255, 255, 0.8)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/myzcbg.jpg)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': 'var(--color-primary)',
      '--color-badge-secondary': 'var(--color-primary-light-100)',
      '--color-badge-tertiary': 'var(--color-primary-light-100)',
    },
  },
  {
    id: 'china_ink',
    name: '近墨者黑',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgba(47, 47, 47, 1)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'rgba(255, 255, 255, 0)',
      '--color-main-background': 'rgba(255, 255, 255, 0.8)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/china_ink.jpg)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',


      '--color-btn-hide': 'rgba(183, 212, 208, 1)',
      '--color-btn-min': 'rgba(200, 214, 183, 1)',
      '--color-btn-close': 'rgba(218, 195, 188, 1)',

      '--color-badge-primary': 'rgba(137, 70, 70, 1)',
      '--color-badge-secondary': 'rgba(67, 139, 65, 1)',
      '--color-badge-tertiary': 'rgba(132, 135, 65, 1)',
    },
  },
  {
    id: 'happy_new_year',
    name: '新年快乐',
    isDark: false,
    isDarkFont: false,
    config: {
      primary: 'rgb(192, 57, 43)',
      font: 'rgb(33, 33, 33)',
      '--color-app-background': 'rgba(255, 255, 255, 0.15)',
      '--color-main-background': 'rgba(255, 255, 255, 0.8)',
      '--color-nav-font': 'var(--color-primary)',
      '--background-image': 'url(./theme_images/xnkl.png)',
      '--background-image-position': 'center',
      '--background-image-size': 'cover',

      '--color-btn-hide': '#3bc2b2',
      '--color-btn-min': '#85c43b',
      '--color-btn-close': '#fab4a0',

      '--color-badge-primary': '#7fb575',
      '--color-badge-secondary': '#dfbb6b',
      '--color-badge-tertiary': 'var(--color-primary-light-100)',
    },
  },
]

const themes = defaultThemes.map(({ config: { primary, font, ...extInfo }, ...themeInfo }) => {
  // Luminous Harmonic: 非流光主题注入主题色玻璃背景 (绿意盎然 → 绿色流光)
  const themeGlass = themeInfo.id.startsWith('luminous_') ? {} : createThemeGlass(primary, themeInfo.isDark, extInfo['--background-image'])
  return {
    ...themeInfo,
    isCustom: false,
    config: {
      themeColors: createThemeColors(primary, font, themeInfo.isDark),
      // 玻璃 token + 主题色覆盖 (放最后, 优先级最高)
      extInfo: { ...createGlassTokens(themeInfo.isDark), ...extInfo, ...themeGlass },
    },
  }
})

fs.writeFileSync(path.join(__dirname, 'index.json'), JSON.stringify(themes, null, 2))
