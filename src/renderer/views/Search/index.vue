<template>
  <div :class="$style.container">
    <div :class="$style.header">
      <base-tab v-model="source" :list="sources" @change="handleSourceChange" />
      <base-tab v-model="searchType" :list="searchTypes" @change="handleTypeChange" />
    </div>
    <div :class="$style.main">
      <!-- Luminous Harmonic: 搜索骨架屏 shimmer -->
      <div v-if="isSearching && searchText" :class="$style.shimmer">
        <div v-for="i in 8" :key="i" class="lx-shimmer" :style="{ height: '32px', marginBottom: '10px', opacity: 1 - i * 0.08 }" />
      </div>
      <song-list-list v-show="searchType == 'songlist' && searchText" :page="page" :source-id="source" />
      <music-list v-show="searchType == 'music' && searchText" :page="page" :source-id="source" />
      <blank-view :visible="!searchText" :source="source" />
    </div>
  </div>
</template>

<script>
import { useRoute, useRouter } from '@common/utils/vueRouter'
import { searchText } from '@renderer/store/search/state'
import { getSearchSetting, setSearchSetting } from '@renderer/utils/data'
import { sources as _sources } from '@renderer/store/search/music'

import MusicList from './MusicList/index.vue'
import SongListList from './SongListList/index.vue'
import BlankView from './components/BlankView.vue'
import { computed, ref, watch } from '@common/utils/vueTools'
import { sourceNames } from '@renderer/store'

const source = ref('kw')
const searchType = ref(null)
const page = ref(1)

const verifyQueryParams = async(to, from, next) => {
  let _source = to.query.source
  let _type = to.query.type
  let _page = to.query.page

  if (_source == null || _type == null) {
    const setting = await getSearchSetting()
    _source ??= setting.source
    _type ??= setting.type

    next({
      path: to.path,
      query: { ...to.query, source: _source, type: _type, page: _page },
    })
    return
  }
  source.value = _source
  searchType.value = _type

  if (_page) page.value = parseInt(_page)

  if (to.query.text != null) {
    searchText.value = to.query.text
    if (!_page) page.value = 1
  }
  next()
  void setSearchSetting({ source: _source, type: _type })
}

export default {
  name: 'Search',
  components: {
    MusicList,
    SongListList,
    BlankView,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const route = useRoute()
    const router = useRouter()

    const sources = _sources.map(id => {
      return {
        id,
        label: sourceNames.value[id],
      }
    })
    const handleSourceChange = (id) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          source: id,
          page: 1,
        },
      })
    }

    const searchTypes = computed(() => {
      return [
        { label: window.i18n.t('search__type_music'), id: 'music' },
        { label: window.i18n.t('search__type_songlist'), id: 'songlist' },
      ]
    })
    const handleTypeChange = (type) => {
      void router.replace({
        path: route.path,
        query: {
          ...route.query,
          type,
          page: 1,
        },
      })
    }

    // Luminous Harmonic: 搜索加载骨架屏 — 搜索文本变化时显示 shimmer, 3s 后自动消失
    const isSearching = ref(false)
    let searchTimer = 0
    watch(searchText, (val) => {
      if (val) {
        isSearching.value = true
        clearTimeout(searchTimer)
        searchTimer = window.setTimeout(() => { isSearching.value = false }, 3000)
      } else {
        isSearching.value = false
      }
    })


    return {
      sources,
      source,
      handleSourceChange,
      searchTypes,
      searchType,
      handleTypeChange,
      isSearching,
      page,
      searchText,
    }
  },
}


</script>

<style lang="less" module>
.container {
  // Luminous Harmonic: 统一页面内边距 — 玻璃卡与窗口边缘脱开
  padding: 12px 16px;
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
}

.header {
  flex: none;
  display: flex;
  flex-flow: row nowrap;
  justify-content: space-between;
}

.main {
  position: relative;
  flex: auto;
}

.shimmer {
  position: absolute;
  left: 0; top: 0;
  width: 100%; height: 100%;
  padding: 10px 15px;
  box-sizing: border-box;
  z-index: 1;
  pointer-events: none;
}
</style>
