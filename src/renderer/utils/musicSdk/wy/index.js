import leaderboard from './leaderboard'
import { apis } from '../api-source'
import getLyric from './lyric'
import getMusicInfo from './musicInfo'
import musicSearch from './musicSearch'
import songList from './songList'
import hotSearch from './hotSearch'
import comment from './comment'
// import tipSearch from './tipSearch'

const qualityLevels = {
  '128k': 'standard',
  '320k': 'higher',
  flac: 'lossless',
  flac24bit: 'hires',
  wav: 'lossless',
}

const getCookieMusicUrl = async(songInfo, type) => {
  const songId = Number(songInfo.songmid)
  if (!Number.isSafeInteger(songId) || songId <= 0) throw new Error('NETEASE_SONG_ID_INVALID')
  const body = await songList.requestAccountApi('https://music.163.com/api/song/enhance/player/url/v1', {
    ids: `[${songId}]`,
    level: qualityLevels[type] || 'standard',
    encodeType: type === 'flac24bit' ? 'flac' : 'mp3',
  })
  const item = body.data?.[0]
  if (!item?.url) throw new Error('NETEASE_SONG_UNAVAILABLE')
  return { url: item.url, type }
}

const wy = {
  // tipSearch,
  leaderboard,
  musicSearch,
  songList,
  hotSearch,
  comment,
  getMusicUrl(songInfo, type) {
    return {
      promise: getCookieMusicUrl(songInfo, type).catch(async(err) => {
        try {
          return await apis('wy').getMusicUrl(songInfo, type).promise
        } catch {
          throw err
        }
      }),
    }
  },
  getLyric(songInfo) {
    return getLyric(songInfo.songmid)
  },
  getPic(songInfo) {
    const requestObj = getMusicInfo(songInfo.songmid)
    return requestObj.promise.then(info => info.al.picUrl)
  },
  getMusicDetailPageUrl(songInfo) {
    return `https://music.163.com/#/song?id=${songInfo.songmid}`
  },
}

export default wy
