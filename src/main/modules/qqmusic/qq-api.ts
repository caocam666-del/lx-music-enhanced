/**
 * QQ 音乐用户歌单拉取（主进程，导入歌单用）。
 * 逻辑移植自 Mineradio（XxHuberrr/Mineradio，GPL-3.0）server.js 的 QQ 部分，纯自用集成。
 * 登录方式：从 y.qq.com 网页登录后的 Cookie 粘贴（需含 uin + qm_keyst 播放票据）。
 * 导入的歌曲以 source 'tx' 存储，由应用内置 QQ 源直接播放。
 */
import http from 'node:http'
import https from 'node:https'

const QQ_HEADERS = {
  Referer: 'https://y.qq.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}
const QQ_PLAYLIST_PAGE_SIZE = 200
const QQ_PLAYLIST_MAX_PAGES = 25

// ---------- 基础工具 ----------

const parseCookieString = (cookie: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  String(cookie ?? '').split(';').forEach(part => {
    const index = part.indexOf('=')
    if (index <= 0) return
    out[part.slice(0, index).trim()] = part.slice(index + 1).trim()
  })
  return out
}

const serializeCookieObject = (obj: Record<string, string>): string =>
  Object.keys(obj).filter(k => obj[k]).map(k => `${k}=${obj[k]}`).join('; ')

const normalizeQQUin = (raw: unknown): string => {
  const text = String(raw ?? '').trim()
  return text || ''
}

export const normalizeQQCookieInput = (cookieText: unknown): string => {
  const obj = parseCookieString(cookieText)
  if ((obj.wxopenid || Number(obj.login_type) === 2) && obj.wxuin) obj.uin = obj.wxuin
  if (!obj.uin && (obj.qqmusic_uin || obj.p_uin)) obj.uin = obj.qqmusic_uin || obj.p_uin
  if (obj.uin) obj.uin = normalizeQQUin(obj.uin)
  return serializeCookieObject(obj)
}

const qqCookieMusicKey = (obj: Record<string, string>): string =>
  obj.qm_keyst ?? obj.qqmusic_key ?? obj.music_key ?? obj.p_skey ?? obj.skey ??
  obj.psrf_qqaccess_token ?? obj.psrf_qqrefresh_token ?? obj.wxrefresh_token ?? obj.wxskey ?? ''

const qqCookiePlaybackKey = (obj: Record<string, string>): string =>
  obj.qm_keyst ?? obj.qqmusic_key ?? obj.music_key ?? obj.wxskey ?? ''

const getQQUin = (obj: Record<string, string>): string => {
  const raw = obj.uin ?? obj.qqmusic_uin ?? obj.wxuin ?? obj.p_uin
  return normalizeQQUin(raw)
}

export interface QQAuth {
  uin: string
  loggedIn: boolean
  playbackReady: boolean
}

export const extractQQAuth = (cookie: unknown): QQAuth => {
  const obj = parseCookieString(cookie)
  const uin = getQQUin(obj)
  const loggedIn = !!uin && !!qqCookieMusicKey(obj)
  const playbackReady = !!uin && !!qqCookiePlaybackKey(obj)
  return { uin, loggedIn, playbackReady }
}

export const qqCookieHasLogin = (cookie: unknown): boolean => extractQQAuth(cookie).playbackReady

const qqAlbumCover = (albumMid: unknown, size = 300): string => {
  const mid = String(albumMid ?? '')
  if (!mid) return ''
  const px = size ?? 300
  return `https://y.qq.com/music/photo_new/T002R${px}x${px}M000${mid}.jpg?max_age=2592000`
}

// ---------- 请求 ----------

async function requestText(targetUrl: string, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request(u, { method: 'GET', headers }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => { chunks.push(chunk as Buffer) })
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        // 部分老接口可能返回 jsonp 包裹
        const jsonpMatch = text.match(/^\w+\(([\s\S]*)\);?\s*$/)
        resolve(jsonpMatch ? jsonpMatch[1] : text)
      })
    })
    req.setTimeout(12000, () => { req.destroy(new Error('Request timeout')) })
    req.on('error', reject)
    req.end()
  })
}

async function qqGetJSON(targetUrl: string, params: Record<string, unknown>, cookie: string, extraHeaders?: Record<string, string>): Promise<Record<string, any>> {
  const u = new URL(targetUrl)
  Object.keys(params ?? {}).forEach(k => {
    if (params[k] != null) u.searchParams.set(k, String(params[k]))
  })
  const text = await requestText(u.toString(), { ...QQ_HEADERS, ...(extraHeaders ?? {}), Cookie: cookie })
  try {
    return JSON.parse(text)
  } catch (e) {
    const err = new Error('Invalid JSON from QQ Music API') as Error & { body?: string }
    err.body = text
    throw err
  }
}

// ---------- 歌单 ----------

export interface QQPlaylistInfo {
  id: string
  name: string
  cover: string
  trackCount: number
}

export interface QQTrackInfo {
  songmid: string
  songId: string
  strMediaMid: string
  name: string
  singer: string
  albumId: string
  albumMid: string
  albumName: string
  interval: string
  cover: string
  qualitys: Array<{ type: string, size: number | null }>
}

export interface QQLibraryResult {
  userId: string
  nickname: string
  playlists: QQPlaylistInfo[]
}

const mapQQPlaylistItem = (pl: Record<string, any>): QQPlaylistInfo => ({
  id: String(pl.dissid || pl.tid || pl.dirid || pl.id || pl.diss_id || ''),
  name: String(pl.diss_name || pl.name || pl.title || 'QQ 歌单'),
  cover: String(pl.diss_cover || pl.logo || pl.picurl || pl.cover || ''),
  trackCount: Number(pl.song_cnt || pl.songnum || pl.total_song_num || pl.song_count || 0) || 0,
})

const mapQQArtists = (singers: unknown): string[] => {
  if (!Array.isArray(singers)) return []
  return singers.map((s: Record<string, any>) => String(s.name || '')).filter(Boolean)
}

const mapQQTrack = (raw: Record<string, any>): QQTrackInfo | null => {
  const track = (raw.songid || raw.songmid || raw.mid || raw.name ? raw : (raw.track_info || raw.songInfo || raw.songinfo || raw.song || {})) as Record<string, any>
  const album = (track.album || {}) as Record<string, any>
  const artists = mapQQArtists(track.singer ?? track.singers ?? [])
  const mid = String(track.mid ?? track.songmid ?? raw.mid ?? raw.songmid ?? '')
  const name = String(track.name ?? track.songname ?? raw.songname ?? '')
  if (!mid || !name) return null
  const albumMid = String(album.mid ?? track.albummid ?? raw.albummid ?? '')
  const durationSec = Number(track.interval ?? raw.interval) || 0
  // 音质按文件大小字段判定, 未提供时至少给 128k
  const file = (track.file ?? {}) as Record<string, unknown>
  const sizeOf = (key: string): number | null => {
    const n = Number(file[key])
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const qualitys: Array<{ type: string, size: number | null }> = [{ type: '128k', size: sizeOf('size_128mp3') }]
  const size320 = sizeOf('size_320mp3')
  if (size320 != null) qualitys.push({ type: '320k', size: size320 })
  const sizeFlac = sizeOf('size_flac')
  if (sizeFlac != null) qualitys.push({ type: 'flac', size: sizeFlac })
  const size24 = sizeOf('size_flac24bit') ?? sizeOf('size_24bit')
  if (size24 != null) qualitys.push({ type: 'flac24bit', size: size24 })
  return {
    songmid: mid,
    songId: String(track.id ?? track.songid ?? raw.id ?? raw.songid ?? ''),
    strMediaMid: String((track.file?.media_mid) ?? track.strMediaMid ?? track.media_mid ?? raw.strMediaMid ?? ''),
    name,
    singer: artists.join(' / ') || String(track.singername ?? raw.singername ?? '') || '未知歌手',
    albumId: String(album.id ?? ''),
    albumMid,
    albumName: String(album.name ?? album.title ?? track.albumname ?? raw.albumname ?? ''),
    interval: durationSec > 0
      ? `${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`
      : '',
    cover: qqAlbumCover(albumMid, 300),
    qualitys,
  }
}

const fetchQQCreatedPlaylists = async(uin: string, cookie: string): Promise<Array<Record<string, any>>> => {
  const out: Array<Record<string, any>> = []
  for (let page = 0; page < QQ_PLAYLIST_MAX_PAGES; page++) {
    const sin = page * QQ_PLAYLIST_PAGE_SIZE
    const body = await qqGetJSON('https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss', {
      hostUin: 0,
      hostuin: uin,
      sin,
      size: QQ_PLAYLIST_PAGE_SIZE,
      g_tk: 5381,
      loginUin: uin,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
    }, cookie, { Referer: 'https://y.qq.com/portal/profile.html' })
    const rows = body?.data && Array.isArray(body.data.disslist) ? body.data.disslist : []
    out.push(...rows)
    if (rows.length < QQ_PLAYLIST_PAGE_SIZE) break
  }
  return out
}

const fetchQQCollectedPlaylists = async(uin: string, cookie: string): Promise<Array<Record<string, any>>> => {
  const out: Array<Record<string, any>> = []
  for (let page = 0; page < QQ_PLAYLIST_MAX_PAGES; page++) {
    const sin = page * QQ_PLAYLIST_PAGE_SIZE
    const body = await qqGetJSON('https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', {
      ct: 20,
      cid: 205360956,
      userid: uin,
      reqtype: 3,
      sin,
      ein: sin + QQ_PLAYLIST_PAGE_SIZE - 1,
    }, cookie, { Referer: 'https://y.qq.com/portal/profile.html' })
    const rows = body?.data && Array.isArray(body.data.cdlist) ? body.data.cdlist : []
    out.push(...rows)
    if (rows.length < QQ_PLAYLIST_PAGE_SIZE) break
  }
  return out
}

export const getQQLibrary = async(cookieText: string): Promise<QQLibraryResult> => {
  const auth = extractQQAuth(cookieText)
  if (!auth.playbackReady) throw new Error('QQ_AUTH_REQUIRED')
  const [created, collected] = await Promise.all([
    fetchQQCreatedPlaylists(auth.uin, cookieText),
    fetchQQCollectedPlaylists(auth.uin, cookieText),
  ])
  const playlists: QQPlaylistInfo[] = []
  const seen = new Set<string>()
  for (const item of [...created, ...collected]) {
    const info = mapQQPlaylistItem(item)
    if (!info.id || !info.name || seen.has(info.id)) continue
    seen.add(info.id)
    playlists.push(info)
  }
  if (!playlists.length) throw new Error('QQ_PLAYLIST_EMPTY')
  let nickname = ''
  try {
    const profile = await qqGetJSON('https://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg', {
      cid: 205360838,
      userid: auth.uin,
      loginUin: auth.uin,
      g_tk: 5381,
      platform: 'yqq.json',
    }, cookieText)
    nickname = String(profile?.data?.creator?.nick ?? '')
  } catch (_) { /* 昵称获取失败不阻塞 */ }
  return { userId: auth.uin, nickname, playlists }
}

export const getQQPlaylistTracks = async(cookieText: string, playlistId: string): Promise<QQTrackInfo[]> => {
  const auth = extractQQAuth(cookieText)
  if (!auth.playbackReady) throw new Error('QQ_AUTH_REQUIRED')
  const pid = String(playlistId ?? '').trim()
  if (!pid) throw new Error('QQ_PLAYLIST_ID_REQUIRED')
  const result = await qqGetJSON('https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
    type: 1,
    utf8: 1,
    disstid: pid,
    song_begin: 0,
    loginUin: auth.uin,
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'utf-8',
    notice: 0,
    platform: 'yqq.json',
    needNewCode: 0,
  }, cookieText, { Referer: 'https://y.qq.com/n/yqq/playlist' })
  const detail = result?.cdlist?.[0] ? result.cdlist[0] : {}
  const rawTracks = Array.isArray(detail.songlist) ? detail.songlist : []
  const tracks = rawTracks.map((item: Record<string, any>) => mapQQTrack(item)).filter(Boolean) as QQTrackInfo[]
  if (!tracks.length) throw new Error('QQ_PLAYLIST_TRACKS_EMPTY')
  return tracks
}
