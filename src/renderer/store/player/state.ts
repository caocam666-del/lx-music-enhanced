import { reactive, shallowReactive, ref } from '@common/utils/vueTools'

export interface PlayerMusicInfo {
  id: string | null
  pic: string | null
  lrc: string | null
  tlrc: string | null
  rlrc: string | null
  lxlrc: string | null
  rawlrc: string | null
  // url: string | null
  name: string
  singer: string
  album: string
}

export const musicInfo = window.lxData.musicInfo = reactive<PlayerMusicInfo>({
  id: null,
  pic: null,
  lrc: null,
  tlrc: null,
  rlrc: null,
  lxlrc: null,
  rawlrc: null,
  // url: null,
  name: '',
  singer: '',
  album: '',
})

export const isPlay = ref(false)

export const status = window.lxData.status = ref('')

export const statusText = ref('')

export const isPlayerError = ref(false)

export const isShowPlayerDetail = ref(false)

// Luminous Harmonic: 详情页封面取色主色（"r, g, b"），供详情页与主播放栏共享，
// 让进度条/按钮在封面取色模式下跟随封面主题色
export const coverAccent = ref('102, 126, 255')

// Luminous Harmonic: 封面 k-means 调色板（4 色，"r, g, b" 数组），驱动详情页多层流光背景
export const coverPalette = ref<string[]>([])

export const isShowPlayComment = ref(false)

export const isShowLrcSelectContent = ref(false)

export const playMusicInfo = shallowReactive<{
  /**
   * 当前播放歌曲的列表 id
   */
  musicInfo: LX.Player.PlayMusicInfo['musicInfo'] | null
  /**
   * 当前播放歌曲的列表 id
   */
  listId: LX.Player.PlayMusicInfo['listId'] | null
  /**
   * 是否属于 “稍后播放”
   */
  isTempPlay: boolean
}>({
  listId: null,
  musicInfo: null,
  isTempPlay: false,
})
export const playInfo = shallowReactive<LX.Player.PlayInfo>({
  playIndex: -1,
  playerListId: null,
  playerPlayIndex: -1,
})


export const playedList = window.lxData.playedList = shallowReactive<LX.Player.PlayMusicInfo[]>([])

export const tempPlayList = shallowReactive<LX.Player.PlayMusicInfo[]>([])

window.lxData.playInfo = playInfo
window.lxData.playMusicInfo = playMusicInfo
