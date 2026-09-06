/**
 * 酷狗音乐用户歌单拉取（主进程，导入歌单用）。
 * 逻辑移植自 Mineradio（XxHuberrr/Mineradio，GPL-3.0）kugou-api.js，纯自用集成。
 * 登录方式：从 kugou.com 网页登录后的 Cookie 粘贴（需含 userid/KugooID + token）。
 * 导入的歌曲以 source 'kg' 存储，由应用内置酷狗源直接播放。
 */
import crypto from 'node:crypto'
import http from 'node:http'
import https from 'node:https'

const KUGOU_GATEWAY = 'https://gateway.kugou.com'
const KUGOU_WEB_APPID = 1014
// H5 网关签名盐（酷狗公开 web 端常量）
const KUGOU_H5_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
const KUGOU_H5_SRC_APPID = '2919'
const KUGOU_H5_CLIENTVER = '20000'
const KUGOU_HEADERS = {
  Referer: 'https://www.kugou.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}
const KUGOU_H5_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ---------- 基础工具 ----------

const parseCookieString = (cookie: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  String(cookie || '').split(';').forEach(part => {
    const index = part.indexOf('=')
    if (index <= 0) return
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  })
  return out
}

const parseKuGooCompound = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  let text = String(raw || '').trim()
  if (!text) return out
  try { text = decodeURIComponent(text) } catch (_) { /* 原样解析 */ }
  text.split('&').forEach(part => {
    const index = part.indexOf('=')
    if (index <= 0) return
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  })
  return out
}

export interface KugouAuth {
  userid: string
  token: string
  mid: string
  dfid: string
  nickname: string
  loggedIn: boolean
  playbackReady: boolean
}

export const extractKugouAuth = (cookie: unknown): KugouAuth => {
  const obj = parseCookieString(cookie)
  const kugoo = parseKuGooCompound(obj.KuGoo || obj.kugou || obj.Kugou || '')
  const userid = String(
    obj.userid || obj.UserId || obj.KugooID || obj.kugouID ||
    kugoo.KugooID || kugoo.kugouID || kugoo.userid || kugoo.uid || '',
  ).replace(/\D/g, '')
  const token = String(obj.token ?? obj.Token ?? obj.t ?? obj.T ?? kugoo.t ?? kugoo.token ?? '').trim()
  const fallbackMid = crypto.createHash('md5')
    .update('lx-music-kugou:' + String(userid ?? token ?? obj.KuGoo ?? obj.kugou ?? 'guest'))
    .digest('hex')
  const mid = String(obj.kg_mid ?? obj.KG_MID ?? obj.KUGOU_API_MID ?? obj.mid ?? fallbackMid).trim()
  const dfid = String(obj.kg_dfid ?? obj.KG_DFID ?? obj.dfid ?? obj.DFID ?? '-').trim()
  const nickname = String(kugoo.NickName || kugoo.nickname || obj.NickName || obj.nickname || obj.UserName || obj.username || '').trim()
  const loggedIn = !!(userid && userid !== '0') || !!(obj.KuGoo || obj.kugou || obj.Kugou)
  const playbackReady = !!(userid && userid !== '0' && token)
  return { userid, token, mid, dfid, nickname, loggedIn, playbackReady }
}

export const kugouCookieHasLogin = (cookie: unknown): boolean => extractKugouAuth(cookie).loggedIn

const stripKugouHtml = (text: unknown): string =>
  String(text || '').replace(/<[^>]+>/g, '').trim()

const kugouCoverUrl = (raw: unknown, size = 240): string =>
  String(raw || '').trim().replace(/\{size\}/g, String(size))

// ---------- 请求 ----------

async function requestJson(targetUrl: string, opts: {
  method?: string
  headers?: Record<string, string>
  timeoutMs?: number
}, bodyText?: string): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    let u: URL
    try {
      u = new URL(targetUrl)
    } catch (err) {
      reject(err)
      return
    }
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(u, {
      method: opts.method ?? 'GET',
      headers: opts.headers ?? {},
    }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => { chunks.push(chunk as Buffer) })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        try {
          resolve(JSON.parse(text))
        } catch (e) {
          const err = new Error('Invalid JSON from Kugou API') as Error & { body?: string }
          err.body = text
          reject(err)
        }
      })
    })
    req.setTimeout(opts.timeoutMs ?? 12000, () => { req.destroy(new Error('Request timeout')) })
    req.on('error', reject)
    if (bodyText) req.write(bodyText)
    req.end()
  })
}

const signatureH5Params = (params: Record<string, unknown>, bodyObj: unknown): string => {
  const parts = Object.keys(params).sort().map(key => `${key}=${String(params[key])}`)
  if (bodyObj && typeof bodyObj === 'object') parts.push(JSON.stringify(bodyObj))
  return crypto.createHash('md5').update(`${KUGOU_H5_SALT}${parts.join('')}${KUGOU_H5_SALT}`).digest('hex')
}

const buildKugouH5Params = (auth: KugouAuth, extra?: Record<string, unknown>): Record<string, unknown> => ({
  srcappid: KUGOU_H5_SRC_APPID,
  clientver: KUGOU_H5_CLIENTVER,
  clienttime: Date.now(),
  mid: auth.mid,
  uuid: Date.now(),
  dfid: auth.dfid || '-',
  appid: KUGOU_WEB_APPID,
  token: auth.token || '',
  userid: auth.userid ? Number(auth.userid) : 0,
  ...extra,
})

const buildKugouRequestCookie = (cookie: string): string => {
  const obj = parseCookieString(cookie)
  const mid = obj.kg_mid ?? obj.KG_MID ?? extractKugouAuth(cookie).mid
  const dfid = obj.kg_dfid ?? obj.KG_DFID ?? '-'
  const parts = []
  if (cookie) parts.push(String(cookie).trim())
  if (!obj.kg_mid && !obj.KG_MID) parts.push('kg_mid=' + mid)
  if (!obj.kg_dfid && !obj.KG_DFID) parts.push('kg_dfid=' + dfid)
  const merged = parseCookieString(parts.join('; '))
  return Object.keys(merged).map(k => `${k}=${merged[k]}`).join('; ')
}

async function kugouH5GatewayRequest(apiPath: string, opts: {
  cookie: string
  router: string
  params?: Record<string, unknown>
  body?: Record<string, unknown>
  method?: string
}): Promise<Record<string, any>> {
  const auth = extractKugouAuth(opts.cookie)
  if (!auth.playbackReady) throw new Error('KUGOU_AUTH_REQUIRED')
  const bodyObj = opts.body ?? null
  const bodyText = bodyObj == null ? '' : JSON.stringify(bodyObj)
  const params = buildKugouH5Params(auth, opts.params)
  params.signature = signatureH5Params(params, bodyObj)
  const u = new URL(apiPath, KUGOU_GATEWAY)
  Object.keys(params).forEach(key => { u.searchParams.set(key, String(params[key])) })
  const headers: Record<string, string> = {
    ...KUGOU_HEADERS,
    'User-Agent': KUGOU_H5_UA,
    Cookie: buildKugouRequestCookie(opts.cookie),
  }
  headers['x-router'] = opts.router
  const json = await requestJson(u.toString(), {
    method: opts.method ?? (bodyObj == null ? 'GET' : 'POST'),
    headers,
  }, bodyText || undefined)
  if (json && Number(json.status) === 0) {
    throw new Error(json.error || json.msg || json.message || 'KUGOU_GATEWAY_FAILED')
  }
  return json
}

// ---------- 歌单 ----------

export interface KugouPlaylistInfo {
  id: string
  listId: string
  name: string
  cover: string
  trackCount: number
}

export interface KugouTrackInfo {
  songId: string
  hash: string
  name: string
  singer: string
  albumId: string
  albumName: string
  interval: string
  cover: string
  qualitys: Array<{ type: string, hash?: string, size?: number | null }>
}

export interface KugouLibraryResult {
  userId: string
  nickname: string
  playlists: KugouPlaylistInfo[]
}

export const parseKugouListId = (playlistId: unknown): string => {
  const id = String(playlistId || '').trim()
  if (!id) return ''
  if (/^\d+$/.test(id)) return id
  if (id.startsWith('collection_')) {
    const parts = id.split('_')
    if (parts.length >= 5 && parts[3]) return parts[3]
  }
  const matched = id.match(/collection_\d+_\d+_(\d+)_\d+/)
  return matched ? matched[1] : id
}

const extractKugouGatewayPlaylistLists = (data: Record<string, any>): Array<Record<string, any>> => {
  data = (data?.data) || data || {}
  if (Array.isArray(data.info)) return data.info
  const info = data.info ?? data
  const out: Array<Record<string, any>> = []
  for (const arr of [info.collect, info.love, info.self, info.list, data.list]) {
    if (Array.isArray(arr)) out.push(...arr)
  }
  return out
}

const mapKugouPlaylistItem = (item: Record<string, any>): KugouPlaylistInfo => {
  const id = item.global_collection_id || item.specialid || item.listid || item.list_id || item.id || ''
  const listId = item.list_create_listid || item.listid || parseKugouListId(id) || ''
  return {
    id: String(id || listId),
    listId: String(listId || ''),
    name: stripKugouHtml(item.name || item.listname || item.specialname || item.title || '酷狗歌单'),
    cover: kugouCoverUrl(item.pic || item.img || item.imgurl || item.sizable_cover || '', 240),
    trackCount: Number(item.count || item.m_count || item.song_count || item.total || item.list_count || 0) || 0,
  }
}

const mapKugouTrack = (item: Record<string, any>): KugouTrackInfo | null => {
  const singers = Array.isArray(item.singerinfo) ? item.singerinfo : (Array.isArray(item.Singers) ? item.Singers : [])
  const artistLabel = singers.map(s => s.name || s.SingerName).filter(Boolean).join(' / ')
  let name = stripKugouHtml(item.name || item.SongName || item.filename || '')
  const rawName = name
  name = name.replace(/\.(mp3|flac|m4a|wav|ape|ogg)$/i, '').trim()
  if (artistLabel && name.startsWith(artistLabel)) {
    name = name.slice(artistLabel.length).replace(/^[\s\-–—]+/, '').trim()
  }
  const songId = String(
    item.mixsongid ?? item.MixSongID ?? item.album_audio_id ?? item.Audioid ?? item.audio_id ?? '',
  )
  const hash = String(item.hash || item.FileHash || '')
  if (!songId || !name || !hash) return null
  const albumId = String((item.albuminfo?.id) || item.album_id || item.AlbumID || '')
  const albumName = String((item.albuminfo?.name) || item.album_name || item.AlbumName || '')
  const timelen = Number(item.duration || (item.timelen ? Math.round(Number(item.timelen) / 1000) : 0)) || 0
  const interval = timelen > 0
    ? `${String(Math.floor(timelen / 60)).padStart(2, '0')}:${String(timelen % 60).padStart(2, '0')}`
    : ''
  const cover = kugouCoverUrl(
    item.cover || item.img || item.Image || (item.trans_param?.union_cover) ||
    (item.albuminfo && (item.albuminfo.sizable_cover || item.albuminfo.img)) || '',
    240,
  )
  // 音质 hash: 列表接口给到多少存多少, 至少 128k 保底可播
  const qualityMap: Array<{ type: string, hash?: string, size?: number | null }> = []
  if (hash) qualityMap.push({ type: '128k', hash })
  const hqHash = item.hqhash || item.HQFileHash
  if (hqHash) qualityMap.push({ type: '320k', hash: hqHash })
  const sqHash = item.sqhash || item.SQFileHash
  if (sqHash) qualityMap.push({ type: 'flac', hash: sqHash })
  const resHash = item.resfilehash || item.ResFileHash
  if (resHash) qualityMap.push({ type: 'flac24bit', hash: resHash })
  return {
    songId,
    hash,
    name: name || stripKugouHtml(rawName),
    singer: artistLabel || String(item.SingerName || item.singername || '') || '未知歌手',
    albumId,
    albumName,
    interval,
    cover,
    qualitys: qualityMap,
  }
}

const KUGOU_AUTH_REQUIRED_MSG = 'KUGOU_AUTH_REQUIRED'

export const getKugouLibrary = async(cookieText: string): Promise<KugouLibraryResult> => {
  const auth = extractKugouAuth(cookieText)
  if (!auth.playbackReady) throw new Error(KUGOU_AUTH_REQUIRED_MSG)
  const json = await kugouH5GatewayRequest('/v7/get_all_list', {
    method: 'POST',
    cookie: cookieText,
    router: 'cloudlist.service.kugou.com',
    params: { plat: 1 },
    body: {
      userid: Number(auth.userid),
      token: auth.token,
      total_ver: 979,
      type: 2,
      page: 1,
      pagesize: 50,
    },
  })
  const data = (json?.data) || {}
  const lists = extractKugouGatewayPlaylistLists(data)
  const playlists = lists.map(mapKugouPlaylistItem).filter(pl => pl.id && pl.name)
  if (!playlists.length) throw new Error('KUGOU_PLAYLIST_EMPTY')
  return {
    userId: auth.userid,
    nickname: auth.nickname || String(lists[0]?.nickname || lists[0]?.username || '') || '',
    playlists,
  }
}

export const getKugouPlaylistTracks = async(
  cookieText: string,
  playlistId: string,
): Promise<KugouTrackInfo[]> => {
  const auth = extractKugouAuth(cookieText)
  if (!auth.playbackReady) throw new Error(KUGOU_AUTH_REQUIRED_MSG)
  const listid = parseKugouListId(playlistId)
  if (!listid) throw new Error('KUGOU_PLAYLIST_ID_REQUIRED')
  const pagesize = 50
  const tracks: KugouTrackInfo[] = []
  let total = 0
  // 酷狗原始顺序是最早添加在前, 拉全量后反转为"最新添加在前"
  for (let round = 0; round < 100; round++) {
    const json = await kugouH5GatewayRequest('/v4/get_list_all_file', {
      method: 'POST',
      cookie: cookieText,
      router: 'cloudlist.service.kugou.com',
      params: { plat: 1 },
      body: {
        listid: Number(listid) || listid,
        userid: Number(auth.userid),
        area_code: 1,
        show_relate_goods: 0,
        pagesize,
        allplatform: 1,
        show_cover: 1,
        type: 0,
        token: auth.token,
        page: round + 1,
      },
    })
    const data = (json?.data) || {}
    const chunk = data.info || data.songs || data.lists || data.file || []
    const list = Array.isArray(chunk) ? chunk : (Array.isArray(chunk.file) ? chunk.file : [])
    total = Number(data.count || 0) || total
    const mapped = list.map((item: Record<string, any>) => mapKugouTrack(item)).filter(Boolean) as KugouTrackInfo[]
    if (!mapped.length) break
    tracks.push(...mapped)
    if (mapped.length < pagesize || (total && tracks.length >= total)) break
  }
  tracks.reverse()
  if (!tracks.length) throw new Error('KUGOU_PLAYLIST_TRACKS_EMPTY')
  return tracks
}
