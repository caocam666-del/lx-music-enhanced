import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/leaderboard/action'
import { listDetailInfo } from '@renderer/store/leaderboard/state'
import { playSongListDetail } from '../action'

export default () => {
  const listRef = ref<any>(null)

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.list, index)
  }

  // Luminous Harmonic: 记录上次列表标识 (榜单id + 页码) — 只有切换榜单/翻页才滚到顶部.
  // 此前每次 getList 后都 scrollToTop, 用户下滑浏览后点击歌曲会被强制拽回列表顶端
  // (需再次下滑才能点到目标项).
  let lastListKey = ''

  const getList = (id: string, page: number) => {
    const key = `${id}__${page}`
    const shouldScrollTop = key !== lastListKey
    lastListKey = key
    void getAndSetListDetail(id, page).then(() => {
      if (!shouldScrollTop) return
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    })
  }

  return {
    listRef,
    listDetailInfo,
    getList,
    handlePlayList,
  }
}
