/**
 * Luminous Harmonic: 播放详情页右栏视图状态（歌词/播放列表 两态循环）
 * 共享模块 — 详情页主容器(视图切换渲染) 与 底部工具栏按钮(ControlBtns) 共用,
 * 使工具栏上的切换按钮与实际视图保持同步。
 * 评论视图由评论按钮进出: 打开评论前记住当前主视图, 关闭评论后还原。
 */
import { ref, watch } from '@common/utils/vueTools'
import { isShowPlayComment } from '@renderer/store/player/state'

export const detailView = ref('lyric')
let lastMainView = 'lyric'

export const toggleDetailView = () => {
  // 评论视图下点击切回歌词；其余在 歌词/播放列表 两态间循环
  detailView.value = detailView.value === 'lyric' ? 'playlist' : 'lyric'
}

export const useDetailCommentViewSync = () => {
  watch(isShowPlayComment, show => {
    if (show) {
      if (detailView.value !== 'comment') lastMainView = detailView.value
      detailView.value = 'comment'
    } else if (detailView.value === 'comment') {
      detailView.value = lastMainView
    }
  })
}
