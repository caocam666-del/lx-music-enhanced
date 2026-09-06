<template>
  <div :class="$style.main">
    <div class="scroll" :class="$style.toc">
      <div :class="$style.tocTools">
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <use xlink:href="#icon-search" />
        </svg>
        <input
          ref="dom_search_ref"
          v-model.trim="settingQuery"
          type="search"
          :placeholder="$t('setting__search_placeholder')"
          :aria-label="$t('setting__search_placeholder')"
          @keydown.esc="settingQuery = ''"
        >
        <button v-if="settingQuery" type="button" :aria-label="$t('setting__search_clear')" @click="settingQuery = ''">×</button>
      </div>
      <ul :class="$style.tocList" role="toolbar">
        <li v-for="h2 in filteredTocList" :key="h2.id" :class="$style.tocListItem" role="presentation">
          <h2
            :class="[$style.tocH2, {[$style.active]: activeCategoryId == h2.id }]"
            role="tab" :aria-selected="activeCategoryId == h2.id"
            :aria-label="h2.title" tabindex="0" ignore-tip @click="toggleTab(h2.id)" @keydown.enter.space.prevent="toggleTab(h2.id)"
          >
            <!-- Luminous Harmonic: 分类图标 (参照主流软件设置页) -->
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :class="$style.tocIcon" aria-hidden="true">
              <use :xlink:href="h2.icon" />
            </svg>
            {{ h2.title }}
            <svg-icon v-if="activeCategoryId == h2.id" name="angle-right-solid" :class="$style.activeIcon" />
          </h2>
          <button v-if="settingQuery && h2.matchText" type="button" :class="$style.searchMatch" @click="toggleTab(h2.id)">
            {{ h2.matchCount }} 项：{{ h2.matchText }}
          </button>
          <!-- <ul v-if="h2.children.length" :class="$style.tocList">
            <li v-for="h3 in h2.children" :key="h3.id" :class="$style.tocSubListItem">
              <h3 :class="[$style.tocH3, toc.activeId == h3.id ? $style.active : null]" :aria-label="h3.title">
                <a :href="'#' + h3.id" @click.stop="toc.activeId = h3.id">{{ h3.title }}</a>
              </h3>
            </li>
          </ul> -->
        </li>
        <li v-if="!filteredTocList.length" :class="$style.emptySearch" role="status">
          {{ $t('setting__search_empty') }}
        </li>
      </ul>
    </div>
    <div ref="dom_content_ref" class="scroll" :class="$style.setting">
      <dl :key="activeCategoryId" :class="$style.categoryAnim">
        <component v-for="name in avtiveComponents" :key="name" :is="name" />
        <!-- <SettingBasic />
        <SettingPlay />
        <SettingPlayDetail />
        <SettingDesktopLyric />
        <SettingSearch />
        <SettingList />
        <SettingDownload />
        <SettingSync />
        <SettingHotKey />
        <SettingNetwork />
        <SettingOdc />
        <SettingBackup />
        <SettingOther />
        <SettingUpdate />
        <SettingAbout /> -->
      </dl>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
// import { currentStting } from './setting'
import { useI18n } from '@renderer/plugins/i18n'
import { messages } from '@root/lang'
import { useRoute } from '@common/utils/vueRouter'

import SettingGeneral from './components/SettingGeneral.vue'
import SettingAppearance from './components/SettingAppearance.vue'
import SettingPlay from './components/SettingPlay.vue'
import SettingPlayDetail from './components/SettingPlayDetail.vue'
import SettingDesktopLyric from './components/SettingDesktopLyric.vue'
import SettingSearch from './components/SettingSearch.vue'
import SettingList from './components/SettingList.vue'
import SettingDownload from './components/SettingDownload.vue'
import SettingSync from './components/SettingSync/index.vue'
import SettingOpenAPI from './components/SettingOpenAPI.vue'
import SettingHotKey from './components/SettingHotKey.vue'
import SettingNetwork from './components/SettingNetwork.vue'
import SettingOdc from './components/SettingOdc.vue'
import SettingBackup from './components/SettingBackup.vue'
import SettingOther from './components/SettingOther.vue'
import SettingUpdate from './components/SettingUpdate.vue'
import SettingAbout from './components/SettingAbout.vue'

export default {
  name: 'Setting',
  components: {
    SettingGeneral,
    SettingAppearance,
    SettingPlay,
    SettingPlayDetail,
    SettingDesktopLyric,
    SettingSearch,
    SettingList,
    SettingDownload,
    SettingSync,
    SettingOpenAPI,
    SettingHotKey,
    SettingNetwork,
    SettingOdc,
    SettingBackup,
    SettingOther,
    SettingUpdate,
    SettingAbout,
  },
  setup() {
    const t = useI18n()
    const route = useRoute()

    const dom_content_ref = ref(null)
    const dom_search_ref = ref(null)

    // Luminous Harmonic: 设置页重构 — 16 组归纳为 10 组, 每组可堆叠多个设置组件
    const tocList = computed(() => {
      return [
        { id: 'general', icon: 'logo', title: t('setting__general'), components: ['SettingGeneral'], searchPrefixes: ['setting__basic_show', 'setting__basic_animation', 'setting__basic_start', 'setting__basic_to_tray', 'setting__play_timeout', 'setting__basic_lang', 'setting__basic_sourcename', 'setting__other_tray_theme', 'tray_enable'] },
        { id: 'appearance', icon: 'album', title: t('setting__appearance'), components: ['SettingAppearance'], searchPrefixes: ['setting__basic_theme', 'setting__basic_window', 'setting__basic_font', 'setting__basic_control', 'setting__basic_playbar', 'theme_', 'setting__basic_source_status'] },
        { id: 'play', icon: 'play', title: t('setting__play'), components: ['SettingPlay', 'SettingPlayDetail'], searchPrefixes: ['setting__play', 'setting__player', 'setting__basic_source', 'setting__basic_play_quality', 'setting__play_detail', 'play_detail', 'play_timeout', 'user_api', 'open_api'] },
        { id: 'desktop_lyric', icon: 'desktop', title: t('setting__desktop_lyric'), components: ['SettingDesktopLyric'], searchPrefixes: ['setting__desktop_lyric', 'desktop_lyric'] },
        { id: 'search_list', icon: 'search-2', title: t('setting__search_list'), components: ['SettingSearch', 'SettingList', 'SettingOdc'], searchPrefixes: ['setting__search', 'setting__list', 'setting__odc', 'setting__dislike'] },
        { id: 'download', icon: 'download-2', title: t('setting__download'), components: ['SettingDownload'], searchPrefixes: ['setting__download'] },
        { id: 'hot_key', icon: 'check', title: t('setting__hot_key'), components: ['SettingHotKey'], searchPrefixes: ['setting__hot_key', 'hotkey'] },
        { id: 'service', icon: 'refresh', title: t('setting__service_sync'), components: ['SettingSync', 'SettingOpenAPI', 'SettingNetwork'], searchPrefixes: ['setting__sync', 'setting__open_api', 'setting__network', 'open_api', 'user_api'] },
        { id: 'data', icon: 'sdCard', title: t('setting__data_backup'), components: ['SettingBackup', 'SettingOther'], searchPrefixes: ['setting__backup', 'setting__other', 'setting__dislike'] },
        { id: 'about', icon: 'comment', title: t('setting__about_update'), components: ['SettingUpdate', 'SettingAbout'], searchPrefixes: ['setting__update', 'setting__about'] },
      ]
    })

    const settingQuery = ref('')
    const getSearchMatches = (item, query) => {
      if (!query) return []
      const normalizedQuery = query.toLocaleLowerCase()
      const messageKeys = Object.keys(messages['zh-cn'])
      return messageKeys
        .filter(key => item.searchPrefixes.some(prefix => key.startsWith(prefix)))
        .map(key => t(key))
        .filter(text => text && text.toLocaleLowerCase().includes(normalizedQuery))
        .slice(0, 4)
    }
    const filteredTocList = computed(() => {
      const query = settingQuery.value.toLocaleLowerCase()
      if (!query) return tocList.value
      const messageKeys = Object.keys(messages['zh-cn'])
      return tocList.value.map(item => {
        const settingMessages = messageKeys
          .filter(key => item.searchPrefixes.some(prefix => key.startsWith(prefix)))
          .map(key => t(key))
        const searchText = [item.title, item.id, ...item.searchPrefixes, ...settingMessages]
          .join(' ')
          .toLocaleLowerCase()
        return searchText.includes(query)
          ? (() => { const matches = getSearchMatches(item, query); return { ...item, matchText: matches.join(' · '), matchCount: matches.length || 1 } })()
          : null
      }).filter(Boolean)
    })

    // Luminous Harmonic: 深链映射 — 旧组件名 (SettingBasic 等) 自动映射到新分类 id
    const LEGACY_ID_MAP = {
      SettingBasic: 'general',
      SettingPlay: 'play',
      SettingPlayDetail: 'play',
      SettingDesktopLyric: 'desktop_lyric',
      SettingSearch: 'search_list',
      SettingList: 'search_list',
      SettingOdc: 'search_list',
      SettingDownload: 'download',
      SettingHotKey: 'hot_key',
      SettingSync: 'service',
      SettingOpenAPI: 'service',
      SettingNetwork: 'service',
      SettingBackup: 'data',
      SettingOther: 'data',
      SettingUpdate: 'about',
      SettingAbout: 'about',
    }
    const activeCategoryId = ref(route.query.name
      ? (LEGACY_ID_MAP[route.query.name] ?? (tocList.value.some(t2 => t2.id == route.query.name) ? route.query.name : tocList.value[0].id))
      : tocList.value[0].id)
    const avtiveComponents = computed(() => {
      return tocList.value.find(t2 => t2.id == activeCategoryId.value)?.components ?? []
    })

    let searchHighlightTimer
    const focusSearchMatch = query => {
      if (!query) return
      void nextTick(() => {
        const content = dom_content_ref.value
        if (!content) return
        const normalizedQuery = query.toLocaleLowerCase()
        const target = [...content.querySelectorAll('h3, h4, label, [id]')].find(dom => {
          const text = `${dom.id ?? ''} ${dom.textContent ?? ''}`.toLocaleLowerCase()
          return text.includes(normalizedQuery)
        })
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.classList.add('setting-search-highlight')
        clearTimeout(searchHighlightTimer)
        searchHighlightTimer = setTimeout(() => target.classList.remove('setting-search-highlight'), 1600)
      })
    }

    const toggleTab = id => {
      activeCategoryId.value = id
      void nextTick(() => {
        if (settingQuery.value) focusSearchMatch(settingQuery.value)
        else dom_content_ref.value?.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }

    watch(settingQuery, query => {
      if (!query) return
      const first = filteredTocList.value[0]
      if (!first) return
      activeCategoryId.value = first.id
      focusSearchMatch(query)
    })

    const handleSearchShortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() == 'f') {
        event.preventDefault()
        dom_search_ref.value?.focus()
        dom_search_ref.value?.select()
      }
    }
    onMounted(() => { window.addEventListener('keydown', handleSearchShortcut, true) })
    onBeforeUnmount(() => { window.removeEventListener('keydown', handleSearchShortcut, true) })

    return {
      tocList,
      settingQuery,
      dom_search_ref,
      filteredTocList,
      activeCategoryId,
      avtiveComponents,
      dom_content_ref,
      toggleTab,
    }
  },
  // mounted() {
  //   this.initTOC()
  // },
  // methods: {
  //   initTOC() {
  //     const list = this.$refs.dom_setting_list.children
  //     const toc = []
  //     let prevTitle
  //     for (const item of list) {
  //       if (item.tagName == 'DT') {
  //         prevTitle = {
  //           title: item.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: item.getAttribute('id'),
  //           dom: item,
  //           children: [],
  //         }
  //         toc.push(prevTitle)
  //         continue
  //       }
  //       const h3 = item.querySelector('h3')
  //       if (h3) {
  //         prevTitle.children.push({
  //           title: h3.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: h3.getAttribute('id'),
  //           dom: h3,
  //         })
  //       }
  //     }
  //     console.log(toc)
  //     this.toc.list = toc
  //   },
  //   handleListScroll(event) {
  //     // console.log(event.target.scrollTop)
  //   },
  // },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  display: flex;
  flex-flow: row nowrap;
  height: 100%;
  border-top: var(--color-list-header-border-bottom);
}

.toc {
  flex: 0 0 16%;
  overflow-y: scroll;
  padding: 8px 6px;
  box-sizing: border-box;
  background-color: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
  border-right: 1px solid var(--glass-stroke, transparent);
}
.tocTools {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 8px;
  margin-bottom: 6px;
  border: 1px solid var(--glass-stroke, transparent);
  border-radius: @radius-border;
  background: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
  color: var(--color-font-label);

  svg {
    flex: 0 0 14px;
    width: 14px;
    height: 14px;
  }

  input {
    min-width: 0;
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--color-font);
    font: inherit;
    font-size: 12px;

    &::placeholder { color: var(--color-font-label); }
  }

  button {
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-font-label);
    cursor: pointer;
    font-size: 0;
    line-height: 16px;

    &::after {
      content: 'x';
      font-size: 12px;
    }

    &:hover { color: var(--color-font); background: color-mix(in srgb, var(--glass-card-hover, transparent) calc(var(--glass-alpha, .8) * 100%), transparent); }
  }
}
.emptySearch {
  padding: 16px 8px;
  color: var(--color-font-label);
  font-size: 12px;
  text-align: center;
}
.searchMatch {
  display: block;
  width: calc(100% - 26px);
  padding: 0;
  border: 0;
  margin: -2px 8px 6px 18px;
  overflow: hidden;
  background: transparent;
  color: var(--color-font-label);
  font-size: 10px;
  line-height: 14px;
  white-space: nowrap;
  text-overflow: ellipsis;
  text-align: left;
  cursor: pointer;
  &:hover { color: var(--color-primary); }
}
:global(.setting-search-highlight) {
  color: var(--color-primary) !important;
  background: var(--color-primary-alpha-100);
  border-radius: @radius-border;
  box-shadow: 0 0 0 3px var(--color-primary-alpha-100);
}
.tocIcon {
  flex: none;
  width: 16px;
  height: 16px;
  margin-right: 8px;
  fill: currentColor;
  opacity: .85;
}
.tocH2 {
  display: flex;
  align-items: center;
  gap: 2px;
  line-height: 1.5;
  .mixin-ellipsis-1();
  font-size: 13px;
  font-weight: 500;
  color: var(--color-font);
  padding: 8px 10px;
  margin: 2px 0;
  border-radius: @radius-border;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow;

  &:not(.active) {
    cursor: pointer;
    &:hover {
      background-color: color-mix(in srgb, var(--glass-card-hover, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
    }
  }
  &.active {
    color: var(--color-primary);
    font-weight: 700;
    background-color: var(--color-primary-background-active);
    box-shadow: inset 0 0 0 1px var(--glass-stroke, transparent);
  }
}
.activeIcon {
  flex: none;
  height: .9em;
  width: .9em;
  margin-right: 2px;
  animation: toc-arrow-in 200ms cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes toc-arrow-in {
  from { opacity: 0; transform: translateX(-6px); }
  to { opacity: 1; transform: translateX(0); }
}
// .tocH3 {
//   font-size: 13px;
//   opacity: .8;
// }

// .tocList {
//   .tocList {
//     // padding-left: 15px;
//   }
// }
// .tocSubListItem {
//   padding-top: 10px;
// }

// Luminous Harmonic: 分类切换快速淡入 (120ms 仅透明度, 无位移——内部切换不要强过渡)
.categoryAnim {
  animation: category-fade-in 120ms ease-out;
}
@keyframes category-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.setting {
  padding: 0 15px 15px;
  font-size: 14px;
  box-sizing: border-box;
  overflow-y: auto;
  height: 100%;
  position: relative;
  width: 100%;

  :global {
    dt {
      border-left: 4px solid var(--color-primary-alpha-500);
      padding: 4px 10px;
      margin: 18px 0 15px;
      font-weight: 700;
      letter-spacing: 0.02em;
      border-radius: 0 @radius-border @radius-border 0;
      // Luminous Harmonic: 设置区段标题玻璃高亮
      background: linear-gradient(90deg, color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent), transparent 70%);

      + dd h3 {
        margin-top: 0;
      }
    }

    dd {
      // Luminous Harmonic: 每个设置区段独立 glass-card
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: var(--lx-radius, @radius-glass);
      background-color: color-mix(in srgb, var(--glass-card, transparent) calc(var(--glass-alpha, .8) * 100%), transparent);
      border: 1px solid var(--glass-stroke, transparent);
      transition: border-color @transition-fast;
      > div {
        padding: 0;
      }

    }
    h3 {
      font-size: 12px;
      margin: 25px 0 15px;
    }
    .p {
      padding: 3px 0;
      line-height: 1.3;
      .btn {
        + .btn {
          margin-left: 10px;
        }
      }
    }

    .help-btn {
      padding: 0;
      margin: 0 0.4em;
      border: none;
      background: none;
      color: var(--color-button-font);
      cursor: pointer;
      transition: opacity 0.2s ease;
      &:hover {
        opacity: 0.7;
      }
    }
    .help-icon {
      margin: 0 0.4em;
    }
  }
}

// .btn-content {
//   display: inline-block;
//   transition: @transition-theme;
//   transition-property: opacity, transform;
//   opacity: 1;
//   transform: scale(1);

//   &.hide {
//     opacity: 0;
//     transform: scale(0);
//   }
// }


// :global(dt):target, :global(h3):target {
//   animation: highlight 1s ease;
// }

// @keyframes highlight {
//   from { background: yellow; }
//   to { background: transparent; }
// }

</style>
