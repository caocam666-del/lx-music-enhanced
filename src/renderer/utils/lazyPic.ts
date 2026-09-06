/**
 * 列表封面惰性回退 — 酷我(kw)/酷狗(kg)等源的搜索与歌单详情数据本身不带封面
 * (img: null)，行渲染时按需调用各源现成的 getPic 接口补取，成功后回写
 * meta.picUrl 触发视图刷新。按歌曲 id 缓存结果并去重，避免重复请求。
 */
import musicSdk from '@renderer/utils/musicSdk'
import { toOldMusicInfo } from '@common/utils/tools'

const CACHE_LIMIT = 500
const picCache = new Map<string, string | null>() // '' | null: 失败不重试; string: 封面 URL
const pending = new Map<string, Promise<string | null>>()

const cacheKey = (musicInfo: LX.Music.MusicInfoOnline) => `${musicInfo.source}_${musicInfo.id}`

const setCache = (key: string, value: string | null) => {
  if (picCache.size > CACHE_LIMIT) {
    // 简单淘汰: 清掉一半最旧的
    const keys = Array.from(picCache.keys()).slice(0, CACHE_LIMIT / 2)
    keys.forEach(k => { picCache.delete(k) })
  }
  picCache.set(key, value)
}

export const loadLazyPic = (musicInfo: LX.Music.MusicInfoOnline): void => {
  if (musicInfo.meta.picUrl) return
  const sourceApi = (musicSdk as Record<string, any>)[musicInfo.source]
  if (!sourceApi?.getPic) return

  const key = cacheKey(musicInfo)
  const cached = picCache.get(key)
  if (cached === null) return // 已知取不到
  if (cached) {
    musicInfo.meta.picUrl = cached
    return
  }

  let task = pending.get(key)
  if (!task) {
    // 各源 getPic 接口使用旧版音乐信息结构
    task = Promise.resolve()
      .then(() => sourceApi.getPic(toOldMusicInfo(musicInfo)))
      .then((url: unknown) => (typeof url == 'string' && /^https?:\/\//.test(url) ? url : null))
      .catch(() => null)
    pending.set(key, task)
    task.then(url => {
      pending.delete(key)
      setCache(key, url)
      if (url) musicInfo.meta.picUrl = url
    }).catch(() => {})
  } else {
    task.then(url => {
      if (url) musicInfo.meta.picUrl = url
    }).catch(() => {})
  }
}
