<template>
  <nav :class="[$style.menu, { [$style.collapsed]: appSetting['common.asideCollapsed'] }]">
    <!-- Luminous Harmonic: 去掉错误的 role="toolbar"/"tab" (nav>ul>li>a 原生语义即正确), active 用 aria-current 表达 -->
    <ul :class="$style.list">
      <li v-for="item in menus" :key="item.to" :class="$style.navItem">
        <router-link
          :class="[$style.link, {[$style.active]: $route.meta.name == item.name}]"
          :aria-current="$route.meta.name == item.name ? 'page' : undefined"
          :to="item.to"
          :aria-label="item.tips"
          :title="appSetting['common.asideCollapsed'] ? item.tips : undefined"
        >
          <span :class="$style.iconBox">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" :viewBox="item.iconSize" height="100%" width="100%" space="preserve">
              <use :xlink:href="item.icon" />
            </svg>
          </span>
          <span :class="$style.label">{{ item.tips }}</span>
        </router-link>
      </li>
      <!-- Luminous Harmonic: 收起/展开侧边栏菜单项 — 收起后仅剩此图标, 点击即展开 -->
      <li :class="$style.navItem">
        <button
          type="button"
          :class="[$style.link, $style.toggleBtn]"
          :aria-label="appSetting['common.asideCollapsed'] ? $t('aside__expand_sidebar') : $t('aside__collapse_sidebar')"
          :title="appSetting['common.asideCollapsed'] ? $t('aside__expand_sidebar') : (appSetting['common.asideCollapsed'] ? undefined : $t('aside__collapse_sidebar'))"
          @click="toggleCollapse"
        >
          <span :class="[$style.iconBox, { [$style.iconCollapsed]: appSetting['common.asideCollapsed'] }]">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24" height="100%" width="100%" space="preserve">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M4 4.5h16a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 18V6A1.5 1.5 0 0 1 4 4.5zm.5 2v11h3.5v-11H4.5zm5.5 0v11h9.5v-11H10z" fill="currentColor" />
            </svg>
          </span>
          <span :class="$style.label">{{ appSetting['common.asideCollapsed'] ? $t('aside__expand_sidebar') : $t('aside__collapse_sidebar') }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<script lang="ts">
import { appSetting, updateSetting } from '@renderer/store/setting'
import { useI18n } from '@root/lang'
import { computed } from '@common/utils/vueTools'

export default {
  name: 'NavBar',
  setup() {
    const t = useI18n()

    // Luminous Harmonic: 收起/展开侧边栏 (220px ↔ 72px 图标态), 状态持久化在 common.asideCollapsed
    const toggleCollapse = () => {
      updateSetting({ 'common.asideCollapsed': !appSetting['common.asideCollapsed'] })
    }

    const menus = computed(() => {
      return [
        {
          to: '/search',
          tips: t('search'),
          icon: '#icon-search-2',
          iconSize: '0 0 425.2 425.2',
          name: 'Search',
          enable: true,
        },
        {
          to: '/songList/list',
          tips: t('song_list'),
          icon: '#icon-album',
          iconSize: '0 0 425.2 425.2',
          name: 'SongList',
          enable: true,
        },
        {
          to: '/leaderboard',
          tips: t('leaderboard'),
          icon: '#icon-leaderboard',
          iconSize: '0 0 425.22 425.2',
          name: 'Leaderboard',
          enable: true,
        },
        {
          to: '/list',
          tips: t('my_list'),
          icon: '#icon-love',
          iconSize: '0 0 444.87 391.18',
          name: 'List',
          enable: true,
        },
        {
          to: '/download',
          tips: t('download'),
          icon: '#icon-download-2',
          iconSize: '0 0 425.2 425.2',
          // Luminous Harmonic: 始终显示下载项, 不受 download.enable 开关过滤 (避免首次安装看不到入口)
          enable: true,
          name: 'Download',
        },
        {
          to: '/setting',
          tips: t('setting'),
          icon: '#icon-setting',
          iconSize: '0 0 493.23 436.47',
          enable: true,
          name: 'Setting',
        },
      ].filter(m => m.enable)
    })
    return {
      appSetting,
      menus,
      toggleCollapse,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.menu {
  flex: auto;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-app-region: no-drag;
}
.list {
  display: flex;
  flex-flow: column nowrap;
  gap: 6px;
}
.navItem {
  position: relative;
  width: 100%;
}
// Luminous Harmonic: 图标 + 文字导航项（对齐设计稿 sidebar）
.link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  box-sizing: border-box;
  border-radius: 10px;
  border: 1px solid transparent;
  color: var(--color-nav-font);
  cursor: pointer;
  outline: none;
  text-decoration: none; // 去掉 <router-link> 默认的下划线
  transition: 280ms cubic-bezier(0.4, 0, 0.2, 1);
  transition-property: background-color, color, box-shadow, border-color, transform, padding, gap;

  // Luminous Harmonic: <button> 的 UA 默认样式重置 — 与导航项完全一致, 不突兀
  &.toggleBtn {
    appearance: none;
    background-color: transparent;
    font: inherit;
    text-align: left;
  }

  &.active {
    background-color: var(--color-primary-light-300-alpha-700);
    border-color: var(--glass-stroke, transparent);
    color: var(--color-primary-font, var(--color-nav-font));
    font-weight: 600;
    // 整项向右轻微移动 (transform 不影响 flex layout, 不挤压其他项)
    transform: translateX(4px);

    .iconBox {
      color: var(--color-primary);
    }

    &:hover {
      background-color: var(--color-primary-light-300-alpha-800);
    }
  }

  &:hover:not(.active) {
    background-color: var(--color-primary-light-400-alpha-700);
  }
  &:active:not(.active) {
    background-color: var(--color-primary-light-300-alpha-600);
  }
}

.iconBox {
  flex: none;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-nav-font);
  transition: color @transition-fast, transform @transition-normal;

  svg {
    fill: currentColor;
  }
}

// Luminous Harmonic: 收起态侧栏图标镜像 (面板在左 → 面板在右, 暗示展开方向)
.iconCollapsed svg {
  transform: scaleX(-1);
}

.label {
  flex: auto;
  font-size: 14px;
  line-height: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  // Luminous Harmonic: 折叠/展开时文字随宽度同步淡入淡出 (时长与侧栏宽度动画一致), 不再瞬间消失
  transition: opacity 280ms cubic-bezier(0.4, 0, 0.2, 1);
}

// Luminous Harmonic: 折叠态 — 文字淡出, 图标与 Logo 居中对齐:
// 侧栏 72px - 左右内边距 16px*2 = 内容区 40px, 图标 20px → 左右 padding 各 10px,
// 图标中心 = 16+10+10 = 36 = Logo 中心 (Logo 40px 居中于同一内容区), padding 参与过渡保持平滑
.collapsed {
  .link {
    padding: 0 10px;

    &.active {
      transform: none;
    }
  }
  .label {
    opacity: 0;
  }
}

</style>
