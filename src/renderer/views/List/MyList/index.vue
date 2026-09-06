<template>
  <div ref="dom_lists" :class="$style.lists">
    <div :class="$style.listHeader">
      <h2 :class="$style.listsTitle">{{ $t('my_list') }}</h2>
      <div :class="$style.headerBtns">
        <button :class="$style.listsAdd" :aria-label="$t('lists__new_list_btn')" @click="isShowNewList = true">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="70%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-list-add" />
          </svg>
        </button>

        <button :class="$style.listsAdd" :aria-label="$t('list_update_modal__title')" @click="isShowListUpdateModal = true">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" style="transform: rotate(45deg);" height="70%" viewBox="0 0 24 24" space="preserve">
            <use xlink:href="#icon-refresh" />
          </svg>
        </button>
      </div>
    </div>
    <!-- Luminous Harmonic: 平台歌单导入按钮行 — 网易云 / 汽水 / 酷狗 / QQ -->
    <div :class="$style.platformRow">
      <button :class="$style.platformBtn" :aria-label="$t('netease__import')" :title="$t('netease__import')" @click="isShowNeteaseImportModal = true">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" height="70%" width="24" viewBox="0 0 24 24" space="preserve">
          <path fill="currentColor" d="M7.3 19.5a5.3 5.3 0 0 1-.2-10.6A6.3 6.3 0 0 1 19 10.7a4.5 4.5 0 0 1-.5 8.8H7.3Zm0-8.6a3.3 3.3 0 1 0 0 6.6h11.2a2.5 2.5 0 1 0-.3-5 1 1 0 0 1-1-.9 4.3 4.3 0 0 0-8.3-1.1 1 1 0 0 1-1 .6h-.6Z" />
        </svg>
      </button>
      <button :class="$style.platformBtn" :aria-label="$t('qishui__import')" :title="$t('qishui__import')" @click="isShowQishuiImportModal = true">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" height="70%" width="24" viewBox="0 0 24 24" space="preserve">
          <path fill="currentColor" d="M9 3v11.1a3.5 3.5 0 1 0 2 3.15V7.2l8-1.7v5.9a3.5 3.5 0 1 0 2 3.15V2L9 4.1V3Zm2 4.1 8-1.7v2.05l-8 1.7V7.1ZM5.5 3.5 7 3.2v2.05L5.5 5.5a1.75 1.75 0 1 0 0 3.5H7v2H5.5a3.75 3.75 0 1 1 0-7.5Z"/>
        </svg>
      </button>
      <button :class="[$style.platformBtn, $style.kugouAdd]" :aria-label="$t('kugou__import')" :title="$t('kugou__import')" @click="isShowKugouImportModal = true">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" height="70%" width="24" viewBox="0 0 24 24" space="preserve">
          <path fill="currentColor" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2.4a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2Zm-1.6 3.1v8.2l6.3-4.1-6.3-4.1Z"/>
        </svg>
      </button>
      <button :class="[$style.platformBtn, $style.qqAdd]" :aria-label="$t('qq__import')" :title="$t('qq__import')" @click="isShowQQImportModal = true">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" height="70%" width="24" viewBox="0 0 24 24" space="preserve">
          <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.8-.4 1.1-1.1 2.6-2.2 3.6-.3.3-.1.8.3.8 1.5-.1 3-.7 4-1.5.6.1 1.2.2 1.9.2a7 7 0 0 0 0-14Zm-2.5 6.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Zm5 0a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2Z"/>
        </svg>
      </button>
    </div>
    <ul ref="dom_lists_list" class="scroll" :class="[$style.listsContent, { [$style.sortable]: isModDown }]">
      <li
        class="default-list" :class="[$style.listsItem, {[$style.active]: defaultList.id == listId}, {[$style.clicked]: rightClickItemIndex == -2}, {[$style.fetching]: fetchingListStatus[defaultList.id]}]"
        :aria-label="$t(defaultList.name)" :aria-selected="defaultList.id == listId"
        @contextmenu="handleListsItemRigthClick($event, -2)" @click="handleListToggle(defaultList.id)"
      >
        <!-- <div v-if="defaultList.id == listId" :class="$style.activeIcon">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="40%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-right" />
          </svg>
        </div> -->
        <span :class="$style.listsLabel">
          <svg-icon v-if="defaultList.id == listId" name="angle-right-solid" :class="$style.activeIcon" />
          {{ $t(defaultList.name) }}
        </span>
      </li>
      <li
        class="default-list" :class="[$style.listsItem, {[$style.active]: loveList.id == listId}, {[$style.clicked]: rightClickItemIndex == -1}, {[$style.fetching]: fetchingListStatus[loveList.id]}]"
        :aria-label="$t(loveList.name)" :aria-selected="loveList.id == listId"
        @contextmenu="handleListsItemRigthClick($event, -1)" @click="handleListToggle(loveList.id)"
      >
        <span :class="$style.listsLabel">
          <svg-icon v-if="loveList.id == listId" name="angle-right-solid" :class="$style.activeIcon" />
          {{ $t(loveList.name) }}
        </span>
      </li>
      <li
        v-for="(item, index) in userLists"
        :key="item.id" class="user-list"
        :class="[$style.listsItem, {[$style.active]: item.id == listId}, {[$style.clicked]: rightClickItemIndex == index}, {[$style.fetching]: fetchingListStatus[item.id]}]"
        :data-index="index" :aria-label="item.name" :aria-selected="item.id == listId" @contextmenu="handleListsItemRigthClick($event, index)"
      >
        <span :class="$style.listsLabel" @click="handleListToggle(item.id, index + 2)">
          <svg-icon v-if="item.id == listId" name="angle-right-solid" :class="$style.activeIcon" />
          <span :class="$style.listName">{{ item.name }}</span>
          <span v-if="sourceLabels[item.source]" :class="$style.sourceLabel">{{ sourceLabels[item.source] }}</span>
        </span>
        <base-input
          :class="$style.listsInput" type="text" :value="item.name"
          :placeholder="item.name" @keyup.enter="handleSaveListName(index, $event)" @blur="handleSaveListName(index, $event)"
        />
      </li>
      <transition enter-active-class="animated-fast slideInLeft" leave-active-class="animated-fast fadeOut" @after-leave="isNewListLeave = false" @after-enter="$refs.dom_listsNewInput.focus()">
        <li v-if="isShowNewList" :class="[$style.listsItem, $style.listsNew, {[$style.newLeave]: isNewListLeave}]">
          <base-input
            ref="dom_listsNewInput" :class="$style.listsInput" type="text" :placeholder="$t('lists__new_list_input')"
            @keyup.enter="handleCreateList" @blur="handleCreateList"
          />
        </li>
      </transition>
    </ul>
    <base-menu v-model="isShowMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
    <DuplicateMusicModal v-model:visible="isShowDuplicateMusicModal" :list-info="duplicateListInfo" />
    <ListSortModal v-model:visible="isShowListSortModal" :list-info="sortListInfo" />
    <ListUpdateModal v-model:visible="isShowListUpdateModal" />
    <NetEaseImportModal v-model="isShowNeteaseImportModal" />
    <QishuiImportModal v-model="isShowQishuiImportModal" />
    <KugouImportModal v-model="isShowKugouImportModal" />
    <QQImportModal v-model="isShowQQImportModal" />
  </div>
</template>

<script>
import { openUrl } from '@common/utils/electron'

import musicSdk from '@renderer/utils/musicSdk'
import DuplicateMusicModal from './components/DuplicateMusicModal.vue'
import ListSortModal from './components/ListSortModal.vue'
import ListUpdateModal from './components/ListUpdateModal.vue'
import NetEaseImportModal from './components/NetEaseImportModal.vue'
import QishuiImportModal from './components/QishuiImportModal.vue'
import KugouImportModal from './components/KugouImportModal.vue'
import QQImportModal from './components/QQImportModal.vue'

import { defaultList, loveList, userLists, fetchingListStatus } from '@renderer/store/list/state'
import { removeUserList } from '@renderer/store/list/action'

import { ref, watch } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { LIST_IDS } from '@common/constants'


import { dialog } from '@renderer/plugins/Dialog'

import { saveListPrevSelectId } from '@renderer/utils/data'

import { useI18n } from '@renderer/plugins/i18n'


import useShare from './useShare'
import useMenu from './useMenu'
import useListUpdate from './useListUpdate'
import useSort from './useSort'
import useDarg from './useDarg'
import useEditList from './useEditList'
import useListScroll from './useListScroll'
import useDuplicate from './useDuplicate'

export default {
  name: 'MyLists',
  components: {
    DuplicateMusicModal,
    ListSortModal,
    ListUpdateModal,
    NetEaseImportModal,
    QishuiImportModal,
    KugouImportModal,
    QQImportModal,
  },
  props: {
    listId: {
      type: String,
      required: true,
    },
  },
  emits: ['show-menu'],
  setup(props, { emit }) {
    const router = useRouter()
    const t = useI18n()

    const dom_lists_list = ref(null)
    const rightClickItemIndex = ref(-10)

    const { handleImportList, handleExportList } = useShare()
    const { isShowListUpdateModal, handleUpdateSourceList } = useListUpdate()
    const { isShowListSortModal, sortListInfo, handleSortList } = useSort()
    const { isShowDuplicateMusicModal, duplicateListInfo, handleDuplicateList } = useDuplicate()
    const isShowNeteaseImportModal = ref(false)
    const isShowQishuiImportModal = ref(false)
    const isShowKugouImportModal = ref(false)
    const isShowQQImportModal = ref(false)
    const { handleRename, handleSaveListName, isShowNewList, isNewListLeave, handleCreateList } = useEditList({ dom_lists_list })
    useListScroll({ dom_lists_list })

    const handleOpenSourceDetailPage = async(listInfo) => {
      const { source, sourceListId } = listInfo
      if (!sourceListId) return
      let url
      if (/board__/.test(sourceListId)) {
        const id = sourceListId.replace(/board__/, '')
        url = musicSdk[source].leaderboard.getDetailPageUrl(id)
      } else if (musicSdk[source]?.songList?.getDetailPageUrl) {
        url = await musicSdk[source].songList.getDetailPageUrl(sourceListId)
      }
      if (!url) return
      void openUrl(url)
    }

    const handleRemove = (listInfo) => {
      void dialog.confirm({
        message: t('lists__remove_tip', { name: listInfo.name }),
        confirmButtonText: t('lists__remove_tip_button'),
      }).then(isRemove => {
        if (!isRemove) return
        void removeUserList([listInfo.id])
        if (props.listId == listInfo.id) {
          handleListToggle(LIST_IDS.DEFAULT)
        }
      })
    }

    const {
      menus,
      menuLocation,
      isShowMenu,
      showMenu,
      menuClick,
    } = useMenu({
      emit,

      handleImportList,
      handleExportList,
      handleUpdateSourceList,
      handleOpenSourceDetailPage,
      handleSortList,
      handleDuplicateList,
      handleRename,
      handleRemove,
    })

    const handleListsItemRigthClick = (event, index) => {
      rightClickItemIndex.value = index
      showMenu(event, index)
    }

    const handleListToggle = (id) => {
      if (id == props.listId) return
      router.replace({
        path: '/list',
        query: { id },
      }).catch(_ => _)
    }

    const handleMenuClick = (action) => {
      if (rightClickItemIndex.value < -2) return
      let index = rightClickItemIndex.value
      rightClickItemIndex.value = -10
      menuClick(action, index)
    }

    const { isModDown } = useDarg({ dom_lists_list, handleMenuClick, handleSaveListName })


    watch(() => props.listId, (listId) => {
      saveListPrevSelectId(listId)
    })

    watch(() => userLists, (lists) => {
      if (lists.some(l => l.id == props.listId)) return
      void router.replace({
        path: '/list',
        query: {
          id: defaultList.id,
        },
      })
    })

    // Luminous Harmonic: 平台标识文案 (与列表内音源徽标一致)
    const sourceLabels = {
      wy: t('list__source_wy'),
      kg: t('list__source_kg'),
      tx: t('list__source_tx'),
      qishui: t('list__source_qishui'),
    }

    return {
      sourceLabels,
      rightClickItemIndex,
      defaultList,
      loveList,
      userLists,
      fetchingListStatus,
      dom_lists_list,
      isShowListUpdateModal,
      isShowListSortModal,
      sortListInfo,
      isShowDuplicateMusicModal,
      duplicateListInfo,
      isShowNeteaseImportModal,
      isShowQishuiImportModal,
      isShowKugouImportModal,
      isShowQQImportModal,
      handleSaveListName,
      isShowNewList,
      isNewListLeave,
      handleCreateList,
      handleListsItemRigthClick,
      isShowMenu,
      handleMenuClick,
      menus,
      menuLocation,
      handleListToggle,
      isModDown,
      hideMenu: handleMenuClick,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@lists-item-height: 36px;
.lists {
  flex: none;
  width: 16%;
  min-width: 0;
  overflow: hidden; // 任何超宽内容都裁剪在侧栏内, 不侵入右侧内容区
  display: flex;
  flex-flow: column nowrap;
  // Luminous Harmonic: 统一透明度公式 (乘全局 --glass-alpha)
  background-color: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
  border-right: 1px solid var(--glass-stroke, transparent);
}
.listHeader {
  position: relative;
  display: flex;
  flex-flow: row nowrap;
  border-bottom: var(--color-list-header-border-bottom);
  &:hover {
    .listsAdd {
      opacity: 1;
    }
  }
}
.listsTitle {
  flex: auto;
  font-size: 12px;
  line-height: 38px;
  padding: 0 10px;
  .mixin-ellipsis-1();
}
.headerBtns {
  flex: none;
  display: flex;
}
.listsAdd {
  // position: absolute;
  // right: 0;
  margin-top: 6px;
  width: 30px;
  padding: 0;
  box-sizing: border-box;
  background: none;
  height: 30px;
  border: none;
  outline: none;
  border-radius: @radius-border;
  cursor: pointer;
  opacity: .1;
  transition: opacity @transition-normal;
  color: var(--color-button-font);
  svg {
    vertical-align: bottom;
  }
  &:active {
    opacity: .7 !important;
  }
  &:hover {
    opacity: .6 !important;
  }
}
// Luminous Harmonic: 平台歌单导入按钮行 (标题栏下方)
.platformRow {
  flex: none;
  display: flex;
  align-items: center;
  flex-wrap: wrap; // 按钮放不下时换行, 不越出侧栏
  gap: 10px;
  max-width: 100%;
  padding: 0 4px 10px;
}
.platformBtn {
  flex: none;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: .75;
  color: var(--color-primary);
  transition: opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    opacity: 1;
    background: color-mix(in srgb, var(--color-font) 4%, transparent);
  }
}
.listsContent {
  flex: auto;
  min-width: 0;
  overflow-y: scroll !important;
  // border-right: 1px solid rgba(0, 0, 0, 0.12);

  &.sortable {
    * {
      -webkit-user-drag: element;
    }

    .listsItem {
      &:hover, &.active, &.selected, &.clicked {
        background-color: transparent !important;
      }

      &.dragingItem {
        background-color: var(--color-primary-background-hover) !important;
      }
    }
  }
}
.listsItem {
  position: relative;
  transition: .3s ease;
  transition-property: color, background-color, opacity;
  background-color: transparent;
  &:not(.active) {
    &:hover {
      background-color: var(--color-primary-background-hover);
      cursor: pointer;
    }
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
  &.fetching {
    opacity: .5;
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
  display: flex;
  align-items: center;
  height: @lists-item-height;
  padding: 0 10px;
  font-size: 13px;
  line-height: @lists-item-height;
  .mixin-ellipsis-1();
}
.listName {
  min-width: 0;
  .mixin-ellipsis-1();
}
.sourceLabel {
  flex: none;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 8px;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  font-size: 10px;
  line-height: 1.4;
}
.listsInput {
  width: 100%;
  height: @lists-item-height;
  // border: none;
  padding: 0;
  // padding-bottom: 1px;
  line-height: @lists-item-height;
  background: none !important;
  border-radius: 0;
  // outline: none;
  font-size: 13px;
  display: none;
  // font-family: inherit;
}

.listsNew {
  padding: 0 10px;
  background-color: var(--color-primary-background-hover) !important;
  .listsInput {
    display: block;
  }
}
.newLeave {
  margin-top: -@lists-item-height;
  z-index: -1;
}


</style>
