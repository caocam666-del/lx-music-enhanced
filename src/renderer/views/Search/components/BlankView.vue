<template>
  <div v-show="props.visible" :class="$style.noitem">
    <div v-if="appSetting['search.isShowHotSearch'] || (appSetting['search.isShowHistorySearch'] && historyList.length)" class="scroll" :class="$style.noitemListContainer">
      <dl v-if="appSetting['search.isShowHotSearch']" :class="[$style.noitemList, $style.noitemHotSearchList]">
        <dt :class="$style.noitemListTitle">{{ $t('search__hot_search') }}</dt>
        <dd v-for="(item, index) in hotSearchList" :key="index" :class="$style.noitemListItem" @click="handleSearch(item)">{{ item }}</dd>
      </dl>
      <dl v-if="appSetting['search.isShowHistorySearch'] && historyList.length" :class="$style.noitemList">
        <dt :class="$style.noitemListTitle">
          <span>{{ $t('history_search') }}</span><span :class="$style.historyClearBtn" :aria-label="$t('history_clear')" @click="clearHistoryList">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 512 512" space="preserve">
              <use xlink:href="#icon-eraser" />
            </svg></span>
        </dt>
        <dd v-for="(item, index) in historyList" :key="index + item" :class="$style.noitemListItem" :aria-label="$t('history_remove')" @contextmenu="removeHistoryWord(index)" @click="handleSearch(item)">{{ item }}</dd>
      </dl>
    </div>
    <div v-else :class="$style.noitem_label">
      <p>{{ $t('search__welcome') }}</p>
    </div>
  </div>
</template>

<script setup>
import { watch, shallowRef } from '@common/utils/vueTools'
import { historyList } from '@renderer/store/search/state'
import { getHistoryList, removeHistoryWord, clearHistoryList } from '@renderer/store/search/action'
import { getList } from '@renderer/store/hotSearch'
import { appSetting } from '@renderer/store/setting'
import { useRouter } from '@common/utils/vueRouter'

const props = defineProps({
  visible: Boolean,
  source: {
    type: String,
    required: true,
  },
})

const hotSearchList = shallowRef([])

if (appSetting['search.isShowHotSearch']) {
  watch(() => props.visible, (visible) => {
    if (!visible) return
    void getList(props.source).then(list => {
      hotSearchList.value = list
    })
  }, {
    immediate: true,
  })

  watch(() => props.source, (source) => {
    if (!props.visible) return
    void getList(source).then(list => {
      if (source != props.source) return
      hotSearchList.value = list
    })
  })
}

if (appSetting['search.isShowHistorySearch']) {
  void getHistoryList()
}

const router = useRouter()
const handleSearch = (text) => {
  void router.replace({
    path: '/search',
    query: {
      text,
    },
  })
}

</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.noitem {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
  display: flex;
  flex-flow: column nowrap;
  // justify-content: center;
}
.noitemListContainer {
  padding: 3% 15px 15px;
  // margin-top: -20px;
  min-height: 250px;
  max-height: 94.7%;
}
.noitemList {
  +.noitemList {
    margin-top: 15px;
  }
}
.noitemHotSearchList {
  min-height: 106px;
}
.noitemListTitle {
  color: var(--color-font);
  padding: 5px 5px 8px;
  font-size: 14px;
}
.noitemListItem {
  display: inline-block;
  margin: 3px 5px;
  // Luminous Harmonic: 热门搜索 / 历史搜索标签 glass-card 药丸化
  background-color: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
  backdrop-filter: blur(var(--glass-blur, 12px)) saturate(1.2);
  border: 1px solid var(--glass-stroke, transparent);
  padding: 7px 14px;
  border-radius: 20px;
  transition: background-color @transition-normal, border-color @transition-normal, transform @transition-normal;
  cursor: pointer;
  color: var(--color-button-font);
  .mixin-ellipsis-1();
  max-width: 150px;
  font-size: 13px;
  will-change: transform;
  &:hover {
    background-color: color-mix(in srgb, var(--glass-card-hover, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
    border-color: var(--glass-stroke-strong, var(--glass-stroke, transparent));
    transform: translateY(-1px);
  }
  &:active {
    background-color: var(--color-button-background-active);
    transform: translateY(0);
  }
}
.historyClearBtn {
  padding: 0 5px;
  margin-left: 5px;
  color: var(--color-font-label);
  cursor: pointer;
  transition: @transition-normal;
  transition-property: color, opacity;
  opacity: .3;
  &:hover {
    color: var(--color-primary-font-hover);
    opacity: .8;
  }
  &:active {
    color: var(--color-primary-font-active);
    opacity: 1;
  }
  svg {
    vertical-align: middle;
    width: 15px;
  }
}

.noitem_label {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-flow: column nowrap;
  gap: 12px;
  p {
    font-size: 22px;
    color: var(--color-font-label);
    text-align: center;
    opacity: 0.7;
    &::before {
      content: '🎵';
      display: block;
      font-size: 40px;
      margin-bottom: 8px;
    }
  }
}
</style>
