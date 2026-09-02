import { app, protocol } from 'electron'
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
import { initAppSetting } from '@main/app'
import registerModules from '@main/modules'


// 初始化应用
let isInitializing = false
let isInitialized = false
const init = () => {
  if (isInitializing || isInitialized) return
  isInitializing = true
  console.log('init')
  void initAppSetting().then(() => {
    registerModules()
    isInitialized = true
    global.lx.event_app.app_inited()
  }).catch(error => {
    console.error('Failed to initialize application', error)
  }).finally(() => {
    isInitializing = false
  })
}

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
