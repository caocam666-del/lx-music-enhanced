<template>
  <div :class="$style.download">
    <div :class="$style.header">
      <base-tab v-model="activeTab" :class="$style.tab" :list="tabs" />
    </div>
    <div :class="$style.content">
      <div v-if="list.length" ref="dom_listContent" :class="$style.content">
        <base-virtualized-list
          ref="listRef" v-slot="{ item, index }" :list="list" key-name="id" :item-height="listItemHeight"
          container-class="scroll" content-class="list"
        >
                    <div
            class="list-item"
            :class="[{[$style.active]: playTaskId == item.id }, { selected: rightClickSelectedIndex == index }, { active: selectedList.includes(item) }]"
            @click="handleListItemClick($event, index)" @contextmenu="handleListItemRightClick($event, index)"
          >
            <div :class="$style.cover">
              <div :class="$style.coverFallback">
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="55%" viewBox="0 0 512 512" space="preserve">
                  <use xlink:href="#icon-musicFile" />
                </svg>
              </div>
              <img
                v-if="item.metadata.musicInfo.meta.picUrl" :src="item.metadata.musicInfo.meta.picUrl"
                loading="lazy" decoding="async" :class="$style.coverImg"
                @error="$event.target.style.display = 'none'"
              >
            </div>
            <div :class="$style.info">
              <div :class="$style.name">
                <span class="select name" :aria-label="getName(item)">{{ getName(item) }}</span>
                <span :class="$style.qualityTag">{{ getTypeName(item.metadata.quality) }}</span>
              </div>
              <div :class="$style.progressLine">
                <div :class="$style.progressTrack">
                  <div
                    :class="[$style.progressFill, { [$style.progressDone]: item.status == downloadStatus.COMPLETED }]"
                    :style="{ width: Math.min(100, Math.max(0, parseFloat(item.progress) || 0)) + '%' }"
                  />
                </div>
                <span :class="$style.statusText">{{ item.progress }}%<span v-if="item.status == downloadStatus.RUN && item.speed"> - {{ item.speed }}/s</span></span>
              </div>
              <div :class="$style.statusLine">{{ item.statusText }}</div>
            </div>
            <div :class="$style.buttons">
              <material-list-buttons
                :index="index" :download-btn="false" :file-btn="item.status != downloadStatus.ERROR" remove-btn="remove-btn"
                :start-btn="!item.isComplate && item.status != downloadStatus.WAITING && (item.status != downloadStatus.RUN)"
                :pause-btn="!item.isComplate && (item.status == downloadStatus.RUN || item.status == downloadStatus.WAITING)"
                :list-add-btn="false" :play-btn="item.status == downloadStatus.COMPLETED"
                :search-btn="item.status == downloadStatus.ERROR" @btn-click="handleListBtnClick"
              />
            </div>
          </div>
        </base-virtualized-list>
      </div>
      <div v-else :class="$style.noItem">
        <p v-text="$t('no_item')" />
      </div>
      <base-menu v-model="isShowItemMenu" :menus="menus" :xy="menuLocation" item-name="name" @menu-click="handleMenuClick" />
      <!-- <base-menu :menus="listItemMenu" :location="listMenu.menuLocation" item-name="name" :is-show="listMenu.isShowItemMenu" @menu-click="handleListItemMenuClick" /> -->
    </div>
    <common-list-add-modal v-model:show="isShowListAdd" :music-info="selectedAddMusicInfo" teleport="#view" />
    <common-list-add-multiple-modal v-model:show="isShowListAddMultiple" :music-list="selectedList" teleport="#view" @confirm="removeAllSelect" />
  </div>
</template>

<script>
// import { checkPath, openDirInExplorer, openUrl } from '@common/utils/electron'

import { ref } from '@common/utils/vueTools'
import useListInfo from './useListInfo'
import useList from './useList'
import useTab from './useTab'
import useMenu from './useMenu'
import usePlay from './usePlay'
import useTaskActions from './useTaskActions'
import useMusicAdd from './useMusicAdd'
import { downloadStatus } from '@renderer/store/download/state'
import { appSetting } from '@renderer/store/setting'
import { formatMusicName } from '@renderer/utils'

export default {
  name: 'Download',
  setup() {
    const listRef = ref()
    const { tabs, activeTab } = useTab()

    const {
      rightClickSelectedIndex,
      dom_listContent,
      listAll,
      list,
      playTaskId,
    } = useListInfo(activeTab)

    const {
      selectedList,
      listItemHeight,
      removeAllSelect,
      handleSelectData,
    } = useList({ listRef, list, listAll })

    const {
      handlePlayMusic,
      handlePlayMusicLater,
    } = usePlay({ selectedList, list, listAll, removeAllSelect })

    const {
      handleSearch,
      handleOpenMusicDetail,
      handleStartTask,
      handlePauseTask,
      handleRemoveTask,
      handleOpenFile,
    } = useTaskActions({ list, removeAllSelect, selectedList })

    const {
      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,
      handleShowMusicAddModal,
    } = useMusicAdd({ selectedList, list })

    const {
      menus,
      menuLocation,
      isShowItemMenu,
      showMenu,
      menuClick,
    } = useMenu({
      handleStartTask,
      handlePauseTask,
      handleRemoveTask,
      handleOpenFile,
      handlePlayMusic,
      handlePlayMusicLater,
      handleShowMusicAddModal,
      handleSearch,
      handleOpenMusicDetail,
    })

    let clickTime = 0
    let clickIndex = -1
    const doubleClickPlay = index => {
      if (
        window.performance.now() - clickTime > 400 ||
      clickIndex !== index
      ) {
        clickTime = window.performance.now()
        clickIndex = index
        return
      }
      const task = list.value[index]
      if (task.isComplate) {
        handlePlayMusic(list.value.indexOf(task), true)
      } else if (task.status === downloadStatus.RUN || task.status === downloadStatus.WAITING) {
        void handlePauseTask(index, true)
      } else {
        void handleStartTask(index, true)
      }
      clickTime = 0
      clickIndex = -1
    }

    const handleListItemClick = (event, index) => {
      if (rightClickSelectedIndex.value > -1) return
      handleSelectData(index)
      doubleClickPlay(index)
    }
    const handleListItemRightClick = (event, index) => {
      rightClickSelectedIndex.value = index
      showMenu(event, list.value[index], index)
    }
    const handleMenuClick = (action) => {
      let index = rightClickSelectedIndex.value
      rightClickSelectedIndex.value = -1
      menuClick(action, index)
    }

    const handleListBtnClick = ({ action, index }) => {
      switch (action) {
        case 'play':
          handlePlayMusic(index, true)
          break
        case 'start':
          void handleStartTask(index, true)
          break
        case 'pause':
          void handlePauseTask(index, true)
          break
        case 'remove':
          void handleRemoveTask(index, true)
          break
        case 'file':
          void handleOpenFile(index)
          break
        case 'search':
          handleSearch(index)
          break
      }
    }

    const getName = (downloadInfo) => {
      return formatMusicName(appSetting['download.fileName'], downloadInfo.metadata.musicInfo.name, downloadInfo.metadata.musicInfo.singer)
    }
    const getTypeName = (quality) => {
      return quality == 'flac24bit' ? 'FLAC Hires' : quality?.toUpperCase()
    }
    return {
      listRef,
      list,
      downloadStatus,
      rightClickSelectedIndex,
      dom_listContent,
      tabs,
      activeTab,
      selectedList,
      listItemHeight,
      playTaskId,

      isShowListAdd,
      isShowListAddMultiple,
      selectedAddMusicInfo,

      removeAllSelect,

      menus,
      menuLocation,
      isShowItemMenu,

      handleListItemClick,
      handleListItemRightClick,
      handleMenuClick,
      handleListBtnClick,

      getName,
      getTypeName,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

// Luminous Harmonic: Pure-music 风格下载卡片行
.cover {
  position: relative;
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-font) 8%, transparent);
}
.coverFallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-font-label);
  opacity: .65;
  svg { fill: currentColor; }
}
.coverImg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 4px;
}
.name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  overflow: hidden;
  white-space: nowrap;
  span:first-child { overflow: hidden; text-overflow: ellipsis; }
}
.qualityTag {
  flex: none;
  font-size: 11px;
  color: var(--color-font-label);
}
.progressLine {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.progressTrack {
  flex: 1 1 auto;
  max-width: 320px;
  height: 4px;
  border-radius: 4px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-font) 10%, transparent);
}
.progressFill {
  height: 100%;
  border-radius: 4px;
  background: var(--color-primary);
}
.progressDone { background: var(--color-success, var(--color-primary)); }
.statusText {
  flex: none;
  font-size: 11px;
  color: var(--color-font-label);
  font-variant-numeric: tabular-nums;
}
.statusLine {
  font-size: 11px;
  color: var(--color-font-label);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.buttons {
  flex: none;
  display: flex;
  align-items: center;
}

.download {
  position: relative;
  overflow: hidden;
  height: 100%;
  // Luminous Harmonic: 统一页面内边距 — 玻璃卡与窗口边缘脱开
  padding: 12px 16px;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;

  :global(.list-item) {
    &.active {
      color: var(--color-button-font);
    }
  }
}
// Luminous Harmonic: 下载页容器 glass 化
.header {
  flex: none;
  padding: 8px 15px 4px;
}
.num {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.playIcon {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  color: var(--color-button-font);
  opacity: .7;
}

.content {
  min-height: 0;
  font-size: 14px;
  display: flex;
  flex-flow: column nowrap;
  flex: auto;
}

// Luminous Harmonic: 下载进度可视化
.progressCell {
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  gap: 4px;
}
.progressTrack {
  width: 92%;
  height: 5px;
  border-radius: 40px;
  overflow: hidden;
  background-color: var(--color-primary-light-100-alpha-800);
  border: 1px solid var(--glass-stroke, transparent);
}
.progressFill {
  height: 100%;
  border-radius: 40px;
  background-color: var(--color-primary);
  // 设计规范: 进度平滑增长, 避免跳变感
  transition: width 0.5s ease-out;
  will-change: width;
}
.progressDone {
  animation: progress-done-flash 0.8s ease-out 1;
}
@keyframes progress-done-flash {
  0% { box-shadow: 0 0 0 0 var(--color-primary-alpha-300); filter: brightness(1.5); }
  100% { box-shadow: 0 0 6px 3px transparent; filter: brightness(1); }
}
.progressText {
  font-size: 12px;
  color: var(--color-font-label);
  .mixin-ellipsis-1();
}

.noItem {
  position: relative;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 22px;
    color: var(--color-font-label);
    opacity: 0.6;
    padding: 20px 40px;
    border-radius: @radius-glass;
    background: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
    border: 1px solid var(--glass-stroke, transparent);
    letter-spacing: 0.04em;
    color: var(--color-font-label);
  }
}

</style>

