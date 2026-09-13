<template>
  <div :class="$style.container">
    <material-online-list
      ref="listRef"
      :page="listDetailInfo.page"
      :limit="listDetailInfo.limit"
      :total="listDetailInfo.total"
      :list="listDetailInfo.list"
      :no-item="listDetailInfo.noItemLabel"
      @show-menu="hideListsMenu"
      @play-list="handlePlayList"
      @toggle-page="togglePage"
    />
  </div>
</template>

<script setup lang="ts">
import { watch } from '@common/utils/vueTools'
import useList from './useList'
import { useRoute } from '@common/utils/vueRouter'


const props = defineProps<{
  source: LX.OnlineSource
  boardId?: string
}>()

const emit = defineEmits(['show-menu'])

const {
  listRef,
  listDetailInfo,
  getList,
  handlePlayList,
} = useList()

const route = useRoute()

// Luminous Harmonic: 直接监听 route.query.boardId — props.boardId 在首次挂载时
// 可能还是 undefined (父组件 verifyQueryParams 异步设置), 时序竞态导致歌曲列表
// 永远不加载 (用户反馈排行榜不显示). route.query 是确定性的数据源.
watch(() => route.query.boardId, (boardId) => {
  if (!boardId) return
  getList(String(boardId), 1)
}, { immediate: true })


const hideListsMenu = () => {
  emit('show-menu')
}

const togglePage = (page: number) => {
  getList(listDetailInfo.id, page)
}

const hideMenu = () => {
  listRef.value.handleMenuClick()
}

defineExpose({ hideMenu })


</script>


<style lang="less" module>
.container {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.list {
  overflow: hidden;
  height: 100%;
  flex: auto;
}

</style>
