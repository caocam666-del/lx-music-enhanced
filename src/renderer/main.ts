import '@common/error'
import { createApp } from 'vue'

import './core/globalData'

import '@renderer/event'

// Components
import mountComponents from './components'

// Plugins
import initPlugins from './plugins'
import { i18nPlugin } from './plugins/i18n'

import App from './App.vue'
import router from './router'
// import store from './store'


import { getSetting, updateSetting } from './utils/ipc'
import { langList } from '@root/lang'
import type { I18n } from '@root/lang/i18n'

import { initSetting } from './store/setting'
// import { bubbleCursor } from './utils/cursor-effects/bubbleCursor'

import './worker'
import { saveViewPrevState } from './utils/data'

// Luminous Harmonic: 全局吞掉 Vue3 异步错误里的 parentNode / clientWidth / type null (渲染中节点被卸载).
// 这些错误不影响功能 (异步队列里的过期 update / resize 回调撞上已卸载元素), 仅污染用户视觉.
const swallowKnownCrash = (err: unknown, instance: unknown, info: string) => {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  const knownNullPatterns = ['parentNode', "'type'", 'clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight']
  if (msg.includes('Cannot read properties of null') && knownNullPatterns.some(p => msg.includes(p))) {
    // eslint-disable-next-line no-console
    console.warn('[swallowKnownCrash] suppressed:', msg, '| info:', info)
    return
  }
  // eslint-disable-next-line no-console
  console.error('[Vue error]', err, info)
}

// sync(store, router)

router.afterEach((to) => {
  if (to.path != '/songList/detail') {
    saveViewPrevState({
      url: to.path,
      query: { ...to.query },
    })
  }
})

void getSetting().then(setting => {
  // window.lx.appSetting = setting
  // Set language automatically
  if (!setting['common.langId'] || !window.i18n.availableLocales.includes(setting['common.langId'])) {
    let langId: I18n['locale'] | null = null
    const locale = window.navigator.language.toLocaleLowerCase() as I18n['locale']
    if (window.i18n.availableLocales.includes(locale)) {
      langId = locale
    } else {
      for (const lang of langList) {
        if (lang.alternate == locale) {
          langId = lang.locale
          break
        }
      }
      langId ??= 'en-us'
    }
    setting['common.langId'] = langId
    void updateSetting({ 'common.langId': langId })
    console.log('Set lang', setting['common.langId'])
  }
  window.setLang(setting['common.langId'])
  window.i18n.setLanguage(setting['common.langId'])

  if (!setting['common.startInFullscreen'] && (document.body.clientHeight > window.screen.availHeight || document.body.clientWidth > window.screen.availWidth) && setting['common.windowSizeId'] > 1) {
    void updateSetting({ 'common.windowSizeId': 1 })
  }

  // store.commit('setSetting', setting)
  initSetting(setting)

  const app = createApp(App)
  app
    .use(router)
    // .use(store)
    .use(i18nPlugin)
  // Luminous Harmonic: 注册全局错误处理, 吞掉已知的 parentNode / type null 异步过期错误
  app.config.errorHandler = swallowKnownCrash
  initPlugins(app)
  mountComponents(app)
  app.mount('#root')

  // Luminous Harmonic: 同时挂 window.onerror / unhandledrejection 兜底, 拦 Chromium 默认弹窗
  const knownNullPatterns = ['parentNode', "'type'", 'clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight']
  window.addEventListener('error', (e) => {
    const msg = e.message || ''
    if (msg.includes('Cannot read properties of null') && knownNullPatterns.some(p => msg.includes(p))) {
      e.preventDefault()
      // eslint-disable-next-line no-console
      console.warn('[window.onerror] suppressed:', msg)
    }
  }, true)
  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason
    const msg = reason?.message || String(reason)
    if (msg.includes('Cannot read properties of null') && knownNullPatterns.some(p => msg.includes(p))) {
      e.preventDefault()
      // eslint-disable-next-line no-console
      console.warn('[unhandledrejection] suppressed:', msg)
    }
  })
})

// bubbleCursor()
