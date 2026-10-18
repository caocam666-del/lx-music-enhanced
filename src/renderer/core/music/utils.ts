import { qualityList } from '@renderer/store'
import { assertApiSupport } from '@renderer/store/utils'
import musicSdk from '@renderer/utils/musicSdk'
import {
  // getOtherSource as getOtherSourceFromStore,
  // saveOtherSource as saveOtherSourceFromStore,
  getMusicUrl as getStoreMusicUrl,
  getPlayerLyric as getStoreLyric,
} from '@renderer/utils/ipc'
import { appSetting } from '@renderer/store/setting'
import { langS2T, toNewMusicInfo, toOldMusicInfo } from '@renderer/utils'
import { requestMsg } from '@renderer/utils/message'
import { apis } from '@renderer/utils/musicSdk/api-source'
import { recordAttempt } from '@renderer/core/player/diagnosis'

const getOtherSourcePromises = new Map()
const otherSourceCache = new Map<LX.Music.MusicInfo | LX.Download.ListItem, LX.Music.MusicInfoOnline[]>()
export const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/

// ============================ 换源时限与错误分级 ============================
/**
 * 单音源尝试时限（毫秒）。
 * 底层 httpFetch 的默认超时是 15000ms — 那是「一次请求」的上限, 不是「一个音源」的上限:
 * 一个音源的 getMusicUrl 可能内部串联多次请求（如 wy 先试账号接口再试代理接口）,
 * 因此这里再包一层, 保证换源时单个音源绝不会拖住整条链路。
 */
export const getSourceTimeout = () => Math.max(2000, (appSetting['player.sourceSwitch.sourceTimeout'] ?? 6) * 1000)
/** 纯缓存查询时限（毫秒）— 缓存命中是即时的, 超过这个时间说明缓存层异常, 直接放过 */
export const CACHE_LOOKUP_TIMEOUT = 300
/** 整个换源阶段的总时限（毫秒）— 到点即止损, 不再等后面的音源 */
export const getSwitchBudget = () => Math.max(5000, (appSetting['player.sourceSwitch.totalBudget'] ?? 18) * 1000)

/** 错误消息：说明该错误不应计入「连续播放失败」次数（重试即可, 不是歌曲本身的问题） */
export const NON_FATAL_MESSAGES: ReadonlySet<string> = new Set([
  requestMsg.tooManyRequests,
  requestMsg.cancelRequest,
  requestMsg.notConnectNetwork,
  requestMsg.timeout,
])

/** 该错误是否属于「非致命」（服务器繁忙/断网/超时/主动取消） */
export const isNonFatalError = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err ?? '')
  for (const item of NON_FATAL_MESSAGES) {
    if (message.includes(item)) return true
  }
  return false
}

/**
 * 给 Promise 套一层超时。超时后以「该音源超时」拒绝, 调用方即可换下一个音源。
 * 注意：底层请求无法真正中断（needle 已在飞行中）, 这里只是不再等待它 —
 * 这正是换源场景需要的语义（不等 = 立刻试下一个源）。
 */
export const withTimeout = <T>(promise: Promise<T>, ms: number, label?: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`${requestMsg.timeout}${label ? `(${label})` : ''}`))
    }, ms)
    promise.then((val) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(val)
    }).catch((err: unknown) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

export interface SourceDeadline {
  /** 剩余预算（毫秒），已耗尽时为 0 */
  remaining: () => number
  /** 本次尝试可用的时限 = min(单源时限, 剩余预算) */
  slice: () => number
  expired: () => boolean
}

/** 创建换源总预算计时器 */
export const createSourceDeadline = (budget = getSwitchBudget()): SourceDeadline => {
  const endAt = Date.now() + budget
  const remaining = () => Math.max(0, endAt - Date.now())
  return {
    remaining,
    slice: () => Math.min(getSourceTimeout(), remaining()),
    expired: () => remaining() <= 0,
  }
}

// Luminous Harmonic: 换源匹配结果持久化 — 导入源(如汽水)的歌曲每次播放都要全源搜索
// (最多 15s), 匹配成功后写入 localStorage, 重启后直接命中, 省去整次搜索
const OTHER_SOURCE_MATCH_CACHE_KEY = 'lx_other_source_match_cache_v2'
const OTHER_SOURCE_MATCH_CACHE_LIMIT = 300
const otherSourceMatchCache = new Map<string, LX.Music.MusicInfoOnline[]>()
try {
  const saved = JSON.parse(window.localStorage.getItem(OTHER_SOURCE_MATCH_CACHE_KEY) ?? '[]') as Array<[string, LX.Music.MusicInfoOnline[]]>
  saved.forEach(([k, v]) => { otherSourceMatchCache.set(k, v) })
} catch (_) { /* 缓存损坏时忽略 */ }

const saveOtherSourceMatchCache = (key: string, list: LX.Music.MusicInfoOnline[]) => {
  if (!list.length) return
  if (otherSourceMatchCache.size >= OTHER_SOURCE_MATCH_CACHE_LIMIT) {
    const oldest = otherSourceMatchCache.keys().next().value
    if (oldest != null) otherSourceMatchCache.delete(oldest)
  }
  otherSourceMatchCache.delete(key)
  otherSourceMatchCache.set(key, list) // 重插保持 LRU 顺序
  try {
    window.localStorage.setItem(OTHER_SOURCE_MATCH_CACHE_KEY, JSON.stringify(Array.from(otherSourceMatchCache.entries())))
  } catch (_) { /* 存储满时忽略 */ }
}

export const getOtherSource = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  if (otherSourceCache.has(musicInfo)) return otherSourceCache.get(musicInfo)!
  let key: string
  let searchMusicInfo: {
    name: string
    singer: string
    source: string
    albumName: string
    interval: string
  }
  if ('progress' in musicInfo) {
    key = `local_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.metadata.musicInfo.name,
      singer: musicInfo.metadata.musicInfo.singer,
      source: musicInfo.metadata.musicInfo.source,
      albumName: musicInfo.metadata.musicInfo.meta.albumName,
      interval: musicInfo.metadata.musicInfo.interval ?? '',
    }
  } else {
    key = `${musicInfo.source}_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval ?? '',
    }
  }
  if (getOtherSourcePromises.has(key)) return getOtherSourcePromises.get(key)

  // Luminous Harmonic: 命中持久化匹配缓存 → 跳过全源搜索 (核心提速点)
  if (!isRefresh) {
    const persisted = otherSourceMatchCache.get(key)
    if (persisted?.length) {
      otherSourceCache.set(musicInfo, persisted)
      return persisted
    }
  }

  const promise = new Promise<LX.Music.MusicInfoOnline[]>((resolve, reject) => {
    let timeout: null | NodeJS.Timeout = setTimeout(() => {
      timeout = null
      reject(new Error('find music timeout'))
    }, 10_000)
    musicSdk.findMusic(searchMusicInfo).then((otherSource) => {
      if (otherSourceCache.size > 10) otherSourceCache.clear()
      const source = otherSource.map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
      otherSourceCache.set(musicInfo, source)
      saveOtherSourceMatchCache(key, source)
      resolve(source)
    }).catch(reject).finally(() => {
      if (timeout) clearTimeout(timeout)
    })
  }).then((otherSource) => {
    // if (otherSource.length) void saveOtherSourceFromStore(musicInfo.id, otherSource)
    return otherSource
  }).finally(() => {
    if (getOtherSourcePromises.has(key)) getOtherSourcePromises.delete(key)
  })
  getOtherSourcePromises.set(key, promise)
  return promise
}


export const buildLyricInfo = async(lyricInfo: MakeOptional<LX.Player.LyricInfo, 'rawlrcInfo'>): Promise<LX.Player.LyricInfo> => {
  if (!appSetting['player.isS2t']) {
    // @ts-expect-error
    if (lyricInfo.rawlrcInfo) return lyricInfo
    return { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
  }

  if (appSetting['player.isS2t']) {
    const tasks = [
      lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''),
      lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''),
      lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''),
      lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''),
    ]
    if (lyricInfo.rawlrcInfo) {
      tasks.push(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''))
      tasks.push(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''))
    }
    return Promise.all(tasks).then(([lyric, tlyric, rlyric, lxlyric, lyric_raw, tlyric_raw, rlyric_raw, lxlyric_raw]) => {
      const rawlrcInfo = lyric_raw ? {
        lyric: lyric_raw,
        tlyric: tlyric_raw,
        rlyric: rlyric_raw,
        lxlyric: lxlyric_raw,
      } : {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
      }
      return {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
        rawlrcInfo,
      }
    })
  }

  // @ts-expect-error
  return lyricInfo.rawlrcInfo ? lyricInfo : { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
}

export const getCachedLyricInfo = async(musicInfo: LX.Music.MusicInfo): Promise<LX.Player.LyricInfo | null> => {
  let lrcInfo = await getStoreLyric(musicInfo)
  // lrcInfo = {} as unknown as LX.Player.LyricInfo
  if (existTimeExp.test(lrcInfo.lyric)) {
    if (lrcInfo.tlyric != null) {
      // if (musicInfo.lrc.startsWith('\ufeff[id:$00000000]')) {
      //   let str = musicInfo.lrc.replace('\ufeff[id:$00000000]\n', '')
      //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
      // } else if (musicInfo.lrc.startsWith('[id:$00000000]')) {
      //   let str = musicInfo.lrc.replace('[id:$00000000]\n', '')
      //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
      // }

      if (lrcInfo.lxlyric == null) {
        switch (musicInfo.source) { // 以下源支持lxlyric 重新获取
          case 'kg':
          case 'kw':
          case 'mg':
          case 'wy':
          case 'tx':
            break
          default:
            return lrcInfo
        }
      } else if (lrcInfo.rlyric == null) {
        // 以下源支持 rlyric 重新获取
        if (!['wy', 'kg', 'tx'].includes(musicInfo.source)) return lrcInfo
      } else return lrcInfo
    }
    if (musicInfo.source == 'local') return lrcInfo
  }
  return null
}

export const getOnlineOtherSourceMusicUrlByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  url: string
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  const quality = '128k'

  const cachedUrl = await getStoreMusicUrl(musicInfo, quality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, quality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getMusicUrl(toOldMusicInfo(musicInfo), null).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then(({ url }: { url: string }) => {
    return { url, quality, isFromCache: false }
  })
}

export const getOnlineOtherSourceLyricByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  lyricInfo: LX.Music.LyricInfo
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  const lyricInfo = await getCachedLyricInfo(musicInfo)
  if (lyricInfo && !isRefresh) return { lyricInfo, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getLyric(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return { lyricInfo, isFromCache: false }
  })
}

export const getOnlineOtherSourcePicByLocal = async(musicInfo: LX.Music.MusicInfoLocal): Promise<{
  url: string
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  let reqPromise
  try {
    reqPromise = apis('local').getPic(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((url: string) => {
    return { url }
  })
}

export const TRY_QUALITYS_LIST = ['flac24bit', 'flac', '320k'] as const
type TryQualityType = typeof TRY_QUALITYS_LIST[number]
export const getPlayQuality = (highQuality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality => {
  let type: LX.Quality = '128k'
  if (TRY_QUALITYS_LIST.includes(highQuality as TryQualityType)) {
    let list = qualityList.value[musicInfo.source]

    let t = TRY_QUALITYS_LIST
      .slice(TRY_QUALITYS_LIST.indexOf(highQuality as TryQualityType))
      .find(q => musicInfo.meta._qualitys[q] && list?.includes(q))

    if (t) type = t
  }
  return type
}

export const getOnlineOtherSourceMusicUrl = async({ musicInfos, quality, onToggleSource, isRefresh, retryedSource = [], deadline }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
  /** 换源总预算；不传则新建一个。递归尝试下一个音源时沿用同一个 deadline */
  deadline?: SourceDeadline
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')

  const dl = deadline ?? createSourceDeadline()

  let musicInfo: LX.Music.MusicInfoOnline | null = null
  let itemQuality: LX.Quality | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    if (!assertApiSupport(musicInfo.source)) continue
    itemQuality = quality ?? getPlayQuality(appSetting['player.playQuality'], musicInfo)
    if (!musicInfo.meta._qualitys[itemQuality]) continue

    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo || !itemQuality) throw new Error(requestMsg.sourceExhausted)

  // 换源总预算已耗尽：直接止损, 不再为后面的音源等待
  if (dl.expired()) throw new Error(requestMsg.sourceExhausted)

  // Luminous Harmonic: 先一次性扫描全部候选的 URL 缓存 — 原逻辑只看第一个候选的
  // 缓存, 会错过排在后面但已有现成缓存 URL 的候选 (缓存命中是即时的, 省一次网络探测)
  if (!isRefresh) {
    for (const candidate of musicInfos) {
      if (retryedSource.includes(candidate.source) || !assertApiSupport(candidate.source)) continue
      const candidateQuality = quality ?? getPlayQuality(appSetting['player.playQuality'], candidate)
      if (!candidate.meta._qualitys[candidateQuality]) continue
      // 缓存查询也给时限：缓存层异常时不能拖住换源
      const cacheStart = Date.now()
      const cachedUrl = await withTimeout(
        getStoreMusicUrl(candidate, candidateQuality), CACHE_LOOKUP_TIMEOUT).catch(() => null)
      if (cachedUrl) {
        onToggleSource(candidate)
        recordAttempt({ source: candidate.source, result: 'cache', ms: Date.now() - cacheStart, quality: candidateQuality })
        return { url: cachedUrl, musicInfo: candidate, quality: candidateQuality, isFromCache: true }
      }
    }
  }

  const cachedUrl = await withTimeout(
    getStoreMusicUrl(musicInfo, itemQuality), CACHE_LOOKUP_TIMEOUT).catch(() => null)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, musicInfo, quality: itemQuality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), itemQuality).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // 单音源时限 = min(单源超时, 剩余总预算)：一个源绝不会拖住整条换源链路
  const slice = dl.slice()
  const attemptStart = Date.now()
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return withTimeout<{ url: string, type: LX.Quality }>(reqPromise, slice, musicInfo.source)
    .then(({ url, type }) => {
      recordAttempt({
        source: musicInfo!.source,
        result: 'ok',
        ms: Date.now() - attemptStart,
        limit: slice,
        quality: type,
      })
      return { musicInfo, url, quality: type, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    }).catch((err: any) => {
      // 服务器繁忙：不计入换源失败, 交由上层做延时重试（继续换源只会同样繁忙）
      if (err?.message == requestMsg.tooManyRequests) throw err
      const ms = Date.now() - attemptStart
      const isTimeout = typeof err?.message == 'string' && err.message.includes(requestMsg.timeout)
      recordAttempt({
        source: musicInfo!.source,
        result: isTimeout ? 'timeout' : 'fail',
        ms,
        limit: slice,
        message: err?.message,
      })
      console.log(`[换源] ${musicInfo!.source} 失败(${slice}ms 时限):`, err?.message)
      if (dl.expired()) throw new Error(requestMsg.sourceExhausted)
      return getOnlineOtherSourceMusicUrl({ musicInfos, quality, onToggleSource, isRefresh, retryedSource, deadline: dl })
    })
}

/**
 * 获取在线音乐URL
 */
export const handleGetOnlineMusicUrl = async({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource: boolean
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await window.lx.apiInitPromise[0]) throw new Error('source init failed')
  // console.log(musicInfo.source)
  const targetQuality = quality ?? getPlayQuality(appSetting['player.playQuality'], musicInfo)

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), targetQuality).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // 首个音源（当前播放源）同样受单源时限保护 — 它卡住时立刻进入换源, 不干等
  return withTimeout<{ url: string, type: LX.Quality }>(reqPromise, getSourceTimeout(), musicInfo.source)
    .then(({ url, type }) => {
      return { musicInfo, url, quality: type, isFromCache: false }
    }).catch(async(err: any) => {
      console.log(err)
      if (!allowToggleSource || err.message == requestMsg.tooManyRequests) throw err
      onToggleSource()
      // 换源总预算覆盖「找候选」+「逐个试候选」全过程
      const deadline = createSourceDeadline()
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      return withTimeout(getOtherSource(musicInfo), deadline.remaining(), 'findOtherSource').then(otherSource => {
        console.log('find otherSource', otherSource)
        if (otherSource.length) {
          return getOnlineOtherSourceMusicUrl({
            musicInfos: [...otherSource],
            onToggleSource,
            quality,
            isRefresh,
            retryedSource: [musicInfo.source],
            deadline,
          })
        }
        throw err
      })
    })
}


export const getOnlineOtherSourcePicUrl = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(window.i18n.t('toggle_source_failed'))

  if (musicInfo.meta.picUrl && !isRefresh) return { musicInfo, url: musicInfo.meta.picUrl, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourcePicUrl({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌曲封面
 */
export const handleGetOnlinePicUrl = async({ musicInfo, isRefresh, onToggleSource, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      console.log('find otherSource', otherSource)
      if (otherSource.length) {
        return getOnlineOtherSourcePicUrl({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourceLyricInfo = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(window.i18n.t('toggle_source_failed'))

  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return { musicInfo, lyricInfo, isFromCache: true }
  }

  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      lyricInfo,
      musicInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourceLyricInfo({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌词信息
 */
export const handleGetOnlineLyricInfo = async({ musicInfo, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  musicInfo: LX.Music.MusicInfoOnline
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo)) as any).promise
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      musicInfo,
      lyricInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err

    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      console.log('find otherSource', otherSource)
      if (otherSource.length) {
        return getOnlineOtherSourceLyricInfo({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}
