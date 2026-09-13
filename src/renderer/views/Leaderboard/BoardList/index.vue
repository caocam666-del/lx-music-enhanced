<template>
  <ul ref="dom_lists_list" class="scroll" :class="$style.listsContent">
    <li
      v-for="(item, index) in list"
      :key="item.id" :class="[$style.listsItem, { [$style.active]: item.id == boardId }, { [$style.clicked]: rightClickItemIndex == index }]"
      :aria-label="item.name" @click="handleToggleList(item.id)" @contextmenu="handleRigthClick($event, index)"
    >
      <span :class="$style.listsLabel">
        <svg-icon v-if="item.id == boardId" name="angle-right-solid" :class="$style.activeIcon" />
        {{ item.name }}
      </span>
    </li>
  </ul>
  <base-menu
    v-model="isShowMenu"
    :menus="menus"
    :xy="menuLocation"
    item-name="name"
    @menu-click="handleMenuClick"
  />
</template>

<script setup>
import { watch, shallowReactive, ref } from '@common/utils/vueTools'
import { getBoardsList, setBoard } from '@renderer/store/leaderboard/action'
import musicSdk from '@renderer/utils/musicSdk'
import { boards } from '@renderer/store/leaderboard/state'
import useMenu from './useMenu'
import { useRouter, useRoute } from '@common/utils/vueRouter'

const props = defineProps({
  source: {
    type: String,
    required: true,
  },
  boardId: {
    type: [String, undefined],
    default: undefined,
  },
})

const emit = defineEmits(['show-menu'])

const router = useRouter()
const route = useRoute()

const list = shallowReactive([])
const currentSource = ref('')
const rightClickItemIndex = ref(-1)

const handleToggleList = (id) => {
  console.log('[LB-DIAG] handleToggleList', id, 'source=' + (currentSource.value || props.source))
  router.replace({
    path: route.path,
    query: {
      source: currentSource.value || props.source,
      boardId: id,
    },
  }).then(() => {
    console.log('[LB-DIAG] replace done', route.query.boardId)
  }).catch((e) => {
    console.log('[LB-DIAG] replace FAILED', e && (e.message || e))
  })
}

const {
  menus,
  menuLocation,
  isShowMenu,
  showMenu,
  menuClick,
} = useMenu({ emit, list })

const handleRigthClick = (event, index) => {
  rightClickItemIndex.value = index
  showMenu(event, index)
}
const handleMenuClick = (action) => {
  if (rightClickItemIndex.value < 0) return
  let index = rightClickItemIndex.value
  rightClickItemIndex.value = -1
  menuClick(action, index, props.source)
}


watch(() => props.source, async(source) => {
  // const source = (await getLeaderboardSetting()).source as LX.OnlineSource
  // Luminous Harmonic: 自给自足 — props.source 无效时回退到 'kw' (内置榜单),
  // 不再依赖父组件时序: 此前 source 空值挂载后永远空白 (用户反馈排行榜不显示)
  const src = source && musicSdk[source]?.leaderboard ? source : 'kw'
  currentSource.value = src
  let boardList = boards[src]
  if (boardList == null) setBoard(boardList = await getBoardsList(src), src)
  list.splice(0, list.length, ...boardList.list)
  console.log('[LB-DIAG] boards loaded', boardList.list.length)
  // Luminous Harmonic: 自动选中第一个榜前, 同时检查路由 query — 重挂载瞬间
  // 父组件的 boardId ref 赋值可能晚于本组件挂载, 若只看 props 会误判为空
  // 而跳回第一个榜 (点击其他榜后被拽回 kw__93 的根因)
  if (!props.boardId && !route.query.boardId && boardList.list.length) handleToggleList(boardList.list[0].id)
}, {
  immediate: true,
})

defineExpose({ hideMenu: handleMenuClick })

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.listsContent {
  flex: auto;
  min-width: 0;
  overflow-y: scroll;
  // overflow-y: scroll !important;
  // border-right: 1px solid rgba(0, 0, 0, 0.12);
}
.listsItem {
  position: relative;
  transition: .3s ease;
  transition-property: color, background-color;
  background-color: transparent;
  &:hover:not(.active) {
    background-color: var(--color-primary-background-hover);
    cursor: pointer;
  }
  &.active {
    // background-color:
    color: var(--color-primary);
  }
  &.selected {
    background-color: var(--color-primary-font-active);
  }
  &.clicked {
    background-color: var(--color-primary-background-hover);
  }
  &.editing {
    padding: 0 10px;
    background-color: var(--color-primary-background-hover);
    .listsLabel {
      display: none;
    }
    .listsInput {
      display: block;
    }
  }
}
.activeIcon {
  height: .9em;
  width: .9em;
  margin-left: -0.45em;
  vertical-align: -0.05em;
}
.listsLabel {
  display: block;
  height: 100%;
  padding: 0 10px;
  font-size: 13px;
  line-height: 36px;
  .mixin-ellipsis-1();
}


</style>

