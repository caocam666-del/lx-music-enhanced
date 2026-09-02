import { apiSource, qualityList, userApi } from '@renderer/store'
import { appSetting, setApiSource } from '@renderer/store/setting'
import { setUserApi as setUserApiAction } from '@renderer/utils/ipc'
import musicSdk from '@renderer/utils/musicSdk'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'

let prevId = ''
export const setUserApi = async(apiId: string) => {
  if (prevId == apiId) return
  prevId = apiId
  if (window.lx.apiInitPromise[1]) {
    window.lx.apiInitPromise[0] = new Promise<boolean>(resolve => {
      window.lx.apiInitPromise[1] = false
      window.lx.apiInitPromise[2] = (result: boolean) => {
        window.lx.apiInitPromise[1] = true
        resolve(result)
      }
    })
  }

  if (/^user_api/.test(apiId)) {
    qualityList.value = {}
    userApi.status = false
    userApi.message = 'initing'

    await setUserApiAction(apiId).then(() => {
      if (prevId != apiId) return
      apiSource.value = apiId
    }).catch(err => {
      if (prevId != apiId) return
      if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](false)
      console.log(err)
      let api = apiSourceInfo.find(api => !api.disabled)
      if (!api) return
      apiSource.value = api.id
      if (api.id != appSetting['common.apiSource']) setApiSource(api.id)
    })
  } else {
    // @ts-expect-error
    qualityList.value = musicSdk.supportQuality[apiId] ?? {}
    apiSource.value = apiId
    void setUserApiAction(apiId)
    if (!window.lx.apiInitPromise[1]) window.lx.apiInitPromise[2](true)
  }

  if (prevId != apiId) return
  if (apiId != appSetting['common.apiSource']) setApiSource(apiId)
}

export const getUserApiIds = () => userApi.list.map(api => api.id)

export const switchUserApiSource = async(apiId: string): Promise<boolean> => {
  await setUserApi(apiId)
  for (let i = 0; i < 100; i++) {
    if (apiSource.value == apiId) return await window.lx.apiInitPromise[0]
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return false
}
