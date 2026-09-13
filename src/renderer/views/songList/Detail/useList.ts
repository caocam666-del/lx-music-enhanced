import { ref } from '@common/utils/vueTools'
// import { useI18n } from '@renderer/plugins/i18n'
// import { } from '@renderer/store/search/state'
import { getAndSetListDetail } from '@renderer/store/songList/action'
import { listDetailInfo } from '@renderer/store/songList/state'
import { playSongListDetail } from './action'

export default () => {
  const listRef = ref<any>(null)

  // Luminous Harmonic: 记录列表标识 — 只有切换歌单/翻页才滚到顶部, refresh 保留浏览位置
  let lastListKey = ''

  const getListData = async(source: LX.OnlineSource, id: string, page: number, refresh: boolean) => {
    const key = `${source}__${id}__${page}`
    const shouldScrollTop = key !== lastListKey
    lastListKey = key
    await getAndSetListDetail(id, source, page, refresh).then(() => {
      if (!shouldScrollTop) return
      setTimeout(() => {
        if (listRef.value) listRef.value.scrollToTop()
      })
    })
  }

  const handlePlayList = (index: number) => {
    void playSongListDetail(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index)
  }


  return {
    listRef,
    listDetailInfo,
    getListData,
    handlePlayList,
  }
}
