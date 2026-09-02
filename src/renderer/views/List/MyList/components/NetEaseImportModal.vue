<template>
  <material-modal :show="modelValue" bg-close teleport="#view" width="560px" max-height="86%" @close="handleClose">
    <main class="scroll" :class="$style.main">
      <header :class="$style.title">
        <h2>{{ $t('netease__title') }}</h2>
      </header>

      <section v-if="!account" :class="$style.form">
        <p :class="$style.tip">{{ $t('netease__cookie_tip') }}</p>
        <textarea
          ref="cookieInput" v-model="cookieText" :class="$style.cookieInput"
          :placeholder="$t('netease__cookie_placeholder')" spellcheck="false" autocomplete="off"
        />
        <base-btn :class="$style.primaryBtn" :disabled="loading || !cookieText.trim()" @click="handleLoad">
          {{ loading ? $t('netease__loading') : $t('netease__verify') }}
        </base-btn>
      </section>

      <section v-else :class="$style.accountSection">
        <div :class="$style.accountBar">
          <span :class="$style.accountName">{{ $t('netease__account', { name: account.nickname }) }}</span>
          <div :class="$style.accountActions">
            <base-btn min outline :disabled="loading" @click="handleLoadSaved">{{ $t('netease__refresh') }}</base-btn>
            <base-btn min outline :disabled="loading" @click="handleClear">{{ $t('netease__clear_cookie') }}</base-btn>
          </div>
        </div>
        <div :class="$style.selectionBar">
          <base-checkbox
            id="netease_select_all" :model-value="allSelected" :label="$t('netease__select_all')"
            @change="handleSelectAll"
          />
          <span>{{ $t('netease__playlist_count', { count: playlists.length }) }}</span>
        </div>
        <ul v-if="playlists.length" class="scroll" :class="$style.playlists">
          <li v-for="playlist in playlists" :key="playlist.id" :class="$style.playlist">
            <base-checkbox
              :id="`netease_playlist_${playlist.id}`" v-model="selectedIds" :value="playlist.id"
              :label="playlist.name"
            />
            <span :class="$style.trackCount">{{ playlist.total }}</span>
          </li>
        </ul>
        <p v-else :class="$style.empty">{{ $t('netease__empty') }}</p>
        <div :class="$style.footer">
          <span v-if="status" :class="$style.status">{{ status }}</span>
          <base-btn
            :class="$style.primaryBtn" :disabled="loading || !selectedIds.length"
            @click="handleImport"
          >
            {{ loading ? progress : $t('netease__import_selected') }}
          </base-btn>
        </div>
      </section>

      <p v-if="error" :class="$style.error">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import musicSdk from '@renderer/utils/musicSdk'
import { getListDetailAll } from '@renderer/store/songList/action'
import { createUserList } from '@renderer/store/list/action'
import syncSourceList from '@renderer/store/list/syncSourceList'
import { userLists } from '@renderer/store/list/state'
import { clearNeteaseCookieValue, getNeteaseCookieValue, saveNeteaseCookieValue } from '@renderer/utils/neteaseAuth'

export default {
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const t = useI18n()
    const cookieInput = ref(null)
    const cookieText = ref('')
    const account = ref(null)
    const playlists = ref([])
    const selectedIds = ref([])
    const loading = ref(false)
    const progress = ref('')
    const status = ref('')
    const error = ref('')

    const allSelected = computed(() => playlists.value.length > 0 && selectedIds.value.length === playlists.value.length)

    const setPlaylists = (list) => {
      playlists.value = list
      selectedIds.value = list.map(item => item.id)
    }

    const errorText = (err) => {
      const key = err?.message === 'INVALID_COOKIE'
        ? 'netease__invalid_cookie'
        : err?.message === 'NETEASE_AUTH_REQUIRED'
          ? 'netease__auth_required'
          : 'netease__load_failed'
      return t(key)
    }

    const loadAccount = async() => {
      loading.value = true
      error.value = ''
      try {
        const savedCookie = await getNeteaseCookieValue()
        if (!savedCookie) return
        account.value = await musicSdk.wy.songList.getAccount()
        setPlaylists(await musicSdk.wy.songList.getUserPlaylists(account.value.id))
      } catch (err) {
        account.value = null
        playlists.value = []
        selectedIds.value = []
        error.value = errorText(err)
      } finally {
        loading.value = false
      }
    }

    const handleLoad = async() => {
      loading.value = true
      error.value = ''
      status.value = ''
      try {
        await saveNeteaseCookieValue(cookieText.value.trim())
        account.value = await musicSdk.wy.songList.getAccount()
        setPlaylists(await musicSdk.wy.songList.getUserPlaylists(account.value.id))
      } catch (err) {
        account.value = null
        playlists.value = []
        selectedIds.value = []
        error.value = errorText(err)
      } finally {
        loading.value = false
      }
    }

    const handleLoadSaved = () => {
      void loadAccount()
    }

    const handleSelectAll = (checked) => {
      selectedIds.value = checked ? playlists.value.map(item => item.id) : []
    }

    const handleImport = async() => {
      const selected = playlists.value.filter(item => selectedIds.value.includes(item.id))
      if (!selected.length) return
      loading.value = true
      error.value = ''
      status.value = ''
      let imported = 0
      let failed = 0
      try {
        for (const playlist of selected) {
          progress.value = t('netease__import_progress', { current: imported + 1, total: selected.length })
          const target = userLists.find(list => list.source === 'wy' && String(list.sourceListId) === playlist.id)
          try {
            if (target) {
              await syncSourceList(target)
            } else {
              const list = await getListDetailAll(playlist.id, 'wy', true)
              await createUserList({
                name: playlist.name,
                list,
                source: 'wy',
                sourceListId: playlist.id,
              })
            }
            imported++
          } catch {
            failed++
          }
        }
        status.value = failed
          ? t('netease__import_partial', { imported, failed })
          : t('netease__import_done', { count: imported })
      } finally {
        loading.value = false
        progress.value = ''
      }
    }

    const handleClear = async() => {
      await clearNeteaseCookieValue()
      account.value = null
      playlists.value = []
      selectedIds.value = []
      cookieText.value = ''
      error.value = ''
      status.value = ''
    }

    const handleClose = () => emit('update:modelValue', false)

    watch(() => props.modelValue, (visible) => {
      if (!visible) return
      cookieText.value = ''
      error.value = ''
      status.value = ''
      void loadAccount()
    })

    return {
      cookieInput,
      cookieText,
      account,
      playlists,
      selectedIds,
      allSelected,
      loading,
      progress,
      status,
      error,
      handleLoad,
      handleLoadSaved,
      handleSelectAll,
      handleImport,
      handleClear,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  width: min(560px, 88vw);
  min-width: min(280px, 88vw);
  max-height: 80vh;
  padding: 0 15px 15px;
  box-sizing: border-box;
}
.title {
  padding: 15px 0 10px;
  h2 { font-size: 16px; line-height: 1.3; }
}
.form, .accountSection { min-width: 0; }
.tip, .status, .empty {
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.5;
}
.cookieInput {
  display: block;
  width: 100%;
  min-height: 110px;
  margin: 12px 0;
  padding: 8px;
  box-sizing: border-box;
  border: none;
  border-radius: @form-radius;
  resize: vertical;
  background: var(--color-primary-background);
  color: var(--color-font);
  outline: none;
  font: 12px/1.5 monospace;
  &:focus { background: var(--color-primary-background-hover); }
}
.primaryBtn { margin-left: auto; display: block; }
.accountBar, .selectionBar, .footer {
  display: flex;
  align-items: center;
  gap: 10px;
}
.accountBar { justify-content: space-between; flex-wrap: wrap; }
.accountName { min-width: 0; word-break: break-all; font-size: 13px; }
.accountActions { display: flex; gap: 6px; }
.selectionBar { justify-content: space-between; margin: 14px 0 8px; font-size: 12px; color: var(--color-font-label); }
.playlists {
  max-height: 40vh;
  min-height: 80px;
  overflow-y: auto;
  border-top: 1px solid var(--color-list-header-border-bottom);
}
.playlist {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 3px 4px;
  &:hover { background: var(--color-primary-background-hover); }
  :global(.checkbox) { flex: auto; min-width: 0; }
  :global(.label) { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
.trackCount { flex: none; color: var(--color-font-label); font-size: 11px; }
.footer { justify-content: space-between; flex-wrap: wrap; margin-top: 14px; }
.status { flex: auto; }
.error { margin-top: 10px; color: var(--color-danger, #d65b5b); font-size: 12px; line-height: 1.4; }

</style>
