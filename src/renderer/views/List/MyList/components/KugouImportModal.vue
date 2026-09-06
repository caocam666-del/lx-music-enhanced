<template>
  <material-modal frosted :show="modelValue" bg-close teleport="#view" width="680px" max-height="86%" @close="handleClose">
    <main class="scroll" :class="$style.main">
      <header :class="$style.title">
        <h2>{{ $t('kugou__title') }}</h2>
      </header>

      <section v-if="!account" :class="$style.form">
        <!-- Luminous Harmonic: 扫码登录(打开官方窗口自动捕获会话) 为主, Cookie 粘贴保留 -->
        <p :class="$style.tip">{{ $t('kugou__qr_tip') }}</p>
        <base-btn :class="$style.primaryBtn" :disabled="scanning" @click="handleScanLogin">
          {{ scanning ? $t('kugou__qr_waiting_btn') : $t('kugou__qr_btn') }}
        </base-btn>
        <p v-if="scanStatus" :class="$style.qrStatus">{{ scanStatus }}</p>
        <button type="button" :class="$style.cookieToggle" @click="showCookieInput = !showCookieInput">{{ showCookieInput ? $t('netease__cookie_collapse') : $t('netease__cookie_expand') }}</button>
        <div v-show="showCookieInput" :class="$style.cookieArea">
          <p :class="$style.tip">{{ $t('kugou__cookie_tip') }}</p>
          <textarea
            v-model="cookieText" :class="$style.cookieInput"
            :placeholder="$t('kugou__cookie_placeholder')" spellcheck="false" autocomplete="off"
          />
          <base-btn :class="$style.primaryBtn" :disabled="loading || !cookieText.trim()" @click="handleLoad">
            {{ loading ? $t('netease__loading') : $t('netease__verify') }}
          </base-btn>
        </div>
      </section>

      <section v-else :class="$style.accountSection">
        <div :class="$style.accountBar">
          <span :class="$style.accountName">{{ $t('qishui__account', { name: nickname || '酷狗音乐' }) }}</span>
          <div :class="$style.accountActions">
            <base-btn min outline :disabled="loading" @click="handleLoadLibrary">{{ $t('netease__refresh') }}</base-btn>
            <base-btn min outline :disabled="loading" @click="handleClear">{{ $t('netease__clear_cookie') }}</base-btn>
          </div>
        </div>
        <div :class="$style.selectionBar">
          <base-checkbox
            id="kugou_select_all" :model-value="allSelected" :label="$t('netease__select_all')"
            @change="handleSelectAll"
          />
          <span>{{ $t('netease__playlist_count', { count: playlists.length }) }}</span>
        </div>
        <ul v-if="playlists.length" class="scroll" :class="$style.playlists">
          <li v-for="playlist in playlists" :key="playlist.id" :class="$style.playlist">
            <base-checkbox
              :id="`kugou_playlist_${playlist.id}`" v-model="selectedIds" :value="playlist.id"
              :label="playlist.name"
            />
            <span :class="$style.trackCount">{{ playlist.trackCount }}</span>
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
        <p :class="$style.hint">{{ $t('kugou__play_hint') }}</p>
      </section>

      <p v-if="error" :class="$style.error">{{ error }}</p>
    </main>
  </material-modal>
</template>

<script>
import { computed, ref, watch } from '@common/utils/vueTools'
import { useI18n } from '@root/lang'
import { createUserList } from '@renderer/store/list/action'
import syncSourceList from '@renderer/store/list/syncSourceList'
import { userLists } from '@renderer/store/list/state'
import {
  clearKugouCookie,
  getKugouLibrary,
  getKugouPlaylistTracks,
  setKugouCookie,
  openKugouLoginWindow,
} from '@renderer/utils/ipc'

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
    const cookieText = ref('')
    const nickname = ref('')
    const account = ref(false)
    const playlists = ref([])
    const selectedIds = ref([])
    const loading = ref(false)
    const progress = ref('')
    const status = ref('')
    const error = ref('')

    // Luminous Harmonic: 扫码登录(官方窗口)状态
    const scanning = ref(false)
    const scanStatus = ref('')
    const showCookieInput = ref(false)

    const handleScanLogin = async() => {
      if (scanning.value) return
      scanning.value = true
      scanStatus.value = t('kugou__qr_window_open')
      error.value = ''
      try {
        const result = await openKugouLoginWindow()
        if (result?.ok && result.cookie) {
          scanStatus.value = t('kugou__qr_syncing')
          await setKugouCookie(result.cookie)
          await handleLoadLibrary()
          scanStatus.value = ''
        } else {
          scanStatus.value = result?.message ?? ''
        }
      } catch (err) {
        scanStatus.value = err?.message ?? ''
      } finally {
        scanning.value = false
      }
    }


    const allSelected = computed(() => playlists.value.length > 0 && selectedIds.value.length == playlists.value.length)

    const errorText = err => {
      if (err?.message == 'KUGOU_AUTH_REQUIRED') return t('kugou__auth_required')
      if (err?.message == 'KUGOU_PLAYLIST_EMPTY') return t('netease__empty')
      return t('netease__load_failed')
    }

    const handleLoadLibrary = async() => {
      loading.value = true
      error.value = ''
      try {
        const result = await getKugouLibrary()
        nickname.value = result.nickname
        playlists.value = result.playlists
        selectedIds.value = result.playlists.map(p => p.id)
        account.value = true
      } catch (err) {
        account.value = false
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
        await setKugouCookie(cookieText.value.trim())
        await handleLoadLibrary()
      } catch (err) {
        error.value = err?.message == 'KUGOU_AUTH_REQUIRED' ? t('kugou__auth_required') : errorText(err)
      } finally {
        loading.value = false
      }
    }

    const handleClear = async() => {
      await clearKugouCookie()
      account.value = false
      playlists.value = []
      selectedIds.value = []
      cookieText.value = ''
      error.value = ''
      status.value = ''
    }

    const handleSelectAll = checked => {
      selectedIds.value = checked ? playlists.value.map(item => item.id) : []
    }

    const mapTrack = track => ({
      id: `kg_${track.songId}`,
      source: 'kg',
      name: track.name,
      singer: track.singer,
      interval: track.interval || null,
      meta: {
        songId: track.songId,
        hash: track.hash,
        albumId: track.albumId,
        albumName: track.albumName,
        picUrl: track.cover || null,
        qualitys: track.qualitys.map(q => ({ type: q.type, size: null })),
        _qualitys: Object.fromEntries(track.qualitys.map(q => [q.type, { size: null, hash: q.hash }])),
      },
    })

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
          const target = userLists.find(list => list.source === 'kg' && String(list.sourceListId) === playlist.id)
          try {
            if (target) {
              await syncSourceList(target)
            } else {
              const tracks = await getKugouPlaylistTracks(playlist.id)
              await createUserList({
                name: playlist.name,
                list: tracks.map(mapTrack),
                source: 'kg',
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

    const handleClose = () => emit('update:modelValue', false)

    watch(() => props.modelValue, (visible) => {
      if (!visible) return
      cookieText.value = ''
      error.value = ''
      status.value = ''
      scanning.value = false
      scanStatus.value = ''
      showCookieInput.value = false
      // 已有登录态时直接拉歌单
      loading.value = true
      getKugouLibrary().then(result => {
        nickname.value = result.nickname
        playlists.value = result.playlists
        selectedIds.value = result.playlists.map(p => p.id)
        account.value = true
      }).catch(() => {
        account.value = false
      }).finally(() => {
        loading.value = false
      })
    })

    return {
      cookieText,
      scanning,
      scanStatus,
      showCookieInput,
      handleScanLogin,
      nickname,
      account,
      playlists,
      selectedIds,
      loading,
      progress,
      status,
      error,
      allSelected,
      handleLoadLibrary,
      handleLoad,
      handleClear,
      handleSelectAll,
      handleImport,
      handleClose,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 4px 15px 15px;
  min-height: 300px;
}
.title {
  margin-bottom: 10px;
  text-align: center;

  h2 {
    margin: 0;
    color: var(--color-primary);
    letter-spacing: 0.01em;
    word-break: break-all;
  }
}
.form {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 12px;
}
.tip {
  font-size: 13px;
  color: var(--color-font-label);
  text-align: center;
  line-height: 1.5;
}
.cookieInput {
  width: 100%;
  height: 90px;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: @form-radius;
  border: 1px solid color-mix(in srgb, var(--color-font) 12%, transparent);
  background: color-mix(in srgb, var(--color-content-background) 60%, transparent);
  color: var(--color-font);
  font-size: 12px;
  resize: none;
  outline: none;
}
.cookieToggle {
  border: none;
  background: none;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  padding: 2px 6px;

  &:hover { opacity: .8; }
}
.cookieArea {
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.qrStatus {
  font-size: 13px;
  color: var(--color-font-label);
  text-align: center;
}
.accountSection {
  display: flex;
  flex-flow: column nowrap;
  gap: 10px;
}
.accountBar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.accountName {
  font-size: 13px;
  color: var(--color-font);
  .mixin-ellipsis-1();
}
.accountActions {
  flex: none;
  display: flex;
  gap: 8px;
}
.selectionBar {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--color-font-label);
}
.playlists {
  max-height: 300px;
  overflow-y: auto;
  display: flex;
  flex-flow: column nowrap;
  gap: 4px;
  padding: 4px;
  border-radius: @radius-border;
  border: 1px solid var(--glass-stroke, transparent);
}
.playlist {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 6px;
  border-radius: 6px;

  &:hover {
    background: color-mix(in srgb, var(--color-font) 4%, transparent);
  }
}
.trackCount {
  flex: none;
  font-size: 12px;
  color: var(--color-font-label);
  font-variant-numeric: tabular-nums;
}
.empty {
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  color: var(--color-font-label);
}
.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.status {
  flex: auto;
  font-size: 12px;
  color: var(--color-font-label);
  text-align: left;
  .mixin-ellipsis-1();
}
.hint {
  font-size: 12px;
  color: var(--color-font-label);
  opacity: .8;
}
.error {
  margin-top: 10px;
  font-size: 12px;
  color: var(--color-danger, #e05050);
  word-break: break-all;
}
.primaryBtn {
  min-width: 140px;
}
</style>
