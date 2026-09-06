import { app } from 'electron'
import './utils/logInit'
import '@common/error'
import {
  initGlobalData,
  initSingleInstanceHandle,
  applyElectronEnvParams,
  setUserDataPath,
  registerDeeplink,
  listenerAppEvent,
} from './app'
import { isLinux } from '@common/utils'

// Luminous Harmonic: 开发模式下窗口从 localhost:9080 加载 —
// 系统代理 (Clash 等) 可能拦截回环请求导致窗口加载 ERR_CONNECTION_TIMED_OUT,
// 对本机地址强制绕过代理 (外部请求仍走系统代理)
if (!app.isPackaged) {
  app.commandLine.appendSwitch('proxy-bypass-list', '<local>;localhost;127.0.0.1')
}
import { initAppSetting } from '@main/app'
import registerModules from '@main/modules'
import initWallpaperEngine, { registerWallpaperEngineScheme } from '@main/modules/wallpaperEngine'


// 初始化应用
let isInitializing = false
let isInitialized = false
const init = () => {
  if (isInitializing || isInitialized) return
  isInitializing = true
  console.log('init')
  void initAppSetting().then(() => {
    registerModules()
    initWallpaperEngine()
    isInitialized = true
    global.lx.event_app.app_inited()
  }).catch(error => {
    console.error('Failed to initialize application', error)
  }).finally(() => {
    isInitializing = false
  })
}

// 必须在 app ready 前注册自定义协议特权
registerWallpaperEngineScheme()

initGlobalData()
initSingleInstanceHandle()
applyElectronEnvParams()
setUserDataPath()
registerDeeplink(init)
listenerAppEvent(init)


// https://github.com/electron/electron/issues/16809
void app.whenReady().then(() => {
  isLinux ? setTimeout(init, 300) : init()
})
